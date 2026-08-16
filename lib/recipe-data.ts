import type { AuthorizationContext } from "@/lib/auth";
import { branchProductWhere } from "@/lib/branch";
import { prisma } from "@/lib/prisma";
import { marginPercent, markupPercent } from "@/lib/product-catalog";
import {
  loadRecipeContext,
  recipeBreakdownTree,
  recipeCostBreakdown,
  recipeCostPerUnit,
  recipeLinesOf,
} from "@/lib/recipes";

/**
 * Carga de datos del módulo de ingredientes y recetas.
 *
 * Reutiliza el contexto de recetas (grafo, costos, conversiones) y el filtro
 * estructural de sucursal de productos: si la URL indica una sucursal activa,
 * solo se ven los productos publicados en ella.
 */

export type RecipeBoardProductRow = {
  id: number;
  name: string;
  status: string;
  price: string | null;
  cost: string | null;
  costUnit: string;
  /** Costo calculado de la receta por unidad (null si no tiene receta o está incompleta). */
  recipeCost: string | null;
  margin: number | null;
  markup: number | null;
  ingredientCount: number;
  subrecipeCount: number;
  hasRecipe: boolean;
  incomplete: boolean;
  reasons: string[];
  /** Stock actual en la sucursal activa (null si no se controla o no hay sucursal activa). */
  stock: string | null;
};

export type RecipeCandidate = {
  id: number;
  name: string;
  cost: string | null;
  costUnit: string;
  hasRecipe: boolean;
  /** El ingrediente generaría un ciclo de subrecetas si se agrega a la receta actual. */
  blockedByCycle: boolean;
};

export type RecipeConversionRow = { fromUnit: string; toUnit: string; factor: string };

export type RecipeBoardPayload = {
  products: RecipeBoardProductRow[];
  candidates: RecipeCandidate[];
  conversions: RecipeConversionRow[];
  branches: Array<{ id: number; name: string; slug: string }>;
  activeBranch: { id: number; name: string; slug: string } | null;
  tenantName: string;
  currency: string;
};

/** @summary Normaliza un valor decimal de Prisma en cadena o null. */
function decimalString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? String(number) : null;
}

/** @summary Productos que (transitivamente) usan al indicado como ingrediente → agregarlos generaría ciclo. */
export function productsThatReach(graph: Awaited<ReturnType<typeof loadRecipeContext>>["graph"], targetId: number) {
  const reverse = new Map<number, number[]>();
  for (const [owner, lines] of graph) {
    for (const line of lines) {
      const list = reverse.get(line.ingredientProductId) ?? [];
      list.push(owner);
      reverse.set(line.ingredientProductId, list);
    }
  }
  const reached = new Set<number>();
  const queue = [targetId];
  while (queue.length) {
    const current = queue.shift() as number;
    for (const owner of reverse.get(current) ?? []) {
      if (!reached.has(owner)) {
        reached.add(owner);
        queue.push(owner);
      }
    }
  }
  return reached;
}

