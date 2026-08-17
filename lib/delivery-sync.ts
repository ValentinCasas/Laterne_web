import type { Prisma } from "@prisma/client";
import { awardOrderLoyalty } from "@/lib/loyalty";

/** @summary Datos de la entrega que necesita la sincronización con el pedido. */
export type DeliveryForOrderSync = {
  orderId: number;
  tenantId: number;
  status: string;
  items: Array<{ orderItemId: number; quantityDelivered: number }>;
};

/**
 * @summary Sincroniza el ciclo del pedido con el avance logístico de su entrega,
 * dentro de la misma transacción:
 * - EN CAMINO: marca el pedido como `on_the_way` (solo si estaba `ready`).
 * - ENTREGADO: despacha las líneas, cierra el pedido como `delivered` con su
 *   historial y su fidelización cuando no queda nada pendiente.
 * RETIRADO no altera el estado del pedido: es logístico puro.
 * Es idempotente y con comprobación optimista sobre el estado del pedido.
 */
export async function applyDeliveryStatusToOrder(
  transaction: Prisma.TransactionClient,
  delivery: DeliveryForOrderSync,
  opts: { userId: number },
): Promise<void> {
  if (delivery.status === "ON_THE_WAY") {
    await transaction.customerOrder.updateMany({
      where: { id: delivery.orderId, tenantId: delivery.tenantId, status: "ready" },
      data: { status: "on_the_way" },
    });
    const already = await transaction.orderStatusHistory.findFirst({
      where: { orderId: delivery.orderId, toStatus: "on_the_way" },
      select: { id: true },
    });
    if (!already) {
      await transaction.orderStatusHistory.create({
        data: {
          orderId: delivery.orderId,
          userId: opts.userId,
          fromStatus: "ready",
          toStatus: "on_the_way",
          note: "Pedido en camino con el repartidor",
        },
      });
    }
    return;
  }

  if (delivery.status === "DELIVERED") {
    for (const item of delivery.items) {
      const orderItem = await transaction.orderItem.findFirst({
        where: { id: item.orderItemId },
      });
      if (!orderItem) continue;
      const newDelivered = orderItem.deliveredQuantity + item.quantityDelivered;
      await transaction.orderItem.update({
        where: { id: orderItem.id },
        data: {
          deliveredQuantity: newDelivered,
          pendingQuantity: Math.max(0, orderItem.quantity - newDelivered),
        },
      });
    }

    const order = await transaction.customerOrder.findFirst({
      where: { id: delivery.orderId, tenantId: delivery.tenantId },
      select: { status: true, total: true, customerId: true, reference: true },
    });
    // Solo el ciclo normal habilita el cierre: el pedido debe haber estado LISTO
    // o EN CAMINO para marcarse como ENTREGADO.
    if (!order || !["ready", "on_the_way"].includes(order.status)) return;

    const orderItems = await transaction.orderItem.findMany({
      where: { orderId: delivery.orderId },
      select: { quantity: true, deliveredQuantity: true },
    });
    const allDelivered =
      orderItems.length > 0 && orderItems.every((item) => item.deliveredQuantity >= item.quantity);
    if (!allDelivered) return;

    const changed = await transaction.customerOrder.updateMany({
      where: { id: delivery.orderId, tenantId: delivery.tenantId, status: order.status },
      data: { status: "delivered" },
    });
    if (changed.count !== 1) return;

    await transaction.orderStatusHistory.create({
      data: {
        orderId: delivery.orderId,
        userId: opts.userId,
        fromStatus: order.status,
        toStatus: "delivered",
        note: "Entregado por el repartidor",
      },
    });
    await awardOrderLoyalty(transaction, {
      id: delivery.orderId,
      customerId: order.customerId,
      reference: order.reference,
      total: Number(order.total),
    });
  }
}