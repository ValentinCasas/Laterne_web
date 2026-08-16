import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { stockUnitCost, type StockPolicy } from "@/lib/inventory";

/** @summary Contenedor del cliente falso para inyectar la transacción de cada prueba. */
const holder = vi.hoisted(() => ({
  client: null as unknown as import("@prisma/client").Prisma.TransactionClient,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn((callback: (client: Prisma.TransactionClient) => Promise<unknown>) =>
      callback(holder.client as never),
    ),
    branch: { findMany: vi.fn() },
    inventorySettings: { upsert: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  completeCountSession,
  createCountSession,
  createStockTransfer,
  inventoryPolicy,
  registerWaste,
  reserveStock,
  updateCountSessionItems,
  updateInventoryPolicy,
} from "@/lib/inventory";

type ProductRef = { id: number; name: string; cost: Prisma.Decimal | null; costUnit: string };
type FakeStock = {
  id: number;
  tenantId: number;
  branchId: number;
  productId: number;
  tracked: boolean;
  current: number;
  reserved: number;
  minimum: number;
  unit: string;
  product?: ProductRef;
};

/** @summary Cliente falso con las operaciones que usan los servicios de inventario. */
function makeClient(initial: FakeStock[], options: { failUpdate?: boolean } = {}) {
  const stocks = new Map<number, FakeStock>(initial.map((stock) => [stock.id, { ...stock }]));
  const movements: Array<Record<string, unknown>> = [];
  const notifications: Array<Record<string, unknown>> = [];
  const transfers: Array<Record<string, unknown>> = [];
  let movementId = 0;
  let transferId = 0;
  let countItemId = 0;
  let countSessionId = 0;
  const countItems = new Map<number, Record<string, unknown>>();
  const countSessions: Array<Record<string, unknown>> = [];

  const withProduct = (stock: FakeStock): FakeStock & { product: ProductRef } => ({
    ...stock,
    product:
      stock.product ?? {
        id: stock.productId,
        name: `Producto ${stock.productId}`,
        cost: new Prisma.Decimal(100),
        costUnit: stock.unit, // El costo por defecto está expresado en la unidad de la existencia.
      },
  });

  const client = {
    inventoryStock: {
      findUnique: async ({ where, include }: { where: { id?: number; branchId_productId?: { branchId: number; productId: number } }; include?: { product?: unknown } }) => {
        const stock = where.id !== undefined
          ? stocks.get(where.id)
          : [...stocks.values()].find(
              (candidate) =>
                candidate.branchId === where.branchId_productId?.branchId &&
                candidate.productId === where.branchId_productId?.productId,
            );
        if (!stock) return null;
        return include?.product ? withProduct(stock) : stock;
      },
      findMany: async ({ include }: { include?: { product?: unknown } }) =>
        [...stocks.values()].map((stock) => (include?.product ? withProduct(stock) : stock)),
      findUniqueOrThrow: async ({ where }: { where: { id: number } }) => {
        const stock = stocks.get(where.id);
        if (!stock) throw new Error("Stock inexistente");
        return stock;
      },
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const stock = stocks.get(where.id as number);
        if (options.failUpdate || !stock) return { count: 0 };
        const required = Number((where as { current?: { gte: number } }).current?.gte ?? 0);
        const requiredReserved = Number((where as { reserved?: { gte: number } }).reserved?.gte ?? 0);
        if (stock.current < required || stock.reserved < requiredReserved) return { count: 0 };
        if (typeof (data as { current?: { decrement: number } }).current?.decrement === "number") {
          stock.current -= (data as { current: { decrement: number } }).current.decrement;
        }
        if (typeof (data as { current?: { increment: number } }).current?.increment === "number") {
          stock.current += (data as { current: { increment: number } }).current.increment;
        }
        if (typeof (data as { reserved?: { increment: number } }).reserved?.increment === "number") {
          stock.reserved += (data as { reserved: { increment: number } }).reserved.increment;
        }
        if (typeof (data as { reserved?: { decrement: number } }).reserved?.decrement === "number") {
          stock.reserved -= (data as { reserved: { decrement: number } }).reserved.decrement;
        }
        return { count: 1 };
      },
      update: async ({ where, data }: { where: { id: number }; data: Record<string, unknown> }) => {
        const stock = stocks.get(where.id);
        if (!stock) throw new Error("Stock inexistente");
        if (typeof (data as { current?: { increment: number } }).current?.increment === "number") {
          stock.current += (data as { current: { increment: number } }).current.increment;
        }
        return { ...stock };
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const stock = {
          id: 999,
          ...data,
          current: Number((data.current as number) ?? 0),
          reserved: 0,
          minimum: 0,
        } as unknown as FakeStock;
        stocks.set(stock.id, stock);
        return stock;
      },
    },
    unitConversion: {
      findMany: async () => [],
    },
    stockMovement: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const movement = { ...data, id: ++movementId };
        movements.push(movement);
        return movement;
      },
    },
    notification: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        notifications.push(data);
        return { id: 1, ...data };
      },
    },
    stockTransfer: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const transfer = { ...data, id: ++transferId };
        transfers.push(transfer);
        return transfer;
      },
    },
    inventoryCountSession: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const session = { ...data, id: ++countSessionId, items: [] as unknown[] };
        const createdItems = (data.items as { create: Array<Record<string, unknown>> }).create;
        for (const item of createdItems) {
          const source = stocks.get(item.stockId as number);
          const row = { id: ++countItemId, sessionId: session.id, ...item, stock: source ? withProduct(source) : null };
          countItems.set(row.id, row);
          session.items.push(row);
        }
        countSessions.push(session);
        return session;
      },
      findFirst: async ({ where }: { where: Record<string, unknown> }) =>
        countSessions.find((session) => session.id === where.id && (where.status ? session.status === where.status : true)) ?? null,
      update: async ({ where, data }: { where: { id: number }; data: Record<string, unknown> }) => {
        const session = countSessions.find((candidate) => candidate.id === where.id);
        if (!session) throw new Error("Sesión inexistente");
        Object.assign(session, data);
        return session;
      },
    },
    inventoryCountItem: {
      findFirst: async ({ where }: { where: { id: number; sessionId?: number } }) => {
        const item = countItems.get(where.id);
        if (!item || (where.sessionId !== undefined && item.sessionId !== where.sessionId)) return null;
        return item;
      },
      update: async ({ where, data }: { where: { id: number }; data: Record<string, unknown> }) => {
        const item = countItems.get(where.id);
        if (!item) throw new Error("Ítem inexistente");
        Object.assign(item, data);
        return item;
      },
    },
  };
  return { client, stocks, movements, notifications, transfers, countSessions, countItems };
}

