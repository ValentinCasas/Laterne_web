import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize, canAccessBranch } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const reverseInput = z.object({
  note: z.string().trim().max(500).optional(),
});

/**
 * @summary Anula una entrega y revierte las cantidades entregadas al pedido original.
 * La entrega queda marcada como reversed para auditoría; nunca se borra.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("order.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  const parsed = reverseInput.safeParse(await request.json().catch(() => null));
  if (!Number.isInteger(id) || !parsed.success)
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });

  const delivery = await prisma.orderDelivery.findFirst({
    where: { id, tenantId: auth.tenant.id },
    include: { order: { select: { branchId: true, status: true } }, items: true },
  });
  if (!delivery) return NextResponse.json({ error: "Entrega no encontrada" }, { status: 404 });
  if (delivery.status === "reversed") {
    return NextResponse.json({ error: "La entrega ya fue anulada" }, { status: 400 });
  }
  if (delivery.order.branchId && !canAccessBranch(auth, delivery.order.branchId)) {
    return NextResponse.json({ error: "No tenés acceso a la sucursal de este pedido" }, { status: 403 });
  }

  const reversed = await prisma.$transaction(async (transaction) => {
    const updated = await transaction.orderDelivery.update({
      where: { id },
      data: { status: "reversed", reversedAt: new Date(), reversedById: auth.session.userId, notes: parsed.data.note ?? delivery.notes },
    });

    for (const item of delivery.items) {
      const orderItem = await transaction.orderItem.findFirst({ where: { id: item.orderItemId } });
      if (!orderItem) continue;
      const newDelivered = Math.max(0, orderItem.deliveredQuantity - item.quantityDelivered);
      await transaction.orderItem.update({
        where: { id: item.orderItemId },
        data: { deliveredQuantity: newDelivered, pendingQuantity: orderItem.quantity - newDelivered },
      });
    }

    return updated;
  });

  await recordAudit({
    context: auth,
    action: "delivery-reverse",
    entityType: "order-delivery",
    entityId: id,
    oldValues: toAuditValue({ ...delivery, status: delivery.status }),
    newValues: toAuditValue({ ...reversed, status: "reversed" }),
    request,
  });

  return NextResponse.json({ delivery: reversed });
}
