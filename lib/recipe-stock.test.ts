import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import {
  buildRecipeConsumptionPlan,
  consumeRecipeStock,
  planConsumptionFromContext,
} from "@/lib/recipe-stock";
import type { RecipeCostInfo, RecipeGraph } from "@/lib/recipes";

/** @summary Construye un mapa de costo simple para pruebas. */
function costInfo(
  entries: Array<{ id: number; name: string; cost: number | null; costUnit?: string; hasRecipe?: boolean }>,
) {
  return new Map<number, RecipeCostInfo>(
    entries.map((entry) => [
      entry.id,
      {
        id: entry.id,
        name: entry.name,
        cost: entry.cost,
        costUnit: entry.costUnit ?? "unidad",
        hasRecipe: entry.hasRecipe ?? false,
      },
    ]),
  );
}

describe("planConsumptionFromContext", () => {
  const info = costInfo([
    { id: 10, name: "Harina", cost: 100, costUnit: "kg" },
    { id: 11, name: "Muzzarella", cost: 200, costUnit: "kg" },
    { id: 12, name: "Masa", cost: null, costUnit: "unidad", hasRecipe: true },
    { id: 13, name: "Gaseosa", cost: 500, costUnit: "unidad" },
    { id: 20, name: "Pizza", cost: null, costUnit: "unidad", hasRecipe: true },
    { id: 21, name: "Combo Pizza + Gaseosa", cost: null, costUnit: "unidad", hasRecipe: false },
  ]);

  it("expande recetas a ingredientes base", () => {
    const graph: RecipeGraph = new Map([
      [
        20,
        [
          { ingredientProductId: 12, quantity: 1, unit: "unidad", yieldPercent: 100 },
          { ingredientProductId: 11, quantity: 0.2, unit: "kg", yieldPercent: 100 },
        ],
      ],
      [12, [{ ingredientProductId: 10, quantity: 0.25, unit: "kg", yieldPercent: 90 }]],
    ]);
    const result = planConsumptionFromContext({
      quantities: new Map([[20, 2]]),
      combos: [],
      graph,
      costInfo: info,
      conversions: [],
    });
    // 2 pizzas: muzzarella 0.4 kg; harina 2 × 1 × 0.25 × (100/90)
    expect(result.plan.get(11)).toBeCloseTo(0.4, 6);
    expect(result.plan.get(10)).toBeCloseTo(0.5555556, 6);
    expect(result.units.get(11)).toBe("kg");
    expect(result.costById.get(11)).toBe(200);
  });

  it("expande combos a sus componentes y recetas", () => {
    const graph: RecipeGraph = new Map([
      [
        20,
        [
          { ingredientProductId: 12, quantity: 1, unit: "unidad", yieldPercent: 100 },
          { ingredientProductId: 11, quantity: 0.2, unit: "kg", yieldPercent: 100 },
        ],
      ],
      [12, [{ ingredientProductId: 10, quantity: 0.25, unit: "kg", yieldPercent: 100 }]],
    ]);
    const result = planConsumptionFromContext({
      quantities: new Map([[21, 1]]),
      combos: [{ productId: 21, itemProductId: 20, quantity: 1 }, { productId: 21, itemProductId: 13, quantity: 1 }],
      graph,
      costInfo: info,
      conversions: [],
    });
    expect(result.plan.get(11)).toBeCloseTo(0.2, 6);
    expect(result.plan.get(10)).toBeCloseTo(0.25, 6);
    expect(result.plan.get(13)).toBe(1);
  });

  it("consume directo productos sin receta ni combo", () => {
    const result = planConsumptionFromContext({
      quantities: new Map([[13, 3]]),
      combos: [],
      graph: new Map(),
      costInfo: info,
      conversions: [],
    });
    expect(result.plan.get(13)).toBe(3);
    expect(result.units.get(13)).toBe("unidad");
  });

  it("aplica cantidad del combo multiplicada por la pedida", () => {
    const result = planConsumptionFromContext({
      quantities: new Map([[21, 2]]),
      combos: [{ productId: 21, itemProductId: 13, quantity: 2 }],
      graph: new Map(),
      costInfo: info,
      conversions: [],
    });
    expect(result.plan.get(13)).toBe(4);
  });

  it("respeta el aislamiento de tenant: solo usa el grafo recibido (ya filtrado)", () => {
    // El grafo contiene un ciclo de otro negocio; como el nuestro no lo referencia, no se rompe.
    const graph: RecipeGraph = new Map([
      [20, [{ ingredientProductId: 10, quantity: 0.25, unit: "kg", yieldPercent: 100 }]],
      [999, [{ ingredientProductId: 998, quantity: 1, unit: "unidad", yieldPercent: 100 }]],
    ]);
    const result = planConsumptionFromContext({
      quantities: new Map([[20, 1]]),
      combos: [{ productId: 999, itemProductId: 997, quantity: 1 }],
      graph,
      costInfo: info,
      conversions: [],
    });
    expect(result.plan.get(10)).toBeCloseTo(0.25, 6);
    expect(result.plan.has(997)).toBe(false);
    expect(result.plan.has(998)).toBe(false);
  });
});

