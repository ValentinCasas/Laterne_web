import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const positionInput = z.object({
  deliveryId: z.coerce.number().int().positive().optional(),
  branchId: z.coerce.number().int().positive().optional(),
  latitude: z.string().trim().max(32),
  longitude: z.string().trim().max(32),
  accuracy: z.string().trim().max(32).optional(),
});

/**
 * @summary Recibe una posición GPS del repartidor. Solo se guarda si el repartidor
 * está asignado a una entrega activa o si la sucursal coincide con su acceso.
 * Se deja la infraestructura lista para el seguimiento en tiempo real (no usado aún).
 */
export async function POST(request: Request) {
  const auth = await authorize("driver.self");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const driverProfile = await prisma.driverProfile.findFirst({
    where: { tenantId: auth.tenant.id, userId: auth.session.userId },
  });
  if (!driverProfile) return NextResponse.json({ error: "No tenés un perfil de repartidor vinculado" }, { status: 403 });

  const parsed = positionInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos de posición inválidos" }, { status: 400 });

  const { deliveryId, branchId, latitude, longitude, accuracy } = parsed.data;

  if (deliveryId) {
    const delivery = await prisma.orderDelivery.findFirst({
      where: { id: deliveryId, tenantId: auth.tenant.id },
    });
    if (!delivery) return NextResponse.json({ error: "Entrega no encontrada" }, { status: 404 });
    if (delivery.driverProfileId !== driverProfile.id) {
      return NextResponse.json({ error: "No sos el repartidor asignado" }, { status: 403 });
    }
  } else if (branchId) {
    const branchAccess = await prisma.driverBranch.findFirst({
      where: { driverId: driverProfile.id, tenantId: auth.tenant.id, branchId },
    });
    if (!branchAccess) {
      return NextResponse.json({ error: "No tenés acceso a la sucursal" }, { status: 403 });
    }
  } else {
    return NextResponse.json({ error: "Indicá la entrega o la sucursal" }, { status: 400 });
  }

  await prisma.driverPosition.create({
    data: {
      tenantId: auth.tenant.id,
      branchId: branchId ?? null,
      deliveryId: deliveryId ?? null,
      driverId: auth.session.userId,
      driverProfileId: driverProfile.id,
      latitude,
      longitude,
      accuracy: accuracy ?? undefined,
    },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
