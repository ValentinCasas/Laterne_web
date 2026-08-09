import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { orderStatuses } from "@/lib/orders";
import { loyaltyPoints, loyaltyTier } from "@/lib/loyalty";
import { prisma } from "@/lib/prisma";

const updateInput = z.object({
  status: z.enum(orderStatuses),
  note: z.string().trim().max(500).optional(),
});

/** @summary Actualiza el avance de un pedido y registra historial, notificación y auditoría. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("order.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  const parsed = updateInput.safeParse(await request.json().catch(() => null));
  if (!Number.isInteger(id) || !parsed.success) {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
  const current = await prisma.customerOrder.findFirst({
    where: { id, tenantId: auth.tenant.id },
    include: { items: true, table: true },
  });
  if (!current) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });

  const updated = await prisma.$transaction(async (transaction) => {
    const order = await transaction.customerOrder.update({
      where: { id },
      data: { status: parsed.data.status },
    });
    await transaction.orderStatusHistory.create({
      data: {
        orderId: id,
        userId: auth.session.userId,
        fromStatus: current.status,
        toStatus: parsed.data.status,
        note: parsed.data.note || null,
      },
    });
    await transaction.notification.create({
      data: {
        tenantId: auth.tenant.id,
        type: "order.status",
        title: `${current.reference} · ${parsed.data.status}`,
        message: `El pedido de ${current.customerName} cambió de estado.`,
        link: "/admin/pedidos",
      },
    });
    if (parsed.data.status === "delivered" && current.customerId) {
      const existingReward = await transaction.loyaltyTransaction.findFirst({
        where: { customerId: current.customerId, reference: current.reference },
      });
      if (!existingReward) {
        const points = loyaltyPoints(Number(current.total));
        const customer = await transaction.loyaltyCustomer.update({
          where: { id: current.customerId },
          data: { points: { increment: points } },
        });
        await transaction.loyaltyCustomer.update({
          where: { id: customer.id },
          data: { tier: loyaltyTier(customer.points) },
        });
        await transaction.loyaltyTransaction.create({
          data: { customerId: customer.id, points, reason: "Pedido entregado", reference: current.reference },
        });
      }
    }
    return order;
  });
  await recordAudit({
    context: auth,
    action: "status-change",
    entityType: "customer-order",
    entityId: id,
    oldValues: toAuditValue(serialize(current)),
    newValues: toAuditValue(serialize(updated)),
    request,
  });
  return NextResponse.json({ order: serialize(updated) });
}
