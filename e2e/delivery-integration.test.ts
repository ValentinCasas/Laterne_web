/**
 * Pruebas de integración de la entrega automática contra la base real de
 * desarrollo. Crea un tenant aislado, verifica las invariantes del módulo
 * Delivery y borra todo al terminar. Se excluye del suite por defecto
 * (directorio `e2e/`); correr con:
 *   npx vitest run e2e/delivery-integration.test.ts
 */
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureDeliveryForOrder, requiresDelivery, assertOrderCancellable, type DeliveryOrderInput } from "@/lib/delivery-orders";
import { applyDeliveryStatusToOrder } from "@/lib/delivery-sync";
import { deliveryDetailInclude } from "@/lib/delivery-detail";
import { canRetireDelivery } from "@/lib/delivery-drivers";

describe("integración delivery (DB real)", () => {
  let tenantId = -1;
  let branchId = -1;
  const createdOrderIds: number[] = [];

  async function makeOrder(orderType: string): Promise<DeliveryOrderInput> {
    const reference = `TEST-${randomBytes(6).toString("hex").toUpperCase()}`;
    const order = await prisma.customerOrder.create({
      data: {
        tenantId,
        branchId,
        reference,
        publicTokenHash: randomBytes(32).toString("hex"),
        status: "received",
        orderType,
        channel: orderType === "delivery" ? "DELIVERY" : "MOSTRADOR",
        customerName: "Cliente Test",
        phone: "0000000000",
        deliveryAddress: orderType === "delivery" ? "Calle test 123" : null,
        subtotal: new Prisma.Decimal(100),
        total: new Prisma.Decimal(100),
        items: {
          create: [{ productName: "Producto Test", quantity: 2, unitPrice: new Prisma.Decimal(50), lineTotal: new Prisma.Decimal(100) }],
        },
      },
      include: { items: true },
    });
    createdOrderIds.push(order.id);
    return {
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
    };
  }

  beforeAll(async () => {
    const suffix = randomBytes(6).toString("hex");
    const tenant = await prisma.tenant.create({
      data: {
        name: "Test Delivery",
        slug: `test-delivery-${suffix}`,
        publicGuid: randomBytes(16).toString("hex"),
      },
    });
    tenantId = tenant.id;
    const branch = await prisma.branch.create({
      data: { tenantId, name: "Principal", slug: "principal", address: "Dirección test", orderPrefix: "PED" },
    });
    branchId = branch.id;
  });

  afterAll(async () => {
    if (tenantId > 0) {
      await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => undefined);
    }
  });

  it("un pedido delivery crea una sola entrega SIN ASIGNAR con su sucursal", async () => {
    const order = await makeOrder("delivery");
    const delivery = await ensureDeliveryForOrder(prisma, order);
    expect(delivery.status).toBe("PENDING_ASSIGNMENT");
    expect(delivery.tenantId).toBe(tenantId);
    expect(delivery.branchId).toBe(branchId);
    expect(delivery.orderId).toBe(order.id);
    expect(delivery.customerName).toBe("Cliente Test");
    expect(delivery.deliveryAddress).toBe("Calle test 123");
    expect(delivery.items).toHaveLength(1);
    expect(delivery.items[0].quantityDelivered).toBe(2);
    expect(delivery.items[0].productName).toBe("Producto Test");

    const total = await prisma.orderDelivery.count({ where: { orderId: order.id } });
    expect(total).toBe(1);
  });

  it("conserva el punto exacto confirmado por el cliente", async () => {
    const order = await makeOrder("delivery");
    order.latitude = -33.3017123;
    order.longitude = -66.3378456;
    const delivery = await ensureDeliveryForOrder(prisma, order);
    expect(Number(delivery.latitude)).toBeCloseTo(-33.3017123, 6);
    expect(Number(delivery.longitude)).toBeCloseTo(-66.3378456, 6);
  });

  it("reintentar la creación no duplica la entrega (idempotente)", async () => {
    const order = await makeOrder("delivery");
    const first = await ensureDeliveryForOrder(prisma, order);
    const second = await ensureDeliveryForOrder(prisma, order);
    expect(second.id).toBe(first.id);
    const total = await prisma.orderDelivery.count({ where: { orderId: order.id } });
    expect(total).toBe(1);
  });

  it("retiro y mesa no generan entrega", async () => {
    expect(requiresDelivery("takeaway")).toBe(false);
    expect(requiresDelivery("dine_in")).toBe(false);
    const takeaway = await makeOrder("takeaway");
    const dineIn = await makeOrder("dine_in");
    const count = await prisma.orderDelivery.count({
      where: { orderId: { in: [takeaway.id, dineIn.id] } },
    });
    expect(count).toBe(0);
  });

  it("cancelar una entrega libera la creación de una nueva SIN ASIGNAR", async () => {
    const order = await makeOrder("delivery");
    const first = await ensureDeliveryForOrder(prisma, order);
    await prisma.orderDelivery.update({ where: { id: first.id }, data: { status: "CANCELLED" } });
    const second = await ensureDeliveryForOrder(prisma, order);
    expect(second.id).not.toBe(first.id);
    expect(second.status).toBe("PENDING_ASSIGNMENT");
    const actives = await prisma.orderDelivery.count({
      where: { orderId: order.id, status: { in: ["PENDING_ASSIGNMENT", "ASSIGNED", "PICKED_UP", "ON_THE_WAY", "INCIDENT"] } },
    });
    expect(actives).toBe(1);
  });

  it("el tenant A no accede a entregas del tenant B", async () => {
    const order = await makeOrder("delivery");
    await ensureDeliveryForOrder(prisma, order);
    const foreign = await prisma.orderDelivery.findFirst({
      where: { orderId: order.id, tenantId: tenantId + 999 },
    });
    expect(foreign).toBeNull();
    const owned = await prisma.orderDelivery.findFirst({
      where: { orderId: order.id, tenantId },
    });
    expect(owned).not.toBeNull();
  });

  it("el detalle canónico incluye items, pedido y sucursal (contrato del centro de delivery)", async () => {
    const order = await makeOrder("delivery");
    const delivery = await ensureDeliveryForOrder(prisma, order);
    const detail = await prisma.orderDelivery.findFirstOrThrow({
      where: { id: delivery.id, tenantId },
      include: deliveryDetailInclude,
    });
    expect(Array.isArray(detail.items)).toBe(true);
    expect(detail.items).toHaveLength(1);
    expect(detail.order?.id).toBe(order.id);
    expect(detail.order?.status).toBe("received");
    expect(detail.branch?.id).toBe(branchId);
  });

  it("el repartidor no puede retirar antes de LISTO y sí cuando el pedido está listo", async () => {
    const order = await makeOrder("delivery");
    expect(canRetireDelivery("received")).toBe(false);
    expect(canRetireDelivery("confirmed")).toBe(false);
    expect(canRetireDelivery("preparing")).toBe(false);
    await prisma.customerOrder.update({ where: { id: order.id }, data: { status: "preparing" } });
    expect(canRetireDelivery("preparing")).toBe(false);
    await prisma.customerOrder.update({ where: { id: order.id }, data: { status: "ready" } });
    expect(canRetireDelivery("ready")).toBe(true);
    expect(canRetireDelivery("on_the_way")).toBe(true);
  });

  it("EN CAMINO sincroniza el pedido a en camino con historial", async () => {
    const order = await makeOrder("delivery");
    await ensureDeliveryForOrder(prisma, order);
    await prisma.customerOrder.update({ where: { id: order.id }, data: { status: "ready" } });
    await prisma.$transaction((tx) =>
      applyDeliveryStatusToOrder(tx, { orderId: order.id, tenantId, status: "ON_THE_WAY", items: [] }, { userId: 0 }),
    );
    const updated = await prisma.customerOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.status).toBe("on_the_way");
    const history = await prisma.orderStatusHistory.count({
      where: { orderId: order.id, toStatus: "on_the_way" },
    });
    expect(history).toBeGreaterThan(0);
  });

  it("ENTREGADO despacha las líneas y cierra el pedido como entregado", async () => {
    const order = await makeOrder("delivery");
    const delivery = await ensureDeliveryForOrder(prisma, order);
    await prisma.customerOrder.update({ where: { id: order.id }, data: { status: "ready" } });
    await prisma.$transaction((tx) =>
      applyDeliveryStatusToOrder(tx, { orderId: order.id, tenantId, status: "ON_THE_WAY", items: [] }, { userId: 0 }),
    );
    await prisma.$transaction((tx) =>
      applyDeliveryStatusToOrder(
        tx,
        {
          orderId: order.id,
          tenantId,
          status: "DELIVERED",
          items: delivery.items.map((item) => ({ orderItemId: item.orderItemId, quantityDelivered: item.quantityDelivered })),
        },
        { userId: 0 },
      ),
    );
    const orderItem = await prisma.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    expect(orderItem.deliveredQuantity).toBe(orderItem.quantity);
    expect(orderItem.pendingQuantity).toBe(0);
    const updated = await prisma.customerOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.status).toBe("delivered");
  });

  it("ENTREGADO parcial no cierra el pedido", async () => {
    const order = await makeOrder("delivery");
    const delivery = await ensureDeliveryForOrder(prisma, order);
    await prisma.customerOrder.update({ where: { id: order.id }, data: { status: "ready" } });
    await prisma.$transaction((tx) =>
      applyDeliveryStatusToOrder(tx, { orderId: order.id, tenantId, status: "ON_THE_WAY", items: [] }, { userId: 0 }),
    );
    await prisma.$transaction((tx) =>
      applyDeliveryStatusToOrder(
        tx,
        {
          orderId: order.id,
          tenantId,
          status: "DELIVERED",
          items: delivery.items.map((item) => ({ orderItemId: item.orderItemId, quantityDelivered: 1 })),
        },
        { userId: 0 },
      ),
    );
    const orderItem = await prisma.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    expect(orderItem.deliveredQuantity).toBe(1);
    const updated = await prisma.customerOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.status).toBe("on_the_way");
  });

  it("cancelar un pedido con entrega EN CAMINO se bloquea y con SIN ASIGNAR no", async () => {
    const order = await makeOrder("delivery");
    const delivery = await ensureDeliveryForOrder(prisma, order);
    await prisma.customerOrder.update({ where: { id: order.id }, data: { status: "ready" } });
    await prisma.orderDelivery.update({ where: { id: delivery.id }, data: { status: "ASSIGNED" } });
    await prisma.$transaction((tx) =>
      applyDeliveryStatusToOrder(tx, { orderId: order.id, tenantId, status: "ON_THE_WAY", items: [] }, { userId: 0 }),
    );
    await prisma.orderDelivery.update({ where: { id: delivery.id }, data: { status: "ON_THE_WAY" } });
    await expect(
      prisma.$transaction((tx) => assertOrderCancellable(tx, order.id, tenantId)),
    ).rejects.toThrow("DELIVERY_EN_ROUTE");

    const fresh = await makeOrder("delivery");
    await ensureDeliveryForOrder(prisma, fresh);
    await expect(
      prisma.$transaction((tx) => assertOrderCancellable(tx, fresh.id, tenantId)),
    ).resolves.toBeUndefined();
  });
});
