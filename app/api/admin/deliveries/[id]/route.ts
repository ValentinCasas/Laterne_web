import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize, canAccessBranch } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/format";

const updateDeliveryInput = z.object({
  status: z.enum(["PENDING_ASSIGNMENT", "ASSIGNED", "PICKED_UP", "ON_THE_WAY", "DELIVERED", "FAILED", "CANCELLED"]).optional(),
  driverId: z.coerce.number().int().positive().optional(),
  latitude: z.string().trim().max(32).optional(),
  longitude: z.string().trim().max(32).optional(),
  contactPhone: z.string().trim().max(60).optional(),
  contactName: z.string().trim().max(160).optional(),
  instructions: z.string().trim().max(1000).optional(),
  receiverName: z.string().trim().max(160).optional(),
  note: z.string().trim().max(500).optional(),
});

/**
 * @summary Actualiza una entrega: asigna repartidor, cambia estado, registra coordenadas.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("order.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  const parsed = updateDeliveryInput.safeParse(await request.json().catch(() => null));
  if (!Number.isInteger(id) || !parsed.success)
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });

  const delivery = await prisma.orderDelivery.findFirst({
    where: { id, tenantId: auth.tenant.id },
    include: { order: { select: { branchId: true, status: true } }, driver: { select: { id: true, name: true } } },
  });
  if (!delivery) return NextResponse.json({ error: "Entrega no encontrada" }, { status: 404 });
  if (delivery.order.branchId && !canAccessBranch(auth, delivery.order.branchId)) {
    return NextResponse.json({ error: "No tenés acceso a la sucursal de este pedido" }, { status: 403 });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.status) {
    if (parsed.data.status === "ASSIGNED" && !parsed.data.driverId && !delivery.driverId) {
      return NextResponse.json({ error: "Asignar un repartidor para cambiar a ASSIGNED" }, { status: 400 });
    }
    data.status = parsed.data.status;
    if (parsed.data.status === "ASSIGNED") data.assignedAt = new Date();
    if (parsed.data.status === "PICKED_UP") data.pickedUpAt = new Date();
    if (parsed.data.status === "DELIVERED") data.deliveredAt = new Date();
  }
  if (parsed.data.driverId !== undefined) {
    const driver = await prisma.user.findFirst({ where: { id: parsed.data.driverId } });
    if (!driver) return NextResponse.json({ error: "Repartidor no encontrado" }, { status: 404 });
    data.driverId = parsed.data.driverId;
    if (!delivery.driverId && parsed.data.status === "ASSIGNED") {
      data.assignedAt = new Date();
    }
  }
  if (parsed.data.latitude !== undefined) data.latitude = parsed.data.latitude;
  if (parsed.data.longitude !== undefined) data.longitude = parsed.data.longitude;
  if (parsed.data.contactPhone !== undefined) data.contactPhone = parsed.data.contactPhone;
  if (parsed.data.contactName !== undefined) data.contactName = parsed.data.contactName;
  if (parsed.data.instructions !== undefined) data.instructions = parsed.data.instructions;
  if (parsed.data.receiverName !== undefined) data.receiverName = parsed.data.receiverName;

  const updated = await prisma.orderDelivery.update({
    where: { id },
    data,
    include: { driver: { select: { id: true, name: true } }, branch: { select: { name: true } } },
  });

  await recordAudit({
    context: auth,
    action: "delivery-update",
    entityType: "order-delivery",
    entityId: id,
    oldValues: toAuditValue({ ...delivery, status: delivery.status, driverId: delivery.driverId }),
    newValues: toAuditValue({ ...updated, status: updated.status, driverId: updated.driverId }),
    request,
  });

  return NextResponse.json({ delivery: serialize(updated) });
}

/**
 * @summary Elimina una entrega en borrador (sino está en estados finales).
 */
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("order.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);

  const delivery = await prisma.orderDelivery.findFirst({
    where: { id, tenantId: auth.tenant.id },
    include: { order: { select: { branchId: true, status: true } }, items: true },
  });
  if (!delivery) return NextResponse.json({ error: "Entrega no encontrada" }, { status: 404 });
  if (["DELIVERED", "FAILED", "CANCELLED"].includes(delivery.status)) {
    return NextResponse.json({ error: "No se puede eliminar una entrega finalizada" }, { status: 400 });
  }

  await prisma.$transaction(async (transaction) => {
    for (const item of delivery.items) {
      const orderItem = await transaction.orderItem.findFirst({ where: { id: item.orderItemId } });
      if (!orderItem) continue;
      const newDelivered = Math.max(0, orderItem.deliveredQuantity - item.quantityDelivered);
      await transaction.orderItem.update({
        where: { id: item.orderItemId },
        data: { deliveredQuantity: newDelivered, pendingQuantity: orderItem.quantity - newDelivered },
      });
    }
    await transaction.orderDelivery.delete({ where: { id } });
  });

  await recordAudit({
    context: auth,
    action: "delivery-delete",
    entityType: "order-delivery",
    entityId: id,
    oldValues: toAuditValue(delivery),
    newValues: undefined,
    request,
  });

  return NextResponse.json({ deleted: true });
}