/** @summary Carga el payload del listado de recetas y las opciones del editor. */
export async function loadRecipeBoardData(context: AuthorizationContext): Promise<RecipeBoardPayload> {
  const activeId = context.activeBranchId && context.activeBranchId > 0 ? context.activeBranchId : null;
  const tenantId = context.tenant.id;

  const [products, recipeContext, tenant, activeBranch] = await Promise.all([
    prisma.product.findMany({
      where: { ...branchProductWhere(tenantId, activeId), status: { not: "archived" } },
      select: {
        id: true,
        name: true,
        status: true,
        price: true,
        cost: true,
        costUnit: true,
        inventoryStocks: { select: { branchId: true, current: true, tracked: true } },
      },
      orderBy: { name: "asc" },
    }),
    loadRecipeContext(tenantId),
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { defaultCurrency: true, name: true } }),
    activeId
      ? prisma.branch.findFirst({ where: { id: activeId, tenantId }, select: { id: true, name: true, slug: true } })
      : Promise.resolve(null),
  ]);

  const { graph, costInfo, conversions } = recipeContext;

  const rows: RecipeBoardProductRow[] = products.map((product) => {
    const hasRecipe = recipeLinesOf(graph, product.id).length > 0;
    const lines = hasRecipe ? recipeLinesOf(graph, product.id) : [];
    let recipeCost: number | null = null;
    let incomplete = false;
    let reasons: string[] = [];
    if (hasRecipe) {
      recipeCost = recipeCostPerUnit(graph, costInfo, conversions, product.id);
      const breakdown = recipeCostBreakdown(graph, costInfo, conversions, product.id);
      incomplete = breakdown.incomplete;
      reasons = breakdown.reasons;
    }
    const price = product.price === null || product.price === undefined ? null : Number(product.price);
    const cost = product.cost === null || product.cost === undefined ? null : Number(product.cost);
    const stock = activeId ? product.inventoryStocks.find((entry) => entry.branchId === activeId) ?? null : null;
    return {
      id: product.id,
      name: product.name,
      status: product.status,
      price: decimalString(product.price),
      cost: decimalString(product.cost),
      costUnit: product.costUnit,
      recipeCost: recipeCost === null ? null : String(recipeCost),
      margin: hasRecipe ? marginPercent(recipeCost, price) : marginPercent(cost, price),
      markup: hasRecipe ? markupPercent(recipeCost, price) : markupPercent(cost, price),
      ingredientCount: lines.length,
      subrecipeCount: lines.filter((line) => costInfo.get(line.ingredientProductId)?.hasRecipe).length,
      hasRecipe,
      incomplete,
      reasons,
      stock: stock?.tracked ? String(Number(stock.current)) : null,
    };
  });

  return {
    products: rows,
    candidates: products.map((product) => ({
      id: product.id,
      name: product.name,
      cost: decimalString(product.cost),
      costUnit: product.costUnit,
      hasRecipe: recipeLinesOf(graph, product.id).length > 0,
      blockedByCycle: false,
    })),
    conversions: conversions.map((row) => ({
      fromUnit: row.fromUnit,
      toUnit: row.toUnit,
      factor: String(row.factor),
    })),
    branches: context.branches
      .filter((branch) => branch.active && branch.status === "active")
      .map((branch) => ({ id: branch.id, name: branch.name, slug: branch.slug })),
    activeBranch: activeBranch ? { id: activeBranch.id, name: activeBranch.name, slug: activeBranch.slug } : null,
    tenantName: tenant?.name ?? context.tenant.name,
    currency: tenant?.defaultCurrency ?? "ARS",
  };
}

export type RecipeEditorLine = {
  ingredientProductId: number;
  name: string;
  quantity: string;
  unit: string;
  yieldPercent: string;
  cost: string | null;
  costUnit: string;
  hasRecipe: boolean;
  /** Costo por unidad base de la subreceta (null si no es subreceta o está incompleta). */
  subrecipeCost: string | null;
  /** Stock actual en la sucursal activa (null si no se controla). */
  stock: string | null;
  stockUnit: string;
};

export type RecipeEditorPayload = {
  product: {
    id: number;
    name: string;
    slug: string;
    status: string;
    price: string | null;
    cost: string | null;
    costUnit: string;
  };
  lines: RecipeEditorLine[];
  totalCost: string | null;
  incomplete: boolean;
  reasons: string[];
  candidates: RecipeCandidate[];
  conversions: RecipeConversionRow[];
  currency: string;
};