describe("buildRecipeConsumptionPlan", () => {
  it("consulta y planifica siempre con el tenant indicado (aislamiento)", async () => {
    const seen: number[] = [];
    const fakeClient = {
      recipeIngredient: {
        findMany: async ({ where }: { where: { tenantId: number } }) => {
          seen.push(where.tenantId);
          return [
            { productId: 20, ingredientProductId: 10, quantity: new Prisma.Decimal(0.25), unit: "kg", yieldPercent: new Prisma.Decimal(100) },
          ];
        },
      },
      product: {
        findMany: async ({ where }: { where: { tenantId: number } }) => {
          seen.push(where.tenantId);
          return [
            { id: 20, name: "Pizza", cost: null, costUnit: "unidad" },
            { id: 10, name: "Harina", cost: new Prisma.Decimal(100), costUnit: "kg" },
          ];
        },
      },
      unitConversion: {
        findMany: async ({ where }: { where: { tenantId: number } }) => {
          seen.push(where.tenantId);
          return [];
        },
      },
      productComboItem: {
        findMany: async ({ where }: { where: { tenantId: number } }) => {
          seen.push(where.tenantId);
          return [];
        },
      },
    };

    const result = await buildRecipeConsumptionPlan(42, new Map([[20, 1]]), fakeClient as never);

    expect(seen).toHaveLength(4);
    expect(seen.every((tenantId) => tenantId === 42)).toBe(true);
    expect(result.plan.get(10)).toBeCloseTo(0.25, 6);
    expect(result.costById.get(10)).toBe(100);
    expect(result.units.get(10)).toBe("kg");
  });
});

type FakeStock = { id: number; productId: number; current: number; unit: string; minimum: number; tracked: boolean };

