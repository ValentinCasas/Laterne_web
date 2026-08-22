import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize, canAccessBranch } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/format";

const driverListInput = z.object({
  q: z.string().trim().optional(),
  status: z.string().optional(),
  branchId: z.coerce.number().int().positive().optional(),
  active: z.coerce.boolean().optional(),
  withActiveDelivery: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * @summary Lista perfiles de repartidores con filtros y paginación.
 */
export async function GET(request: Request) {
  const auth = await authorize("driver.view");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const url = new URL(request.url);
  const parsed = driverListInput.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });

  const { q, status, branchId, active, withActiveDelivery, limit, offset } = parsed.data;

  const accessibleBranchIds = auth.branches.map((b) => b.id);
  const where: Record<string, unknown> = { tenantId: auth.tenant.id };

  if (status) where.status = status;
  if (active !== undefined) where.active = active;

  if (branchId) {
    if (!accessibleBranchIds.includes(branchId)) {
      return NextResponse.json({ error: "No tenés acceso a esa sucursal" }, { status: 403 });
    }
    where.branches = { some: { branchId } };
  } else if (accessibleBranchIds.length > 0 && !auth.allBranches) {
    where.branches = { some: { branchId: { in: accessibleBranchIds } } };
  }

  if (withActiveDelivery) {
    where.deliveries = { some: { status: { in: ["PENDING_ASSIGNMENT", "ASSIGNED", "PICKED_UP", "ON_THE_WAY"] } } };
  }

  if (q) {
    where.OR = [
      { name: { contains: q } },
      { phone: { contains: q } },
      { user: { name: { contains: q } } },
      { user: { email: { contains: q } } },
    ];
  }

  const [drivers, total] = await Promise.all([
    prisma.driverProfile.findMany({
      where,
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
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.driverProfile.count({ where }),
  ]);

  const driversWithStats = await Promise.all(
    drivers.map(async (driver) => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [deliveriesToday, deliveriesWeek, deliveriesMonth, activeDeliveries] = await Promise.all([
        prisma.orderDelivery.count({
          where: { tenantId: auth.tenant.id, driverProfileId: driver.id, createdAt: { gte: todayStart } },
        }),
        prisma.orderDelivery.count({
          where: { tenantId: auth.tenant.id, driverProfileId: driver.id, createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        }),
        prisma.orderDelivery.count({
          where: { tenantId: auth.tenant.id, driverProfileId: driver.id, createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
        }),
        prisma.orderDelivery.count({
          where: { tenantId: auth.tenant.id, driverProfileId: driver.id, status: { in: ["PENDING_ASSIGNMENT", "ASSIGNED", "PICKED_UP", "ON_THE_WAY"] } },
        }),
      ]);

      const completedDeliveries = await prisma.orderDelivery.findMany({
        where: { tenantId: auth.tenant.id, driverProfileId: driver.id, status: "DELIVERED" },
        select: { assignedAt: true, pickedUpAt: true, deliveredAt: true, createdAt: true },
      });

      let avgPickupMinutes = 0;
      let avgDeliveryMinutes = 0;
      let avgTotalMinutes = 0;

      if (completedDeliveries.length > 0) {
        const pickupTimes = completedDeliveries
          .filter((d) => d.assignedAt && d.pickedUpAt)
          .map((d) => (d.pickedUpAt!.getTime() - d.assignedAt!.getTime()) / 60000);
        const deliveryTimes = completedDeliveries
          .filter((d) => d.pickedUpAt && d.deliveredAt)
          .map((d) => (d.deliveredAt!.getTime() - d.pickedUpAt!.getTime()) / 60000);
        const totalTimes = completedDeliveries
          .filter((d) => d.assignedAt && d.deliveredAt)
          .map((d) => (d.deliveredAt!.getTime() - d.assignedAt!.getTime()) / 60000);

        avgPickupMinutes = pickupTimes.length ? Math.round(pickupTimes.reduce((a, b) => a + b, 0) / pickupTimes.length) : 0;
        avgDeliveryMinutes = deliveryTimes.length ? Math.round(deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length) : 0;
        avgTotalMinutes = totalTimes.length ? Math.round(totalTimes.reduce((a, b) => a + b, 0) / totalTimes.length) : 0;
      }

      const lastActivity = await prisma.orderDelivery.findFirst({
        where: { tenantId: auth.tenant.id, driverProfileId: driver.id },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });

      return {
        ...driver,
        branches: driver.branches.map((db) => db.branch),
        activeDeliveriesCount: driver._count.deliveries,
        totalIncidents: driver._count.incidents,
        deliveriesToday,
        deliveriesWeek,
        deliveriesMonth,
        activeDeliveries,
        avgPickupMinutes,
        avgDeliveryMinutes,
        avgTotalMinutes,
        lastActivityAt: lastActivity?.createdAt ?? null,
      };
    })
  );

  return NextResponse.json({ items: serialize(driversWithStats), total, limit, offset });
}

const createDriverInput = z.object({
  name: z.string().trim().min(1).max(160),
  phone: z.string().trim().min(1).max(60),
  userId: z.coerce.number().int().positive().nullable().optional(),
  status: z.enum(["AVAILABLE", "UNAVAILABLE", "INACTIVE"]).default("AVAILABLE"),
  active: z.boolean().default(true),
  vehicleType: z.string().trim().max(80).nullable().optional(),
  plate: z.string().trim().max(20).nullable().optional(),
  color: z.string().trim().max(60).nullable().optional(),
  capacity: z.coerce.number().int().positive().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  branchIds: z.array(z.coerce.number().int().positive()).default([]),
});

/**
 * @summary Crea un nuevo perfil de repartidor.
 */
export async function POST(request: Request) {
  const auth = await authorize("driver.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const parsed = createDriverInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });

  const { name, phone, userId, status, active, vehicleType, plate, color, capacity, notes, branchIds } = parsed.data;

  if (userId) {
    const user = await prisma.user.findFirst({ where: { id: userId, memberships: { some: { tenantId: auth.tenant.id, status: "active" } } } });
    if (!user) return NextResponse.json({ error: "Usuario no encontrado o sin membresía activa en este tenant" }, { status: 404 });

    const existing = await prisma.driverProfile.findFirst({ where: { tenantId: auth.tenant.id, userId } });
    if (existing) return NextResponse.json({ error: "Este usuario ya tiene un perfil de repartidor" }, { status: 400 });
  }

  for (const branchId of branchIds) {
    if (!canAccessBranch(auth, branchId)) {
      return NextResponse.json({ error: `No tenés acceso a la sucursal ${branchId}` }, { status: 403 });
    }
  }

  const driver = await prisma.$transaction(async (tx) => {
    const created = await tx.driverProfile.create({
      data: {
        tenantId: auth.tenant.id,
        userId: userId ?? null,
        name,
        phone,
        status,
        active,
        vehicleType: vehicleType ?? null,
        plate: plate ?? null,
        color: color ?? null,
        capacity: capacity ?? null,
        notes: notes ?? null,
      },
    });

    if (branchIds.length > 0) {
      await tx.driverBranch.createMany({
        data: branchIds.map((branchId) => ({
          tenantId: auth.tenant.id,
          driverId: created.id,
          branchId,
        })),
        skipDuplicates: true,
      });
    }

    return created;
  });

  await recordAudit({
    context: auth,
    action: "driver-create",
    entityType: "driver-profile",
    entityId: driver.id,
    newValues: toAuditValue(driver),
    request,
  });

  return NextResponse.json({ driver: serialize(driver) }, { status: 201 });
}
