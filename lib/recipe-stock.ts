import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { convertQuantity, type UnitConversionRow } from "@/lib/recipe-units";
import { expandRecipeToLeaves, recipeLinesOf, type RecipeGraph, type RecipeCostInfo } from "@/lib/recipes";

/**
 * Consumo de inventario desde recetas y combos.
 *
 * Un pedido descuenta, además del producto directo, los ingredientes de su
 * receta (expandiendo subrecetas hasta la materia prima) y los componentes de
 * sus combos. La planificación es pura y la deducción usa la misma transacción
 * del pedido con guardas optimistas; cada movimiento guarda el snapshot de
 * `unitCost` para que el costo histórico de ventas nunca se reescriba.
 * La cancelación restituye todo con `restoreOrderStock` porque los movimientos
 * tienen el mismo formato (type "order", cantidad negativa).
 */

export type RecipeConsumptionPlan = {
  /** Producto base (hoja) → cantidad total en su `costUnit`. */
  plan: Map<number, number>;
  /** Costo por unidad base de cada producto del plan (null si no tiene costo). */
  costById: Map<number, number | null>;
  /** Unidad base (`costUnit`) de cada producto del plan. */
  units: Map<number, string>;
  conversions: UnitConversionRow[];
};

/**
 * @summary Construye el plan de consumo de inventario de un pedido.
 *
 * Expande combos (componentes × cantidad) y recetas (subrecetas hasta la hoja,
 * con merma y conversión de unidades). Los productos sin receta ni combo se
 * consumen directamente en su propia unidad base. Función pura: recibe el grafo
 * ya filtrado por tenant para que el aislamiento multi-negocio quede en el
 * acceso a datos y no en la lógica.
 *
 * @param quantities Producto vendido → cantidad pedida (ya agregada por ítem).
 */
export function planConsumptionFromContext(
  input: {
    quantities: Map<number, number>;
    combos: Array<{ productId: number; itemProductId: number; quantity: number }>;
    graph: RecipeGraph;
    costInfo: Map<number, RecipeCostInfo>;
    conversions: UnitConversionRow[];
  },
): RecipeConsumptionPlan {
  const comboByProduct = new Map<number, Array<{ itemProductId: number; quantity: number }>>();
  for (const combo of input.combos) {
    const list = comboByProduct.get(combo.productId) ?? [];
    list.push({ itemProductId: combo.itemProductId, quantity: combo.quantity });
    comboByProduct.set(combo.productId, list);
  }

  const plan = new Map<number, number>();
  const add = (productId: number, quantity: number) => {
    plan.set(productId, (plan.get(productId) ?? 0) + quantity);
  };

  const expandConsumable = (productId: number, quantity: number, graph: RecipeGraph) => {
    const hasRecipe = recipeLinesOf(graph, productId).length > 0;
    if (hasRecipe) {
      const leaves = expandRecipeToLeaves(graph, input.costInfo, input.conversions, productId, quantity);
      for (const [leafId, entry] of leaves) add(leafId, entry.quantity);
    } else {
      add(productId, quantity);
    }
  };

  for (const [productId, orderQuantity] of input.quantities) {
    const parts = comboByProduct.get(productId);
    if (parts && parts.length > 0) {
      for (const part of parts) {
        expandConsumable(part.itemProductId, orderQuantity * part.quantity, input.graph);
      }
    } else {
      expandConsumable(productId, orderQuantity, input.graph);
    }
  }

  const costById = new Map<number, number | null>();
  const units = new Map<number, string>();
  for (const [productId] of plan) {
    const info = input.costInfo.get(productId);
    costById.set(productId, info?.cost ?? null);
    units.set(productId, info?.costUnit ?? "unidad");
  }

  return { plan, costById, units, conversions: input.conversions };
}

/**
 * @summary Construye el plan de consumo de inventario de un pedido contra la base.
 *
 * Expande combos y recetas del tenant indicado. El acceso a datos queda siempre
 * filtrado por `tenantId` (aislamiento estructural multi-tenant).
 */