/** @summary Crea una existencia controlada lista para las pruebas. */
function stock(overrides: Partial<FakeStock>): FakeStock {
  return {
    id: 1,
    tenantId: 7,
    branchId: 2,
    productId: 10,
    tracked: true,
    current: 10,
    reserved: 0,
    minimum: 2,
    unit: "kg",
    ...overrides,
  };
}

describe("stockUnitCost", () => {
  it("usa el costo directo cuando la unidad coincide", () => {
    expect(stockUnitCost({ cost: 150, costUnit: "unidad" }, { unit: "unidad" }, [])).toBe(150);
  });

  it("convierte el costo a la unidad de la existencia (kg → g)", () => {
    expect(stockUnitCost({ cost: 100, costUnit: "kg" }, { unit: "g" }, [])).toBeCloseTo(0.1, 6);
  });

  it("respeta conversiones personalizadas del negocio (1 bolsa = 25 kg)", () => {
    const conversions = [{ fromUnit: "bolsa", toUnit: "kg", factor: 25 }];
    // Costo 2500 ARS/kg → una bolsa (25 kg) vale 62.500 ARS.
    expect(stockUnitCost({ cost: 2500, costUnit: "kg" }, { unit: "bolsa" }, conversions)).toBeCloseTo(62500, 2);
  });

  it("devuelve null cuando el costo falta o la unidad no se puede convertir", () => {
    expect(stockUnitCost({ cost: null, costUnit: "kg" }, { unit: "g" }, [])).toBeNull();
    expect(stockUnitCost({ cost: 100, costUnit: "kg" }, { unit: "caja" }, [])).toBeNull();
  });
});

describe("inventoryPolicy", () => {
  it("por defecto es estricta", async () => {
    const client = { inventorySettings: { findUnique: async () => null } } as never;
    expect(await inventoryPolicy(7, client)).toEqual({ stockPolicy: "strict" });
  });

  it("respeta la configuración permisiva", async () => {
    const client = {
      inventorySettings: { findUnique: async () => ({ stockPolicy: "warn" as StockPolicy }) },
    } as never;
    expect(await inventoryPolicy(7, client)).toEqual({ stockPolicy: "warn" });
  });

  it("rechaza políticas inválidas al actualizar", async () => {
    await expect(updateInventoryPolicy(7, "bogus" as StockPolicy)).rejects.toThrow(/inválida/);
  });
});

