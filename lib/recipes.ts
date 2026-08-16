import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { convertQuantity, isConvertible, normalizeUnit, type UnitConversionRow } from "@/lib/recipe-units";

/**
 * Módulo de recetas e ingredientes.
 *
 * Una receta conecta un producto compuesto (la "preparación") con sus
 * ingredientes. Los ingredientes son productos reales del catálogo que tienen
 * costo (`cost` por `costUnit`) y stock por sucursal (`InventoryStock`). Una
 * subreceta es simplemente un producto que además tiene su propia receta: al
 * calcular costos y consumos se expande recursivamente hasta los ingredientes
 * base (productos sin receta), aplicando rendimiento/merma en cada nivel.
 *
 * El costo histórico nunca se reescribe: cada cambio de costo se registra en
 * `IngredientCostHistory` y el consumo guarda su propio snapshot en
 * `StockMovement.unitCost`.
 */

export type RecipeGraphLine = {
  ingredientProductId: number;
  quantity: number;
  unit: string;
  /** Rendimiento en porcentaje: 100 = sin merma. A menor rendimiento, mayor cantidad bruta necesaria. */
  yieldPercent: number;
};

/** @summary Grafo de recetas del tenant: producto dueño → líneas de ingredientes. */
export type RecipeGraph = Map<number, RecipeGraphLine[]>;

/** @summary Datos de costo de un producto para cálculos de receta. */
export type RecipeCostInfo = {
  id: number;
  name: string;
  cost: number | null;
  costUnit: string;
  hasRecipe: boolean;
};

