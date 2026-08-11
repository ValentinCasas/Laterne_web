import type { Prisma } from "@prisma/client";

/** @summary Etiquetas claras para cada tipo de movimiento de inventario registrado. */
export const stockMovementTypeLabels: Record<string, string> = {
  order: "Consumo por pedido",
  order_return: "Devolución por cancelación",
  manual_in: "Ajuste manual",
  manual_out: "Ajuste manual",
};

/**
 * @summary Restituye el stock consumido por un pedido cuando se cancela o rechaza.
 * Solo repone unidades que realmente fueron consumidas (movimientos type "order" con cantidad negativa),
 * por lo que no inventa stock para productos sin control activado.
 *
 * Es idempotente: si el pedido ya tiene un movimiento de devolución ("order_return"),
 * no restituye nada por segunda vez. Se apoya en la transacción que lo invoca para
 * que la restitución quede atómica con el cambio de estado del pedido.
 */
export async function restoreOrderStock(
  transaction: Prisma.TransactionClient,
  order: { id: number; reference: string },
): Promise<boolean> {
  const alreadyReturned = await transaction.stockMovement.findFirst({
    where: { orderId: order.id, type: "order_return" },
    select: { id: true },
  });
  if (alreadyReturned) return false;

  const consumed = await transaction.stockMovement.findMany({
    where: { orderId: order.id, type: "order", quantity: { lt: 0 } },
  });
  if (consumed.length === 0) return false;

  for (const movement of consumed) {
    const stock = await transaction.inventoryStock.findUnique({ where: { id: movement.stockId } });
    if (!stock) continue;
    const restored = movement.quantity.abs();
    await transaction.inventoryStock.update({
      where: { id: stock.id },
      data: { current: { increment: restored } },
    });
    const updated = await transaction.inventoryStock.findUniqueOrThrow({ where: { id: stock.id } });
    await transaction.stockMovement.create({
      data: {
        tenantId: movement.tenantId,
        stockId: stock.id,
        orderId: order.id,
        type: "order_return",
        quantity: restored,
        balanceAfter: updated.current,
        reason: `Devolución por cancelación del pedido ${order.reference}`,
      },
    });
  }
  return true;
}