export async function buildRecipeConsumptionPlan(
  tenantId: number,
  quantities: Map<number, number>,
  client: Pick<typeof prisma, "recipeIngredient" | "product" | "unitConversion" | "productComboItem"> = prisma,
): Promise<RecipeConsumptionPlan> {
  const [lines, products, conversions, combos] = await Promise.all([
    client.recipeIngredient.findMany({ where: { tenantId }, select: { productId: true, ingredientProductId: true, quantity: true, unit: true, yieldPercent: true } }),
    client.product.findMany({ where: { tenantId }, select: { id: true, name: true, cost: true, costUnit: true } }),
    client.unitConversion.findMany({ where: { tenantId }, select: { fromUnit: true, toUnit: true, factor: true } }),
    client.productComboItem.findMany({ where: { tenantId }, select: { productId: true, itemProductId: true, quantity: true } }),
  ]);

  const hasRecipe = new Set(lines.map((line) => line.productId));
  const graph: RecipeGraph = new Map();
  for (const line of lines) {
    const list = graph.get(line.productId) ?? [];
    list.push({
      ingredientProductId: line.ingredientProductId,
      quantity: Number(line.quantity),
      unit: line.unit,
      yieldPercent: Number(line.yieldPercent),
    });
    graph.set(line.productId, list);
  }
  const costInfo = new Map<number, RecipeCostInfo>();
  for (const product of products) {
    costInfo.set(product.id, {
      id: product.id,
      name: product.name,
      cost: product.cost === null || product.cost === undefined ? null : Number(product.cost),
      costUnit: product.costUnit,
      hasRecipe: hasRecipe.has(product.id),
    });
  }
  const conversionRows: UnitConversionRow[] = conversions.map((row) => ({
    fromUnit: row.fromUnit,
    toUnit: row.toUnit,
    factor: Number(row.factor),
  }));

  return planConsumptionFromContext({
    quantities,
    combos: combos.map((combo) => ({
      productId: combo.productId,
      itemProductId: combo.itemProductId,
      quantity: Number(combo.quantity),
    })),
    graph,
    costInfo,
    conversions: conversionRows,
  });
}

/**
 * @summary Descuenta el stock planificado dentro de la transacción del pedido.
 *
 * Convierte cada cantidad (en `costUnit`) a la unidad de la existencia si hace
 * falta, descuenta con guarda optimista (falla si el stock cambió mientras
 * tanto), registra el movimiento con snapshot de costo y alerta cuando queda
 * bajo el mínimo. Debe ejecutarse con la misma transacción que crea el pedido.
 */
export async function consumeRecipeStock(
  transaction: Prisma.TransactionClient,
  input: {
    tenantId: number;
    branchId: number;
    orderId: number;
    reference: string;
    plan: Map<number, number>;
    /** Existencias controladas devueltas por `assertStockAvailability`. */
    stocks: Array<{ id: number; productId: number; unit: string }>;
    costById: Map<number, number | null>;
    units: Map<number, string>;
    conversions: UnitConversionRow[];
    productName: (productId: number) => string;
    /** true = política permisiva: permite stock negativo con advertencia. */
    allowNegative?: boolean;
  },
) {
  for (const stock of input.stocks) {
    const baseQuantity = input.plan.get(stock.productId) ?? 0;
    if (!baseQuantity) continue;
    const baseUnit = input.units.get(stock.productId) ?? "unidad";
    const name = input.productName(stock.productId) || "Producto";

    let quantity = baseQuantity;
    let factorToStockUnit = 1;
    if (baseUnit !== stock.unit) {
      try {
        factorToStockUnit = convertQuantity(1, baseUnit, stock.unit, input.conversions);
        quantity = convertQuantity(baseQuantity, baseUnit, stock.unit, input.conversions);
      } catch {
        throw new Error(
          `No se puede convertir la unidad de ${name}: falta configurar "${baseUnit}" a "${stock.unit}"`,
        );
      }
    }

    // Guarda atómica: en modo estricto no se descuenta sin stock suficiente (evita
    // carreras que dejen negativo); en modo permisivo solo se evita la pérdida de updates.
    const where = input.allowNegative
      ? { id: stock.id, tracked: true }
      : { id: stock.id, tracked: true, current: { gte: quantity } };
    const result = await transaction.inventoryStock.updateMany({ where, data: { current: { decrement: quantity } } });
    if (result.count !== 1) throw new Error("El stock cambió mientras confirmabas el pedido");
    const updated = await transaction.inventoryStock.findUniqueOrThrow({ where: { id: stock.id } });

    const cost = input.costById.get(stock.productId) ?? null;
    await transaction.stockMovement.create({
      data: {
        tenantId: input.tenantId,
        stockId: stock.id,
        orderId: input.orderId,
        type: "order",
        quantity: -quantity,
        balanceAfter: updated.current,
        unitCost: cost === null || cost === undefined ? null : cost / factorToStockUnit,
        reason: `Pedido ${input.reference}`,
      },
    });

    if (Number(updated.current) <= Number(updated.minimum)) {
      await transaction.notification.create({
        data: {
          tenantId: input.tenantId,
          branchId: input.branchId,
          type: "stock.low",
          title: `Stock bajo · ${name}`,
          message: `Quedaron ${Number(updated.current)} ${updated.unit}.`,
          link: "/admin/inventario",
        },
      });
    }
  }
}