/** @summary Carga el grafo completo de recetas, costos y conversiones del tenant. */
export async function loadRecipeContext(tenantId: number) {
  const [lines, products, conversions] = await Promise.all([
    prisma.recipeIngredient.findMany({
      where: { tenantId },
      select: {
        productId: true,
        ingredientProductId: true,
        quantity: true,
        unit: true,
        yieldPercent: true,
      },
    }),
    prisma.product.findMany({
      where: { tenantId },
      select: { id: true, name: true, cost: true, costUnit: true },
    }),
    prisma.unitConversion.findMany({ where: { tenantId }, select: { fromUnit: true, toUnit: true, factor: true } }),
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
  return { graph, costInfo, conversions: conversionRows };
}

export type LoadedRecipeContext = Awaited<ReturnType<typeof loadRecipeContext>>;

/** @summary Devuelve las líneas de receta de un producto (vacío si no tiene). */
export function recipeLinesOf(graph: RecipeGraph, productId: number): RecipeGraphLine[] {
  return graph.get(productId) ?? [];
}

/**
 * @summary Detecta ciclos de subrecetas a partir de un producto.
 *
 * Una subreceta no puede usarse a sí misma (directa o transitivamente):
 * A → B → A haría imposible calcular costo y consumo. BFS con estados.
 */
export function recipeGraphHasCycle(graph: RecipeGraph, startId: number): boolean {
  const visiting = new Set<number>();
  const visited = new Set<number>();

  const visit = (productId: number): boolean => {
    if (visiting.has(productId)) return true;
    if (visited.has(productId)) return false;
    visiting.add(productId);
    for (const line of recipeLinesOf(graph, productId)) {
      if (visit(line.ingredientProductId)) return true;
    }
    visiting.delete(productId);
    visited.add(productId);
    return false;
  };

  return visit(startId);
}

/** @summary Lanza un error claro si guardar la receta generaría un ciclo de subrecetas. */
export function assertNoRecipeCycles(graph: RecipeGraph, productId: number) {
  if (recipeGraphHasCycle(graph, productId)) {
    throw new Error("La receta genera un ciclo de subrecetas: una preparación no puede contenerse a sí misma");
  }
}

/** @summary Construye un grafo copia reemplazando las líneas de un producto (para validar un guardado). */
export function graphWithLines(
  graph: RecipeGraph,
  productId: number,
  lines: RecipeGraphLine[],
): RecipeGraph {
  const copy: RecipeGraph = new Map(graph);
  copy.set(productId, lines);
  return copy;
}

/**
 * @summary Expande una receta hasta los ingredientes base y devuelve las cantidades totales.
 *
 * Cada línea se multiplica por su factor de merma (cantidad × 100 / rendimiento)
 * y, si el ingrediente es una subreceta, se expande recursivamente. Cada hoja se
 * convierte a su propia `costUnit` para poder sumar aportes de distintas ramas.
 *
 * @param quantity Cantidad de unidades del producto compuesto (p. ej. 2 porciones).
 * @returns Mapa producto base → cantidad total en su `costUnit`.
 */
export function expandRecipeToLeaves(
  graph: RecipeGraph,
  costInfo: Map<number, RecipeCostInfo>,
  conversions: readonly UnitConversionRow[],
  productId: number,
  quantity: number,
): Map<number, { quantity: number; unit: string }> {
  const totals = new Map<number, { quantity: number; unit: string }>();
  const onPath = new Set<number>();

  const addTo = (leafId: number, amount: number, unit: string) => {
    const current = totals.get(leafId) ?? { quantity: 0, unit };
    totals.set(leafId, { quantity: current.quantity + amount, unit });
  };

  const expand = (ownerId: number, factor: number) => {
    if (onPath.has(ownerId)) throw new Error("Ciclo de subrecetas detectado");
    const lines = recipeLinesOf(graph, ownerId);
    if (lines.length === 0) {
      // Producto base sin receta: se consume directamente en su propia unidad.
      const unit = costInfo.get(ownerId)?.costUnit ?? "unidad";
      addTo(ownerId, factor, unit);
      return;
    }
    onPath.add(ownerId);
    for (const line of lines) {
      const raw = factor * line.quantity * (100 / line.yieldPercent);
      const ingredientLines = recipeLinesOf(graph, line.ingredientProductId);
      if (ingredientLines.length > 0) {
        expand(line.ingredientProductId, raw);
      } else {
        const leafUnit = costInfo.get(line.ingredientProductId)?.costUnit ?? "unidad";
        const converted = convertQuantity(raw, line.unit, leafUnit, conversions);
        addTo(line.ingredientProductId, converted, leafUnit);
      }
    }
    onPath.delete(ownerId);
  };

  expand(productId, quantity);
  return totals;
}

/** @summary Detalle de una línea de receta con su costo calculado. */
export type RecipeBreakdownLine = {
  ingredientProductId: number;
  name: string;
  quantity: number;
  unit: string;
  yieldPercent: number;
  /** Cantidad convertida a la unidad base del ingrediente (costUnit). */
  convertedQuantity: number;
  baseUnit: string;
  isSubrecipe: boolean;
  /** Costo por unidad base del ingrediente (subreceta = costo de su propia receta). */
  unitCost: number | null;
  /** Costo total de la línea ya con merma y conversión. */
  lineCost: number | null;
};

export type RecipeCostResult = {
  lines: RecipeBreakdownLine[];
  /** Costo total por unidad del producto compuesto (null si falta algún costo). */
  totalCost: number | null;
  incomplete: boolean;
  reasons: string[];
};

/**
 * @summary Calcula el costo total de una receta por unidad del producto compuesto.
 *
 * Se expande el costo de subrecetas recursivamente (con memoización) y se aplica
 * merma y conversión de unidades en cada línea. Devuelve null cuando algún
 * ingrediente base no tiene costo configurado (receta incompleta).
 */
export function recipeCostPerUnit(
  graph: RecipeGraph,
  costInfo: Map<number, RecipeCostInfo>,
  conversions: readonly UnitConversionRow[],
  productId: number,
  memo = new Map<number, number | null>(),
): number | null {
  const cached = memo.get(productId);
  if (cached !== undefined) return cached;

  const info = costInfo.get(productId);
  if (!info) return null;
  if (!info.hasRecipe) {
    memo.set(productId, info.cost);
    return info.cost;
  }

  let total = 0;
  for (const line of recipeLinesOf(graph, productId)) {
    const ingredient = costInfo.get(line.ingredientProductId);
    if (!ingredient) return null;
    let perBaseUnit: number | null;
    if (ingredient.hasRecipe) {
      perBaseUnit = recipeCostPerUnit(graph, costInfo, conversions, ingredient.id, memo);
    } else {
      perBaseUnit = ingredient.cost;
    }
    if (perBaseUnit === null) {
      memo.set(productId, null);
      return null;
    }
    const effective = line.quantity * (100 / line.yieldPercent);
    let converted: number;
    try {
      converted = convertQuantity(effective, line.unit, ingredient.costUnit, conversions);
    } catch {
      memo.set(productId, null);
      return null;
    }
    total += converted * perBaseUnit;
  }
  memo.set(productId, total);
  return total;
}

/**
 * @summary Desglose completo de una receta para el editor y la ficha técnica.
 *
 * Incluye el costo de cada línea (con subrecetas colapsadas a su costo propio)
 * y las razones por las que la receta está incompleta (costo faltante o unidad
 * no convertible), para mostrarlas como alertas en la interfaz.
 */
export function recipeCostBreakdown(
  graph: RecipeGraph,
  costInfo: Map<number, RecipeCostInfo>,
  conversions: readonly UnitConversionRow[],
  productId: number,
): RecipeCostResult {
  const reasons: string[] = [];
  const lines: RecipeBreakdownLine[] = [];

  for (const line of recipeLinesOf(graph, productId)) {
    const ingredient = costInfo.get(line.ingredientProductId);
    if (!ingredient) {
      reasons.push("Un ingrediente de la receta ya no existe");
      continue;
    }
    const isSubrecipe = ingredient.hasRecipe;
    const effective = line.quantity * (100 / line.yieldPercent);
    let converted: number | null = null;
    try {
      converted = convertQuantity(effective, line.unit, ingredient.costUnit, conversions);
    } catch {
      reasons.push(
        `No se puede convertir "${line.unit}" a "${ingredient.costUnit}" en ${ingredient.name}`,
      );
    }
    let perBaseUnit: number | null = null;
    if (isSubrecipe) {
      perBaseUnit = recipeCostPerUnit(graph, costInfo, conversions, ingredient.id);
    } else {
      perBaseUnit = ingredient.cost;
    }
    if (perBaseUnit === null) {
      reasons.push(`${ingredient.name} no tiene costo configurado`);
    }
    lines.push({
      ingredientProductId: ingredient.id,
      name: ingredient.name,
      quantity: line.quantity,
      unit: line.unit,
      yieldPercent: line.yieldPercent,
      convertedQuantity: converted ?? 0,
      baseUnit: ingredient.costUnit,
      isSubrecipe,
      unitCost: perBaseUnit,
      lineCost: converted !== null && perBaseUnit !== null ? converted * perBaseUnit : null,
    });
  }

  if (recipeGraphHasCycle(graph, productId)) {
    reasons.push("La receta contiene un ciclo de subrecetas");
  }

  const anyLineCost = (value: number | null): value is number => value !== null;
  const totalCost = lines.every((line) => anyLineCost(line.lineCost)) && lines.length > 0
    ? lines.reduce((sum, line) => sum + (line.lineCost as number), 0)
    : lines.length === 0
      ? 0
      : null;

  return { lines, totalCost, incomplete: totalCost === null || reasons.length > 0, reasons };
}

/** @summary Línea de receta expandida en árbol para la ficha técnica (subrecetas anidadas). */
export type RecipeTreeLine = {
  ingredientProductId: number;
  name: string;
  quantity: number;
  unit: string;
  yieldPercent: number;
  convertedQuantity: number;
  baseUnit: string;
  isSubrecipe: boolean;
  unitCost: number | null;
  lineCost: number | null;
  children: RecipeTreeLine[];
};

export type RecipeTreeResult = {
  tree: RecipeTreeLine[];
  totalCost: number | null;
  incomplete: boolean;
  reasons: string[];
};

/**
 * @summary Árbol de desglose de una receta con subrecetas anidadas (para la ficha técnica).
 *
 * Cada línea de subreceta lleva su propio desglose como hijos, con costos
 * calculados en cada nivel.
 */
export function recipeBreakdownTree(
  graph: RecipeGraph,
  costInfo: Map<number, RecipeCostInfo>,
  conversions: readonly UnitConversionRow[],
  productId: number,
): RecipeTreeResult {
  const reasons: string[] = [];
  const buildLines = (ownerId: number): RecipeTreeLine[] => {
    const lines: RecipeTreeLine[] = [];
    for (const line of recipeLinesOf(graph, ownerId)) {
      const ingredient = costInfo.get(line.ingredientProductId);
      if (!ingredient) {
        reasons.push("Un ingrediente de la receta ya no existe");
        continue;
      }
      const isSubrecipe = ingredient.hasRecipe;
      const effective = line.quantity * (100 / line.yieldPercent);
      let converted: number | null = null;
      try {
        converted = convertQuantity(effective, line.unit, ingredient.costUnit, conversions);
      } catch {
        reasons.push(`No se puede convertir "${line.unit}" a "${ingredient.costUnit}" en ${ingredient.name}`);
      }
      let perBaseUnit: number | null = null;
      if (isSubrecipe) {
        perBaseUnit = recipeCostPerUnit(graph, costInfo, conversions, ingredient.id);
      } else {
        perBaseUnit = ingredient.cost;
      }
      if (perBaseUnit === null) reasons.push(`${ingredient.name} no tiene costo configurado`);
      lines.push({
        ingredientProductId: ingredient.id,
        name: ingredient.name,
        quantity: line.quantity,
        unit: line.unit,
        yieldPercent: line.yieldPercent,
        convertedQuantity: converted ?? 0,
        baseUnit: ingredient.costUnit,
        isSubrecipe,
        unitCost: perBaseUnit,
        lineCost: converted !== null && perBaseUnit !== null ? converted * perBaseUnit : null,
        children: isSubrecipe ? buildLines(ingredient.id) : [],
      });
    }
    return lines;
  };

  const tree = buildLines(productId);
  if (recipeGraphHasCycle(graph, productId)) {
    reasons.push("La receta contiene un ciclo de subrecetas");
  }
  const totalCost =
    tree.length === 0
      ? 0
      : tree.every((line) => line.lineCost !== null)
        ? tree.reduce((sum, line) => sum + (line.lineCost ?? 0), 0)
        : null;
  return { tree, totalCost, incomplete: totalCost === null || reasons.length > 0, reasons };
}

/**
 * @summary Valida que las líneas propuestas para una receta sean seguras de guardar.
 *
 * Verifica pertenencia al tenant y que no se genere un ciclo de subrecetas.
 * Pensado para usarse dentro de la transacción de guardado.
 */
export async function assertRecipeLinesValid(
  transaction: Prisma.TransactionClient,
  tenantId: number,
  productId: number,
  lines: RecipeGraphLine[],
) {
  const ingredientIds = [...new Set(lines.map((line) => line.ingredientProductId))];
  const products = await transaction.product.findMany({
    where: { id: { in: ingredientIds }, tenantId },
    select: { id: true },
  });
  if (products.length !== ingredientIds.length) {
    throw new Error("Algún ingrediente de la receta no pertenece al negocio");
  }
  if (ingredientIds.includes(productId)) {
    throw new Error("Un producto no puede incluirse a sí mismo en su receta");
  }
  const allLines = await transaction.recipeIngredient.findMany({
    where: { tenantId },
    select: { productId: true, ingredientProductId: true, quantity: true, unit: true, yieldPercent: true },
  });
  const graph: RecipeGraph = new Map();
  for (const row of allLines) {
    const list = graph.get(row.productId) ?? [];
    list.push({
      ingredientProductId: row.ingredientProductId,
      quantity: Number(row.quantity),
      unit: row.unit,
      yieldPercent: Number(row.yieldPercent),
    });
    graph.set(row.productId, list);
  }
  const candidate = graphWithLines(graph, productId, lines);
  assertNoRecipeCycles(candidate, productId);
}

/** @summary Registra un cambio de costo en el historial (nunca se reescribe el pasado). */
export async function recordIngredientCostHistory(
  transaction: Prisma.TransactionClient,
  input: {
    tenantId: number;
    productId: number;
    cost: number;
    unit: string;
    changedById?: number | null;
    reason?: string | null;
  },
) {
  await transaction.ingredientCostHistory.create({
    data: {
      tenantId: input.tenantId,
      productId: input.productId,
      cost: input.cost,
      unit: input.unit,
      changedById: input.changedById ?? null,
      reason: input.reason?.trim() ? input.reason.trim() : null,
    },
  });
}

/** @summary Guarda las líneas de receta de un producto validando tenant y ciclos. */
export async function saveRecipeLines(
  transaction: Prisma.TransactionClient,
  input: {
    tenantId: number;
    productId: number;
    lines: RecipeGraphLine[];
  },
) {
  await assertRecipeLinesValid(transaction, input.tenantId, input.productId, input.lines);
  await transaction.recipeIngredient.deleteMany({
    where: { tenantId: input.tenantId, productId: input.productId },
  });
  if (input.lines.length) {
    await transaction.recipeIngredient.createMany({
      data: input.lines.map((line, index) => ({
        tenantId: input.tenantId,
        productId: input.productId,
        ingredientProductId: line.ingredientProductId,
        quantity: line.quantity,
        unit: normalizeUnit(line.unit),
        yieldPercent: line.yieldPercent,
        sortOrder: index,
      })),
    });
  }
}

/** @summary Indica si una conversión es necesaria y posible para una línea de receta. */
export function lineConversionAvailable(
  conversions: readonly UnitConversionRow[],
  fromUnit: string,
  toUnit: string,
) {
  return isConvertible(fromUnit, toUnit, conversions);
}
