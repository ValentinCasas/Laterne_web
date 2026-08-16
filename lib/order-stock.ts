import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** @summary Etiquetas claras para cada tipo de movimiento de inventario registrado. */
export const stockMovementTypeLabels: Record<string, string> = {
  order: "Consumo por pedido",
  order_return: "Devolución por cancelación",
  manual_in: "Ajuste manual",
  manual_out: "Ajuste manual",
};

/**
 * @summary Prevalida que haya stock suficiente para las cantidades pedidas y devuelve las existencias controladas.
 * Lanza un error con mensaje legible cuando algún producto no alcanza; no descuenta nada.
 */
export async function assertStockAvailability(
  tenantId: number,
  branchId: number,
  quantities: Map<number, number>,
  productName: (productId: number) => string,
) {
  const productIds = [...quantities.keys()];
  const stocks = await prisma.inventoryStock.findMany({
    where: { tenantId, branchId, productId: { in: productIds }, tracked: true },
  });
  const low = stocks.find((stock) => Number(stock.current) < (quantities.get(stock.productId) ?? 0));
  if (low) {
    throw new Error(`${productName(low.productId) || "Un producto"} no tiene stock suficiente`);
  }
  return stocks;
}

/**
 * @summary Descuenta el stock dentro de la transacción del pedido, registra movimientos y alertas de mínimo.
 * Debe ejecutarse con la misma transacción que crea el pedido para que todo sea atómico.
 */
export async function consumeOrderStock(
  transaction: Prisma.TransactionClient,
  input: {
    tenantId: number;
    branchId: number;
    orderId: number;
    reference: string;
    quantities: Map<number, number>;
    /** Existencias controladas devueltas por `assertStockAvailability`. */
    stocks: Array<{ id: number; productId: number }>;
    productName: (productId: number) => string;
  },
) {
  for (const stock of input.stocks) {
    const quantity = input.quantities.get(stock.productId) ?? 0;
    if (!quantity) continue;
    const result = await transaction.inventoryStock.updateMany({
      where: { id: stock.id, tracked: true, current: { gte: quantity } },
      data: { current: { decrement: quantity } },
    });
    if (result.count !== 1) throw new Error("El stock cambió mientras confirmabas el pedido");
    const updated = await transaction.inventoryStock.findUniqueOrThrow({ where: { id: stock.id } });
    await transaction.stockMovement.create({
      data: {
        tenantId: input.tenantId,
        stockId: stock.id,
        orderId: input.orderId,
        type: "order",
        quantity: -quantity,
        balanceAfter: updated.current,
        reason: `Pedido ${input.reference}`,
      },
    });
    if (Number(updated.current) <= Number(updated.minimum)) {
      await transaction.notification.create({
        data: {
          tenantId: input.tenantId,
          branchId: input.branchId,
          type: "stock.low",
          title: `Stock bajo · ${input.productName(stock.productId) || "Producto"}`,
          message: `Quedaron ${Number(updated.current)} ${updated.unit}.`,
          link: "/admin/inventario",
        },
      });
    }
  }
}

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
