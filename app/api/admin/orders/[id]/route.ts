import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize, canAccessBranch } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { restoreOrderStock } from "@/lib/order-stock";
import { asOrderType, transitionError } from "@/lib/order-status";
import { orderStatuses, type OrderStatus } from "@/lib/orders";
import { loyaltyPoints, loyaltyTier } from "@/lib/loyalty";
import { emitOrderStatusNotification } from "@/lib/order-notifications";
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
  if (current.branchId && !canAccessBranch(auth, current.branchId)) {
    return NextResponse.json({ error: "No tenés acceso a la sucursal de este pedido" }, { status: 403 });
  }

  const orderType = asOrderType(current.orderType);
  const invalidTransition = transitionError(current.status as OrderStatus, parsed.data.status, orderType);
  if (invalidTransition) {
    return NextResponse.json({ error: invalidTransition }, { status: 409 });
  }

  let updated;
  try {
    updated = await prisma.$transaction(async (transaction) => {
      const guarded = await transaction.customerOrder.updateMany({
        where: { id, tenantId: auth.tenant.id, status: current.status },
        data: { status: parsed.data.status },
      });
      if (guarded.count !== 1) throw new Error("El pedido cambió de estado mientras tanto");
      const order = await transaction.customerOrder.findUniqueOrThrow({ where: { id } });
      await transaction.orderStatusHistory.create({
        data: {
          orderId: id,
          userId: auth.session.userId,
          fromStatus: current.status,
          toStatus: parsed.data.status,
          note: parsed.data.note || null,
        },
      });
      if (parsed.data.status === "cancelled") {
        await restoreOrderStock(transaction, { id, reference: current.reference });
      }
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
            data: {
              customerId: customer.id,
              points,
              reason: "Pedido entregado",
              reference: current.reference,
            },
          });
        }
      }
      return order;
    });
    await emitOrderStatusNotification({
      tenantId: auth.tenant.id,
      branchId: current.branchId,
      orderId: current.id,
      reference: current.reference,
      customerName: current.customerName,
      phone: current.phone,
      status: parsed.data.status,
    });
  } catch (reason) {
    if (reason instanceof Error && reason.message.includes("cambió de estado mientras tanto")) {
      return NextResponse.json({ error: reason.message }, { status: 409 });
    }
    throw reason;
  }
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
