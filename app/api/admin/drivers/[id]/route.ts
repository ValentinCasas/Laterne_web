import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize, canAccessBranch } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/format";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize("driver.view");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const paramsObj = await params;
  const driverId = parseInt(paramsObj.id, 10);
  if (isNaN(driverId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const driver = await prisma.driverProfile.findUnique({
    where: { id: driverId, tenantId: auth.tenant.id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      branches: { include: { branch: { select: { id: true, name: true, slug: true } } } },
      _count: {
        select: {
          deliveries: { where: { status: { in: ["PENDING_ASSIGNMENT", "ASSIGNED", "PICKED_UP", "ON_THE_WAY"] } } },
          incidents: true,
        },
      },
    },
  });

  if (!driver) {
    return NextResponse.json({ error: "Repartidor no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ driver: serialize(driver) });
}

const updateDriverInput = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  phone: z.string().trim().min(1).max(60).optional(),
  userId: z.number().int().positive().optional(),
  status: z.enum(["AVAILABLE", "UNAVAILABLE", "INACTIVE"]).optional(),
  active: z.boolean().optional(),
  vehicleType: z.string().trim().max(80).optional().nullable(),
  plate: z.string().trim().max(20).optional().nullable(),
  color: z.string().trim().max(60).optional().nullable(),
  capacity: z.number().int().positive().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  branchIds: z.array(z.number().int().positive()).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize("driver.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const paramsObj = await params;
  const driverId = parseInt(paramsObj.id, 10);
  if (isNaN(driverId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const parsed = updateDriverInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const { name, phone, userId, status, active, vehicleType, plate, color, capacity, notes, branchIds } = parsed.data;

  // Check if userId is provided and valid
  if (userId !== undefined && userId !== null) {
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        memberships: { some: { tenantId: auth.tenant.id, status: "active" } },
      },
    });
    if (!user) {
      return NextResponse.json(
        { error: "Usuario no encontrado o sin membresía activa en este tenant" },
        { status: 404 }
      );
    }

    // Check if another driver profile already exists for this user (excluding current)
    const existing = await prisma.driverProfile.findFirst({
      where: {
        tenantId: auth.tenant.id,
        userId,
        id: { not: driverId },
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Este usuario ya tiene un perfil de repartidor" },
        { status: 400 }
      );
    }
  }

  // Validate branch access
  if (branchIds !== undefined) {
    for (const branchId of branchIds) {
      if (!canAccessBranch(auth, branchId)) {
        return NextResponse.json(
          { error: `No tenés acceso a la sucursal ${branchId}` },
          { status: 403 }
        );
      }
    }
  }

  try {
    const driver = await prisma.$transaction(async (tx) => {
      const updated = await tx.driverProfile.update({
        where: { id: driverId, tenantId: auth.tenant.id },
        data: {
          name,
          phone,
          userId: userId ?? null,
          status,
          active,
          vehicleType: vehicleType ?? null,
          plate: plate ?? null,
          color: color ?? null,
          capacity: capacity ?? null,
          notes: notes ?? null,
        },
      });

      // Update branch associations if provided
      if (branchIds !== undefined) {
        // Delete existing associations
        await tx.driverBranch.deleteMany({
          where: { driverId: driverId, tenantId: auth.tenant.id },
        });
        // Create new associations
        if (branchIds.length > 0) {
          await tx.driverBranch.createMany({
            data: branchIds.map((branchId) => ({
              tenantId: auth.tenant.id,
              driverId: driverId,
              branchId,
            })),
            skipDuplicates: true,
          });
        }
      }

      return updated;
    });

    await recordAudit({
      context: auth,
      action: "driver-update",
      entityType: "driver-profile",
      entityId: driver.id,
      newValues: toAuditValue(driver),
      request,
    });

    return NextResponse.json({ driver: serialize(driver) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo actualizar el repartidor" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize("driver.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const paramsObj = await params;
  const driverId = parseInt(paramsObj.id, 10);
  if (isNaN(driverId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  // Check if the driver has any active deliveries (excluding cancelled, failed, delivered)
  const activeDeliveriesCount = await prisma.orderDelivery.count({
    where: {
      tenantId: auth.tenant.id,
      driverProfileId: driverId,
      status: { in: ["PENDING_ASSIGNMENT", "ASSIGNED", "PICKED_UP", "ON_THE_WAY"] },
    },
  });

  if (activeDeliveriesCount > 0) {
    return NextResponse.json(
      { error: "No se puede eliminar el repartidor porque tiene entregas activas" },
      { status: 400 }
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Delete driver branch associations
      await tx.driverBranch.deleteMany({
        where: { driverId: driverId, tenantId: auth.tenant.id },
      });
      // Delete driver profile
      await tx.driverProfile.delete({
        where: { id: driverId, tenantId: auth.tenant.id },
      });
    });

    await recordAudit({
      context: auth,
      action: "driver-delete",
      entityType: "driver-profile",
      entityId: driverId,
      request,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo eliminar el repartidor" },
      { status: 500 }
    );
  }
}