describe("registerWaste", () => {
  it("descuenta stock, guarda snapshot de costo y registra el movimiento", async () => {
    const { client, stocks, movements } = makeClient([stock({})]);
    holder.client = client as never;
    const result = await registerWaste(7, 2, { productId: 10, quantity: 2, reason: "Se rompió la bolsa" });

    expect(stocks.get(1)!.current).toBe(8);
    expect(result.stockId).toBe(1);
    const movement = movements.find((entry) => entry.type === "waste");
    expect(movement).toBeDefined();
    expect(String((movement as { quantity: Prisma.Decimal }).quantity)).toBe("-2");
    expect(Number((movement as { unitCost: number }).unitCost)).toBeCloseTo(100, 6);
    expect(String((movement as { reference: string }).reference)).toMatch(/^MER-/);
  });

  it("convierte la cantidad a la unidad de la existencia", async () => {
    const { client, stocks } = makeClient([stock({ unit: "g", current: 5000 })]);
    holder.client = client as never;
    await registerWaste(7, 2, { productId: 10, quantity: 1, unit: "kg", reason: "Caducó un kilo" });
    // 1 kg → 1000 g
    expect(stocks.get(1)!.current).toBe(4000);
  });

  it("no registra merma sin stock suficiente (guarda atómica)", async () => {
    const { client, stocks, movements } = makeClient([stock({ current: 1 })]);
    holder.client = client as never;
    await expect(
      registerWaste(7, 2, { productId: 10, quantity: 2, reason: "Merma de prueba" }),
    ).rejects.toThrow(/stock suficiente/);
    expect(stocks.get(1)!.current).toBe(1);
    expect(movements).toHaveLength(0);
  });

  it("avisa cuando queda bajo el mínimo", async () => {
    const { client, notifications } = makeClient([stock({ current: 5, minimum: 4 })]);
    holder.client = client as never;
    await registerWaste(7, 2, { productId: 10, quantity: 2, reason: "Merma de prueba" });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].type).toBe("stock.low");
  });
});

describe("reserveStock", () => {
  it("reserva comprometiendo unidades y registra el movimiento con reservedAfter", async () => {
    const { client, stocks, movements } = makeClient([stock({ current: 10 })]);
    holder.client = client as never;
    const result = await reserveStock(7, 2, { productId: 10, quantity: 3, reason: "Reserva evento", action: "reserve" });

    expect(stocks.get(1)!.reserved).toBe(3);
    expect(Number(result.stock.reserved)).toBe(3);
    const movement = movements.find((entry) => entry.type === "reserve");
    expect(Number((movement as { reservedAfter: number }).reservedAfter)).toBe(3);
    expect(String((movement as { reference: string }).reference)).toMatch(/^RES-/);
  });

  it("no reserva más que el físico disponible", async () => {
    const { client, stocks } = makeClient([stock({ current: 10 })]);
    holder.client = client as never;
    await expect(
      reserveStock(7, 2, { productId: 10, quantity: 11, reason: "Reserva evento", action: "reserve" }),
    ).rejects.toThrow(/disponible/);
    expect(stocks.get(1)!.reserved).toBe(0);
  });

  it("libera reservas sin bajar de cero", async () => {
    const { client, stocks, movements } = makeClient([stock({ current: 10, reserved: 5 })]);
    holder.client = client as never;
    await reserveStock(7, 2, { productId: 10, quantity: 4, reason: "Se liberó parte", action: "release" });
    expect(stocks.get(1)!.reserved).toBe(1);
    expect(movements.some((entry) => entry.type === "release")).toBe(true);

    await expect(
      reserveStock(7, 2, { productId: 10, quantity: 2, reason: "Liberación inválida", action: "release" }),
    ).rejects.toThrow(/reservadas/);
  });
});

