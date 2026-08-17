/**
 * Repara pedidos DELIVERY que no tienen entrega: crea una entrega SIN ASIGNAR
 * de forma idempotente y segura. No borra datos ni toca otros pedidos.
 *
 * Uso:
 *   node --env-file=.env --experimental-strip-types scripts/backfill-deliveries.mts
 */
import { PrismaClient } from "@prisma/client";
import { ensureDeliveryForOrder, ACTIVE_DELIVERY_STATUSES } from "../lib/delivery-orders.ts";

const prisma = new PrismaClient();

async function main() {
  const orders = await prisma.customerOrder.findMany({
    where: {
      orderType: "delivery",
      status: { notIn: ["cancelled", "delivered"] },
      deliveries: { none: { status: { in: [...ACTIVE_DELIVERY_STATUSES] } } },
    },
    include: { items: true },
  });

  let created = 0;
  const skipped: string[] = [];

  for (const order of orders) {
    if (order.items.length === 0) {
      skipped.push(`${order.reference} (sin líneas)`);
      continue;
    }
    const delivery = await prisma.$transaction((tx) =>
      ensureDeliveryForOrder(tx, {
        id: order.id,
        tenantId: order.tenantId,
        branchId: order.branchId,
        customerId: order.customerId,
        customerName: order.customerName,
        deliveryAddress: order.deliveryAddress,
        items: order.items.map((item) => ({
          id: item.id,
          productId: item.productId,
          productName: item.productName,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
        })),
      }),
    );
    if (delivery.status === "PENDING_ASSIGNMENT") {
      created += 1;
    }
  }

  console.log(`Pedidos DELIVERY sin entrega procesados: ${orders.length}`);
  console.log(`Entregas SIN ASIGNAR creadas: ${created}`);
  if (skipped.length > 0) {
    console.log(`Omitidos: ${skipped.join(", ")}`);
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