/** @summary Carga el detalle de una receta para el editor visual con costo en vivo. */
export async function loadRecipeEditorData(
  context: AuthorizationContext,
  productId: number,
): Promise<RecipeEditorPayload | null> {
  const activeId = context.activeBranchId && context.activeBranchId > 0 ? context.activeBranchId : null;
  const tenantId = context.tenant.id;

  const [product, recipeContext, tenant] = await Promise.all([
    prisma.product.findFirst({
      where: { ...branchProductWhere(tenantId, activeId), id: productId },
      select: { id: true, name: true, slug: true, status: true, price: true, cost: true, costUnit: true },
    }),
    loadRecipeContext(tenantId),
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { defaultCurrency: true } }),
  ]);
  if (!product) return null;

  const { graph, costInfo, conversions } = recipeContext;
  const breakdown = recipeCostBreakdown(graph, costInfo, conversions, productId);
  const blocked = productsThatReach(graph, productId);

  // Stock disponible en la sucursal activa (o la primera accesible en vista consolidada).
  const stockBranchId = activeId ?? context.branches[0]?.id ?? null;
  const ingredientIds = [...new Set(recipeLinesOf(graph, productId).map((line) => line.ingredientProductId))];
  const stocks = stockBranchId
    ? await prisma.inventoryStock.findMany({
        where: { tenantId, branchId: stockBranchId, productId: { in: ingredientIds } },
      })
    : [];
  const stockByProduct = new Map(
    stocks.map((stock) => [stock.productId, { current: Number(stock.current), unit: stock.unit, tracked: stock.tracked }]),
  );

  const lines: RecipeEditorLine[] = recipeLinesOf(graph, productId).map((line) => {
    const ingredient = costInfo.get(line.ingredientProductId);
    const stock = stockByProduct.get(line.ingredientProductId);
    return {
      ingredientProductId: line.ingredientProductId,
      name: ingredient?.name ?? "Ingrediente",
      quantity: String(line.quantity),
      unit: line.unit,
      yieldPercent: String(line.yieldPercent),
      cost: ingredient?.cost === null || ingredient?.cost === undefined ? null : String(ingredient.cost),
      costUnit: ingredient?.costUnit ?? "unidad",
      hasRecipe: ingredient?.hasRecipe ?? false,
      subrecipeCost:
        ingredient?.hasRecipe === true
          ? (() => {
              const subCost = recipeCostPerUnit(graph, costInfo, conversions, line.ingredientProductId);
              return subCost === null ? null : String(subCost);
            })()
          : null,
      stock: stock?.tracked ? String(stock.current) : null,
      stockUnit: stock?.unit ?? "unidad",
    };
  });

  const candidatesPayload = await prisma.product.findMany({
    where: { ...branchProductWhere(tenantId, activeId), status: { not: "archived" } },
    select: { id: true, name: true, cost: true, costUnit: true },
    orderBy: { name: "asc" },
    take: 800,
  });
  const candidates: RecipeCandidate[] = candidatesPayload.map((candidate) => ({
    id: candidate.id,
    name: candidate.name,
    cost: decimalString(candidate.cost),
    costUnit: candidate.costUnit,
    hasRecipe: recipeLinesOf(graph, candidate.id).length > 0,
    blockedByCycle: blocked.has(candidate.id) || candidate.id === productId,
  }));

  return {
    product: {
      id: product.id,
      name: product.name,
      slug: product.slug,
      status: product.status,
      price: decimalString(product.price),
      cost: decimalString(product.cost),
      costUnit: product.costUnit,
    },
    lines,
    totalCost: breakdown.totalCost === null ? null : String(breakdown.totalCost),
    incomplete: breakdown.incomplete,
    reasons: breakdown.reasons,
    candidates,
    conversions: conversions.map((row) => ({ fromUnit: row.fromUnit, toUnit: row.toUnit, factor: String(row.factor) })),
    currency: tenant?.defaultCurrency ?? "ARS",
  };
}

export type FichaRecipeLine = {
  ingredientProductId: number;
  name: string;
  quantity: string;
  unit: string;
  yieldPercent: string;
  convertedQuantity: string;
  baseUnit: string;
  isSubrecipe: boolean;
  unitCost: string | null;
  lineCost: string | null;
  depth: number;
};