describe("createStockTransfer", () => {
  it("aplica salida y entrada atómicas con conversión de unidades", async () => {
    vi.mocked(prisma.branch.findMany).mockResolvedValue([{ id: 2 }, { id: 3 }] as never);
    const { client, stocks, movements, transfers } = makeClient([
      stock({ branchId: 2, productId: 10, unit: "kg", current: 20 }),
      stock({ id: 2, branchId: 3, productId: 10, unit: "g", current: 100 }),
    ]);
    holder.client = client as never;

    const result = await createStockTransfer(7, {
      fromBranchId: 2,
      toBranchId: 3,
      productId: 10,
      quantity: 2,
      userId: null,
    });

    expect(stocks.get(1)!.current).toBe(18);
    expect(stocks.get(2)!.current).toBe(2100);
    expect(result.transfer.status).toBe("completed");
    expect(String(result.transfer.reference)).toMatch(/^TRF-/);
    expect(movements.some((entry) => entry.type === "transfer_out" && String((entry as { quantity: Prisma.Decimal }).quantity) === "-2")).toBe(true);
    expect(movements.some((entry) => entry.type === "transfer_in" && String((entry as { quantity: Prisma.Decimal }).quantity) === "2000")).toBe(true);
    expect(transfers).toHaveLength(1);
  });

  it("crea existencias en el destino cuando no tenía stock", async () => {
    vi.mocked(prisma.branch.findMany).mockResolvedValue([{ id: 2 }, { id: 3 }] as never);
    const { client, stocks } = makeClient([stock({ branchId: 2, productId: 10, current: 20 })]);
    holder.client = client as never;

    await createStockTransfer(7, { fromBranchId: 2, toBranchId: 3, productId: 10, quantity: 2 });

    const destination = [...stocks.values()].find((entry) => entry.branchId === 3);
    expect(destination).toBeDefined();
    expect(destination!.current).toBe(2);
  });

  it("bloquea la transferencia sin stock en el origen sin tocar el destino", async () => {
    vi.mocked(prisma.branch.findMany).mockResolvedValue([{ id: 2 }, { id: 3 }] as never);
    const { client, stocks, movements } = makeClient([
      stock({ branchId: 2, productId: 10, current: 1 }),
      stock({ id: 2, branchId: 3, productId: 10, current: 100 }),
    ]);
    holder.client = client as never;

    await expect(
      createStockTransfer(7, { fromBranchId: 2, toBranchId: 3, productId: 10, quantity: 5 }),
    ).rejects.toThrow(/origen no tiene stock/);
    expect(stocks.get(1)!.current).toBe(1);
    expect(stocks.get(2)!.current).toBe(100);
    expect(movements).toHaveLength(0);
  });

  it("valida que ambas sucursales pertenezcan al negocio", async () => {
    vi.mocked(prisma.branch.findMany).mockResolvedValue([{ id: 2 }] as never);
    const { client } = makeClient([stock({ branchId: 2, current: 20 })]);
    holder.client = client as never;
    await expect(
      createStockTransfer(7, { fromBranchId: 2, toBranchId: 99, productId: 10, quantity: 1 }),
    ).rejects.toThrow(/no pertenece al negocio/);
  });
});

describe("conteos físicos", () => {
  it("abre la sesión con la cantidad de sistema de cada existencia", async () => {
    const { client } = makeClient([
      stock({ productId: 10, current: 5, unit: "kg" }),
      stock({ id: 2, productId: 11, current: 8, unit: "unidad" }),
    ]);
    holder.client = client as never;
    const session = await createCountSession(7, 2, {});
    expect(String(session.reference)).toMatch(/^CNT-/);
    expect(session.status).toBe("open");
    expect(session.items).toHaveLength(2);
    expect(Number((session.items[0] as { systemQuantity: Prisma.Decimal }).systemQuantity)).toBe(5);
    expect(Number((session.items[0] as { difference: Prisma.Decimal }).difference)).toBe(0);
  });

  it("registra cantidades contadas y recalcula diferencias", async () => {
    const { client, countSessions } = makeClient([stock({ current: 5 })]);
    holder.client = client as never;
    const session = await createCountSession(7, 2, {});
    const itemId = (session.items[0] as { id: number }).id;

    const result = await updateCountSessionItems(7, session.id, [{ id: itemId, countedQuantity: 4.5 }]);
    expect(Number((result.items[0] as { difference: Prisma.Decimal }).difference)).toBeCloseTo(-0.5, 6);
    expect(countSessions[0].status).toBe("open");
  });

  it("completa el conteo aplicando ajustes como movimientos", async () => {
    const { client, stocks, movements, countSessions } = makeClient([stock({ current: 5 })]);
    holder.client = client as never;
    const session = await createCountSession(7, 2, {});
    const itemId = (session.items[0] as { id: number }).id;
    await updateCountSessionItems(7, session.id, [{ id: itemId, countedQuantity: 7 }]);

    const result = await completeCountSession(7, session.id, 42);

    expect(stocks.get(1)!.current).toBe(7);
    expect(result.adjustments).toBe(1);
    expect(countSessions[0].status).toBe("completed");
    const movement = movements.find((entry) => entry.type === "count_adjustment");
    expect(movement).toBeDefined();
    expect(String((movement as { quantity: Prisma.Decimal }).quantity)).toBe("2");
    expect(String((movement as { reference: string }).reference)).toMatch(/^CNT-/);
  });

  it("no aplica ajustes negativos sin stock suficiente (guarda atómica)", async () => {
    // El conteo baja de 0.5 a 0; sin la guarda atómica una carrera podría dejar stock negativo.
    const { client, stocks } = makeClient([stock({ current: 0.5 })], { failUpdate: true });
    holder.client = client as never;
    const session = await createCountSession(7, 2, {});
    const itemId = (session.items[0] as { id: number }).id;
    await updateCountSessionItems(7, session.id, [{ id: itemId, countedQuantity: 0 }]);

    await expect(completeCountSession(7, session.id)).rejects.toThrow(/Recontalo/);
    expect(stocks.get(1)!.current).toBeCloseTo(0.5, 6);
  });
});