/** @summary Construye una transacción falsa para probar consumeRecipeStock. */
function fakeTransaction(initialStocks: FakeStock[], options: { failUpdate?: boolean } = {}) {
  const stocks = new Map<number, FakeStock>(initialStocks.map((stock) => [stock.id, { ...stock }]));
  const movements: Array<Record<string, unknown>> = [];
  const notifications: Array<Record<string, unknown>> = [];
  let movementId = 0;
  const transaction = {
    inventoryStock: {
      updateMany: async ({ where, data }: { where: { id: number; tracked: boolean; current: { gte: number } }; data: { current: { decrement: number } } }) => {
        const stock = stocks.get(where.id);
        if (options.failUpdate || !stock || !stock.tracked || stock.current < where.current.gte) return { count: 0 };
        stock.current -= Number(data.current.decrement);
        return { count: 1 };
      },
      findUniqueOrThrow: async ({ where }: { where: { id: number } }) => {
        const stock = stocks.get(where.id);
        if (!stock) throw new Error("Stock inexistente");
        return stock;
      },
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
  } as unknown as Prisma.TransactionClient;
  return { transaction, stocks, movements, notifications };
}

describe("consumeRecipeStock", () => {
  const base = {
    tenantId: 7,
    branchId: 2,
    orderId: 42,
    reference: "PED-1",
    costById: new Map<number, number | null>([[10, 100], [13, 500]]),
    units: new Map<number, string>([[10, "kg"], [13, "unidad"]]),
    conversions: [],
    productName: (productId: number) => (productId === 10 ? "Harina" : productId === 13 ? "Gaseosa" : "Producto"),
  };

  it("descuenta ingredientes y guarda snapshot de costo", async () => {
    const { transaction, stocks, movements } = fakeTransaction([
      { id: 1, productId: 10, current: 5, unit: "kg", minimum: 1, tracked: true },
    ]);
    await consumeRecipeStock(transaction, {
      ...base,
      plan: new Map([[10, 2]]),
      stocks: [{ id: 1, productId: 10, unit: "kg" }],
    });
    expect(stocks.get(1)!.current).toBe(3);
    const movement = movements.find((entry) => entry.type === "order");
    expect(movement).toBeDefined();
    expect(String((movement as { quantity: Prisma.Decimal }).quantity)).toBe("-2");
    expect(Number((movement as { unitCost: number }).unitCost)).toBe(100);
  });

  it("convierte la cantidad a la unidad de la existencia y ajusta el snapshot", async () => {
    const { transaction, stocks, movements } = fakeTransaction([
      { id: 1, productId: 10, current: 5000, unit: "g", minimum: 100, tracked: true },
    ]);
    await consumeRecipeStock(transaction, {
      ...base,
      plan: new Map([[10, 2]]), // 2 kg → 2000 g
      stocks: [{ id: 1, productId: 10, unit: "g" }],
    });
    expect(stocks.get(1)!.current).toBe(3000);
    const movement = movements.find((entry) => entry.type === "order") as { quantity: Prisma.Decimal; unitCost: number };
    expect(String(movement.quantity)).toBe("-2000");
    // Costo por unidad de stock: 100 ARS/kg → 0.1 ARS/g
    expect(movement.unitCost).toBeCloseTo(0.1, 6);
  });

  it("avisa cuando el stock queda bajo el mínimo", async () => {
    const { transaction, notifications } = fakeTransaction([
      { id: 1, productId: 13, current: 5, unit: "unidad", minimum: 4, tracked: true },
    ]);
    await consumeRecipeStock(transaction, {
      ...base,
      plan: new Map([[13, 2]]),
      stocks: [{ id: 1, productId: 13, unit: "unidad" }],
    });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].type).toBe("stock.low");
    expect(String(notifications[0].title)).toContain("Gaseosa");
  });

  it("lanza error de concurrencia si el stock cambió durante la confirmación", async () => {
    const { transaction } = fakeTransaction(
      [{ id: 1, productId: 10, current: 5, unit: "kg", minimum: 1, tracked: true }],
      { failUpdate: true },
    );
    await expect(
      consumeRecipeStock(transaction, {
        ...base,
        plan: new Map([[10, 2]]),
        stocks: [{ id: 1, productId: 10, unit: "kg" }],
      }),
    ).rejects.toThrow(/El stock cambió mientras confirmabas el pedido/);
  });

  it("lanza error claro cuando la unidad no es convertible", async () => {
    const { transaction } = fakeTransaction([
      { id: 1, productId: 10, current: 5, unit: "bolsa", minimum: 1, tracked: true },
    ]);
    await expect(
      consumeRecipeStock(transaction, {
        ...base,
        plan: new Map([[10, 2]]),
        stocks: [{ id: 1, productId: 10, unit: "bolsa" }],
      }),
    ).rejects.toThrow(/No se puede convertir la unidad de Harina/);
  });

  it("no toca existencias sin control activado", async () => {
    const { transaction, stocks, movements } = fakeTransaction([
      { id: 1, productId: 13, current: 9, unit: "unidad", minimum: 0, tracked: false },
    ]);
    await consumeRecipeStock(transaction, {
      ...base,
      plan: new Map([[13, 2]]),
      stocks: [],
    });
    expect(stocks.get(1)!.current).toBe(9);
    expect(movements).toHaveLength(0);
  });
});