export type RecipeFichaPayload = {
  product: {
    id: number;
    name: string;
    slug: string;
    status: string;
    price: string | null;
    cost: string | null;
    costUnit: string;
  };
  lines: FichaRecipeLine[];
  totalCost: string | null;
  margin: number | null;
  markup: number | null;
  incomplete: boolean;
  reasons: string[];
  usedIn: Array<{ id: number; name: string }>;
  recentCostHistory: Array<{ cost: string; unit: string; reason: string | null; createdAt: string }>;
  currency: string;
  tenantName: string;
  branchName: string | null;
};

/** @summary Carga los datos de la ficha técnica imprimible de una receta. */
export async function loadRecipeFichaData(
  context: AuthorizationContext,
  productId: number,
): Promise<RecipeFichaPayload | null> {
  const activeId = context.activeBranchId && context.activeBranchId > 0 ? context.activeBranchId : null;
  const tenantId = context.tenant.id;

  const [product, recipeContext, tenant, activeBranch, usedIn, costHistory] = await Promise.all([
    prisma.product.findFirst({
      where: { ...branchProductWhere(tenantId, activeId), id: productId },
      select: { id: true, name: true, slug: true, status: true, price: true, cost: true, costUnit: true },
    }),
    loadRecipeContext(tenantId),
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { defaultCurrency: true, name: true } }),
    activeId ? prisma.branch.findFirst({ where: { id: activeId, tenantId }, select: { name: true } }) : null,
    prisma.recipeIngredient.findMany({
      where: { tenantId, ingredientProductId: productId },
      select: { product: { select: { id: true, name: true } } },
      distinct: ["productId"],
    }),
    prisma.ingredientCostHistory.findMany({
      where: { tenantId, productId },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ]);
  if (!product) return null;

  const { graph, costInfo, conversions } = recipeContext;
  const tree = recipeBreakdownTree(graph, costInfo, conversions, productId);
  const price = product.price === null || product.price === undefined ? null : Number(product.price);
  const totalCost = tree.totalCost;

  const flat: FichaRecipeLine[] = [];
  const flatten = (lines: typeof tree.tree, depth: number) => {
    for (const line of lines) {
      flat.push({
        ingredientProductId: line.ingredientProductId,
        name: line.name,
        quantity: String(line.quantity),
        unit: line.unit,
        yieldPercent: String(line.yieldPercent),
        convertedQuantity: String(line.convertedQuantity),
        baseUnit: line.baseUnit,
        isSubrecipe: line.isSubrecipe,
        unitCost: line.unitCost === null ? null : String(line.unitCost),
        lineCost: line.lineCost === null ? null : String(line.lineCost),
        depth,
      });
      if (line.children.length) flatten(line.children, depth + 1);
    }
  };
  flatten(tree.tree, 0);

  return {
    product: {
      id: product.id,
      name: product.name,
      slug: product.slug,
      status: product.status,
      price: decimalString(product.price),
      cost: decimalString(product.cost),
      costUnit: product.costUnit,
    },
    lines: flat,
    totalCost: totalCost === null ? null : String(totalCost),
    margin: totalCost === null ? null : marginPercent(totalCost, price),
    markup: totalCost === null ? null : markupPercent(totalCost, price),
    incomplete: tree.incomplete,
    reasons: tree.reasons,
    usedIn: usedIn.map((entry) => ({ id: entry.product.id, name: entry.product.name })),
    recentCostHistory: costHistory.map((entry) => ({
      cost: String(Number(entry.cost)),
      unit: entry.unit,
      reason: entry.reason,
      createdAt: entry.createdAt.toISOString(),
    })),
    currency: tenant?.defaultCurrency ?? "ARS",
    tenantName: tenant?.name ?? context.tenant.name,
    branchName: activeBranch?.name ?? null,
  };
}
