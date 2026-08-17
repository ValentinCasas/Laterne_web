import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize, canAccessBranch } from "@/lib/auth";
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
 */
export async function POST(request: Request) {
  const auth = await authorize("order.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = positionInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos de posición inválidos" }, { status: 400 });

  const { deliveryId, branchId, latitude, longitude, accuracy } = parsed.data;

  if (deliveryId) {
    const delivery = await prisma.orderDelivery.findFirst({
      where: { id: deliveryId, tenantId: auth.tenant.id },
      include: { order: { select: { branchId: true } } },
    });
    if (!delivery) return NextResponse.json({ error: "Entrega no encontrada" }, { status: 404 });
    if (delivery.driverId !== auth.session.userId) {
      return NextResponse.json({ error: "No sos el repartidor asignado" }, { status: 403 });
    }
    if (delivery.order.branchId && !canAccessBranch(auth, delivery.order.branchId)) {
      return NextResponse.json({ error: "No tenés acceso a la sucursal" }, { status: 403 });
    }
  } else if (branchId) {
    if (!canAccessBranch(auth, branchId)) {
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
      latitude,
      longitude,
      accuracy: accuracy ?? undefined,
    },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