describe("restoreOrderStock con consumos de recetas", () => {
  /** @summary Transacción falsa con lo que necesita restoreOrderStock (movimientos + existencias). */
  function restoreTransaction(initialStocks: FakeStock[]) {
    const stocks = new Map<number, FakeStock>(initialStocks.map((stock) => [stock.id, { ...stock }]));
    const movements: Array<Record<string, unknown>> = [];
    let movementId = 0;
    const transaction = {
      stockMovement: {
        findFirst: async ({ where }: { where: { orderId: number; type: string } }) =>
          movements.find((movement) => movement.orderId === where.orderId && movement.type === where.type) ?? null,
        findMany: async ({ where }: { where: { orderId: number; type: string; quantity: { lt: number } } }) =>
          movements.filter(
            (movement) =>
              movement.orderId === where.orderId &&
              movement.type === where.type &&
              (movement.quantity as Prisma.Decimal).lessThan(where.quantity.lt),
          ),
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const movement = { ...data, id: ++movementId };
          movements.push(movement);
          return movement;
        },
      },
      inventoryStock: {
        findUnique: async ({ where }: { where: { id: number } }) => stocks.get(where.id) ?? null,
        findUniqueOrThrow: async ({ where }: { where: { id: number } }) => {
          const stock = stocks.get(where.id);
          if (!stock) throw new Error("Stock inexistente");
          return stock;
        },
        update: async ({ where, data }: { where: { id: number }; data: { current: { increment: Prisma.Decimal } } }) => {
          const stock = stocks.get(where.id);
          if (!stock) throw new Error("Stock inexistente");
          stock.current += Number(data.current.increment);
          return stock;
        },
      },
    } as unknown as Prisma.TransactionClient;
    return { transaction, stocks, movements };
  }

  it("la cancelación restituye los ingredientes consumidos conservando el snapshot", async () => {
    const { restoreOrderStock } = await import("@/lib/order-stock");
    const { transaction, stocks, movements } = restoreTransaction([
      { id: 1, productId: 10, current: 3, unit: "kg", minimum: 0, tracked: true },
    ]);
    // Consumo de receta con snapshot de costo registrado al vender.
    await transaction.stockMovement.create({
      data: {
        tenantId: 7,
        stockId: 1,
        orderId: 42,
        type: "order",
        quantity: new Prisma.Decimal(-0.4),
        balanceAfter: new Prisma.Decimal(3),
        unitCost: new Prisma.Decimal(100),
        reason: "Pedido PED-1",
      },
    });

    const restored = await restoreOrderStock(transaction, { id: 42, reference: "PED-1" });

    expect(restored).toBe(true);
    expect(stocks.get(1)!.current).toBeCloseTo(3.4, 6);
    const returned = movements.find((movement) => movement.type === "order_return") as {
      quantity: Prisma.Decimal;
      unitCost: unknown;
    };
    expect(returned).toBeDefined();
    expect(String(returned.quantity)).toBe("0.4");
  });

  it("no restituye dos veces el mismo consumo de receta", async () => {
    const { restoreOrderStock } = await import("@/lib/order-stock");
    const { transaction, movements } = restoreTransaction([
      { id: 1, productId: 10, current: 3, unit: "kg", minimum: 0, tracked: true },
    ]);
    await transaction.stockMovement.create({
      data: {
        tenantId: 7,
        stockId: 1,
        orderId: 42,
        type: "order",
        quantity: new Prisma.Decimal(-0.4),
        balanceAfter: new Prisma.Decimal(3),
        unitCost: new Prisma.Decimal(100),
        reason: "Pedido PED-1",
      },
    });

    const first = await restoreOrderStock(transaction, { id: 42, reference: "PED-1" });
    const second = await restoreOrderStock(transaction, { id: 42, reference: "PED-1" });

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(movements.filter((movement) => movement.type === "order_return")).toHaveLength(1);
  });
});
