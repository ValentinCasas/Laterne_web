import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { restoreOrderStock, stockMovementTypeLabels } from "@/lib/order-stock";

type FakeMovement = {
  id: number;
  tenantId: number;
  stockId: number;
  orderId: number | null;
  type: string;
  quantity: Prisma.Decimal;
  balanceAfter: Prisma.Decimal;
  reason: string;
};

function fakeTransaction(initialStocks: Map<number, { current: number; productId: number }>) {
  const movements: FakeMovement[] = [];
  const stocks = new Map(initialStocks);
  let movementId = 0;
  const transaction = {
    stockMovement: {
      findFirst: async ({ where }: { where: { orderId: number; type: string } }) =>
        movements.find((m) => m.orderId === where.orderId && m.type === where.type) ?? null,
      findMany: async ({ where }: { where: { orderId: number; type: string; quantity: { lt: number } } }) =>
        movements.filter(
          (m) =>
            m.orderId === where.orderId && m.type === where.type && m.quantity.lessThan(where.quantity.lt),
        ),
      create: async ({ data }: { data: Omit<FakeMovement, "id"> }) => {
        const movement = { ...data, id: ++movementId };
        movements.push(movement);
        return movement;
      },
    },
    inventoryStock: {
      findUnique: async ({ where }: { where: { id: number } }) => {
        const stock = stocks.get(where.id);
        if (!stock) return null;
        return { id: where.id, ...stock };
      },
      findUniqueOrThrow: async ({ where }: { where: { id: number } }) => {
        const stock = stocks.get(where.id);
        if (!stock) throw new Error("Stock inexistente");
        return { id: where.id, ...stock };
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: number };
        data: { current: { increment: Prisma.Decimal } };
      }) => {
        const stock = stocks.get(where.id);
        if (!stock) throw new Error("Stock inexistente");
        stock.current += Number(data.current.increment);
        return { id: where.id, ...stock };
      },
    },
  } as unknown as Prisma.TransactionClient;
  return { transaction, movements, stocks };
}

describe("restoreOrderStock", () => {
  it("restituye el stock consumido por un pedido cancelado y registra la devolución", async () => {
    const stocks = new Map([
      [1, { current: 2, productId: 10 }],
      [2, { current: 5, productId: 11 }],
    ]);
    const { transaction, movements } = fakeTransaction(stocks);
    await transaction.stockMovement.create({
      data: {
        tenantId: 7,
        stockId: 1,
        orderId: 42,
        type: "order",
        quantity: new Prisma.Decimal(-3),
        balanceAfter: new Prisma.Decimal(2),
        reason: "Pedido PED-1",
      },
    });
    await transaction.stockMovement.create({
      data: {
        tenantId: 7,
        stockId: 2,
        orderId: 42,
        type: "order",
        quantity: new Prisma.Decimal(-1),
        balanceAfter: new Prisma.Decimal(5),
        reason: "Pedido PED-1",
      },
    });

    const restored = await restoreOrderStock(transaction, { id: 42, reference: "PED-1" });

    expect(restored).toBe(true);
    expect(stocks.get(1)!.current).toBe(5);
    expect(stocks.get(2)!.current).toBe(6);
    const returns = movements.filter((m) => m.type === "order_return");
    expect(returns).toHaveLength(2);
    expect(returns[0].quantity.toString()).toBe("3");
    expect(returns[0].balanceAfter.toString()).toBe("5");
    expect(returns[1].quantity.toString()).toBe("1");
    expect(returns[1].balanceAfter.toString()).toBe("6");
  });

  it("no restituye dos veces (idempotente)", async () => {
    const stocks = new Map([[1, { current: 4, productId: 10 }]]);
    const { transaction, movements } = fakeTransaction(stocks);
    await transaction.stockMovement.create({
      data: {
        tenantId: 7,
        stockId: 1,
        orderId: 42,
        type: "order",
        quantity: new Prisma.Decimal(-2),
        balanceAfter: new Prisma.Decimal(4),
        reason: "Pedido PED-1",
      },
    });

    const first = await restoreOrderStock(transaction, { id: 42, reference: "PED-1" });
    const second = await restoreOrderStock(transaction, { id: 42, reference: "PED-1" });

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(stocks.get(1)!.current).toBe(6);
    expect(movements.filter((m) => m.type === "order_return")).toHaveLength(1);
  });

  it("no toca stock si el pedido nunca consumió (producto sin control)", async () => {
    const stocks = new Map([[1, { current: 9, productId: 10 }]]);
    const { transaction, movements } = fakeTransaction(stocks);

    const restored = await restoreOrderStock(transaction, { id: 42, reference: "PED-1" });

    expect(restored).toBe(false);
    expect(stocks.get(1)!.current).toBe(9);
    expect(movements).toHaveLength(0);
  });

  it("omite existencias eliminadas sin romper el resto", async () => {
    const stocks = new Map([[2, { current: 5, productId: 11 }]]);
    const { transaction, movements } = fakeTransaction(stocks);
    await transaction.stockMovement.create({
      data: {
        tenantId: 7,
        stockId: 1,
        orderId: 42,
        type: "order",
        quantity: new Prisma.Decimal(-3),
        balanceAfter: new Prisma.Decimal(0),
        reason: "Pedido PED-1",
      },
    });
    await transaction.stockMovement.create({
      data: {
        tenantId: 7,
        stockId: 2,
        orderId: 42,
        type: "order",
        quantity: new Prisma.Decimal(-1),
        balanceAfter: new Prisma.Decimal(5),
        reason: "Pedido PED-1",
      },
    });

    const restored = await restoreOrderStock(transaction, { id: 42, reference: "PED-1" });

    expect(restored).toBe(true);
    expect(stocks.get(2)!.current).toBe(6);
    expect(movements.filter((m) => m.type === "order_return")).toHaveLength(1);
  });

  it("expone etiquetas claras para los tipos de movimiento", () => {
    expect(stockMovementTypeLabels.order).toBe("Consumo por pedido");
    expect(stockMovementTypeLabels.order_return).toBe("Devolución por cancelación");
    expect(stockMovementTypeLabels.manual_in).toBe("Ajuste manual");
    expect(stockMovementTypeLabels.manual_out).toBe("Ajuste manual");
  });
});
