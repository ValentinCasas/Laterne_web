import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize, canAccessBranch } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { restoreOrderStock } from "@/lib/order-stock";
import { asOrderType, transitionError } from "@/lib/order-status";
import { orderStatuses, orderStatusLabel, type OrderStatus } from "@/lib/orders";
import { awardOrderLoyalty } from "@/lib/loyalty";
import { deriveSessionStatus } from "@/lib/table-status";
import { emitOrderStatusNotification } from "@/lib/order-notifications";
import { ACTIVE_DELIVERY_STATUSES, assertOrderCancellable } from "@/lib/delivery-orders";
import { prisma } from "@/lib/prisma";

/**
 * @summary Valida la entrada relacionada con los pedidos.
 */
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
        // No se cancela en silencio una entrega ya retirada/en camino: el
        // repartidor está en la calle y la resolución exige intervención admin.
        await assertOrderCancellable(transaction, id, auth.tenant.id);
        await restoreOrderStock(transaction, { id, reference: current.reference });
        // El pedido cancela sus entregas en curso para no dejar logística huérfana.
        const activeDeliveries = await transaction.orderDelivery.findMany({
          where: { orderId: id, tenantId: auth.tenant.id, status: { in: [...ACTIVE_DELIVERY_STATUSES] } },
          select: { id: true, status: true, driverProfileId: true },
        });
        for (const delivery of activeDeliveries) {
          await transaction.orderDelivery.update({
            where: { id: delivery.id },
            data: { status: "CANCELLED" },
          });
          await transaction.orderDeliveryStatusLog.create({
            data: {
              tenantId: auth.tenant.id,
              deliveryId: delivery.id,
              driverProfileId: delivery.driverProfileId,
              status: "CANCELLED",
              previousStatus: delivery.status,
              reason: `Pedido ${current.reference} cancelado`,
              changedById: auth.session.userId,
            },
          });
        }
      }
      if (parsed.data.status === "delivered") {
        await awardOrderLoyalty(transaction, {
          id: current.id,
          customerId: current.customerId,
          reference: current.reference,
          total: Number(current.total),
        });
      }
      const tableSessionId = current.tableSessionId;
      const orderBranchId = current.branchId;
      if (tableSessionId && orderBranchId) {
        const sessionStatuses = await transaction.customerOrder.findMany({
          where: {
            tenantId: auth.tenant.id,
            tableSessionId,
            status: { notIn: ["delivered", "cancelled"] },
          },
          select: { status: true },
        });
        await transaction.tableSession.update({
          where: { id: tableSessionId },
          data: { status: deriveSessionStatus(sessionStatuses.map((item) => item.status)) },
        });
        await transaction.tableSessionEvent.create({
          data: {
            tenantId: auth.tenant.id,
            branchId: orderBranchId,
            sessionId: tableSessionId,
            eventType: "order_status",
            note: `${current.reference} · ${orderStatusLabel(parsed.data.status)}`,
            userId: auth.session.userId,
          },
        });
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
    if (reason instanceof Error && reason.message === "DELIVERY_EN_ROUTE") {
      return NextResponse.json(
        { error: "El pedido está en camino con un repartidor: resolvé la entrega antes de cancelarlo." },
        { status: 409 },
      );
    }
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
