/**
 * Repara combinaciones inconsistentes entre el ciclo del pedido y el ciclo de su
 * entrega (legado previo a la sincronización automática del módulo Delivery).
 * Es idempotente y conservador: solo aplica estados derivables con certeza,
 * jamás borra datos y las situaciones ambiguas solo se reportan.
 *
 * Uso:
 *   node --env-file=.env --experimental-strip-types scripts/repair-delivery-orders.mts
 */
import { PrismaClient } from "@prisma/client";
import { canRetireDelivery } from "../lib/delivery-drivers.ts";

const prisma = new PrismaClient();

async function main() {
  const deliveries = await prisma.orderDelivery.findMany({
    where: {
      status: { in: ["PENDING_ASSIGNMENT", "ASSIGNED", "PICKED_UP", "ON_THE_WAY", "DELIVERED", "INCIDENT"] },
    },
    include: {
      order: {
        select: {
          id: true,
          reference: true,
          status: true,
          items: { select: { id: true, quantity: true, deliveredQuantity: true } },
        },
      },
      items: { select: { orderItemId: true, quantityDelivered: true } },
    },
  });

  let ordersToOnTheWay = 0;
  let ordersToDelivered = 0;
  let itemsSynced = 0;
  const warnings: string[] = [];

  for (const delivery of deliveries) {
    if (!delivery.order) continue;
    const order = delivery.order;

    // 1) EN CAMINO con el pedido LISTO: el pedido pasa a en camino.
    if (delivery.status === "ON_THE_WAY" && order.status === "ready") {
      const already = await prisma.orderStatusHistory.findFirst({
        where: { orderId: order.id, toStatus: "on_the_way" },
        select: { id: true },
      });
      if (!already) {
        await prisma.customerOrder.updateMany({
          where: { id: order.id, status: "ready" },
          data: { status: "on_the_way" },
        });
        await prisma.orderStatusHistory.create({
          data: {
            orderId: order.id,
            fromStatus: "ready",
            toStatus: "on_the_way",
            note: "Pedido en camino (reparación)",
          },
        });
      }
      ordersToOnTheWay += 1;
      continue;
    }

    // 2) ENTREGADO: despacha las líneas y, si no quedó nada pendiente, cierra el pedido.
    if (delivery.status === "DELIVERED") {
      if (["delivered", "cancelled"].includes(order.status)) {
        if (order.status === "cancelled") {
          warnings.push(`${order.reference}: entrega entregada después de cancelado el pedido (no se modifica)`);
        }
        continue;
      }
      let changed = false;
      for (const item of delivery.items) {
        const orderItem = order.items.find((candidate) => candidate.id === item.orderItemId);
        if (!orderItem || orderItem.deliveredQuantity >= item.quantityDelivered) continue;
        await prisma.orderItem.update({
          where: { id: orderItem.id },
          data: {
            deliveredQuantity: item.quantityDelivered,
            pendingQuantity: Math.max(0, orderItem.quantity - item.quantityDelivered),
          },
        });
        changed = true;
        itemsSynced += 1;
      }
      const refreshed = await prisma.orderItem.findMany({
        where: { orderId: order.id },
        select: { quantity: true, deliveredQuantity: true },
      });
      const allDelivered = refreshed.length > 0 && refreshed.every((item) => item.deliveredQuantity >= item.quantity);
      if (allDelivered) {
        const already = await prisma.orderStatusHistory.findFirst({
          where: { orderId: order.id, toStatus: "delivered" },
          select: { id: true },
        });
        if (!already) {
          await prisma.customerOrder.updateMany({
            where: { id: order.id, status: { notIn: ["delivered", "cancelled"] } },
            data: { status: "delivered" },
          });
          await prisma.orderStatusHistory.create({
            data: {
              orderId: order.id,
              fromStatus: order.status,
              toStatus: "delivered",
              note: "Entrega completada (reparación)",
            },
          });
          ordersToDelivered += 1;
        }
      } else if (changed) {
        warnings.push(`${order.reference}: entrega entregada pero el pedido quedó parcial (se despacharon líneas)`);
      }
      continue;
    }

    // 3) Situaciones que requieren decisión humana: solo se reportan.
    if (delivery.status === "PICKED_UP" && !canRetireDelivery(order.status)) {
      warnings.push(`${order.reference}: retirado con el pedido en estado "${order.status}" (se deja como está)`);
    }
    if (
      ["PENDING_ASSIGNMENT", "ASSIGNED", "PICKED_UP", "INCIDENT"].includes(delivery.status) &&
      ["delivered", "cancelled"].includes(order.status)
    ) {
      warnings.push(`${order.reference}: entrega ${delivery.status} con pedido ${order.status} (requiere revisión)`);
    }
  }

  console.log(`Entregas revisadas: ${deliveries.length}`);
  console.log(`Pedidos a EN CAMINO sincronizados: ${ordersToOnTheWay}`);
  console.log(`Pedidos a ENTREGADO sincronizados: ${ordersToDelivered}`);
  console.log(`Líneas despachadas: ${itemsSynced}`);
  if (warnings.length > 0) {
    console.log("Advertencias (sin cambios):");
    for (const warning of warnings) console.log(`  - ${warning}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
