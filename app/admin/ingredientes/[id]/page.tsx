import { IngredientFicha } from "@/components/admin/ingredient-ficha";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { safeQuery } from "@/lib/safe-query";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

/**
 * @summary Genera los metadatos de la ficha de ingrediente.
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const context = await requirePermission("product.manage");
  const id = Number((await params).id);
  const product = Number.isInteger(id)
    ? await prisma.product.findFirst({
        where: { id, tenantId: context.tenant.id },
        select: { id: true, name: true },
      })
    : null;
  return { title: `${context.tenant.name} | ${product?.name ?? "Ingrediente"}` };
}

/**
 * @summary Carga el detalle completo de un ingrediente para la ficha.
 */
async function loadIngredientDetail(context: Awaited<ReturnType<typeof requirePermission>>, id: number) {
  const logCtx = { tenantId: context.tenant.id, module: "ingredientes.detail" };

  const [product, stocks, costHistory, conversions, usedIn] = await Promise.allSettled([
    safeQuery({ name: "product.findFirst", fallback: null, context: logCtx, query: () => prisma.product.findFirst({ where: { id, tenantId: context.tenant.id }, select: { id: true, name: true, status: true, cost: true, costUnit: true } }) }),
    safeQuery({ name: "inventoryStock.findMany", fallback: [], context: logCtx, query: () => prisma.inventoryStock.findMany({ where: { tenantId: context.tenant.id, productId: id }, include: { branch: { select: { id: true, name: true } } } }) }),
    safeQuery({ name: "ingredientCostHistory.findMany", fallback: [], context: logCtx, query: () => prisma.ingredientCostHistory.findMany({ where: { tenantId: context.tenant.id, productId: id }, orderBy: { createdAt: "desc" }, take: 20 }) }),
    safeQuery({ name: "unitConversion.findMany", fallback: [], context: logCtx, query: () => prisma.unitConversion.findMany({ where: { tenantId: context.tenant.id }, select: { fromUnit: true, toUnit: true, factor: true }, orderBy: [{ fromUnit: "asc" }, { toUnit: "asc" }] }) }),
    safeQuery({ name: "recipeIngredient.findMany", fallback: [], context: logCtx, query: () => prisma.recipeIngredient.findMany({ where: { tenantId: context.tenant.id, ingredientProductId: id }, select: { product: { select: { id: true, name: true, status: true } } }, distinct: ["productId"] }) }),
  ]);

  const productVal = product.status === "fulfilled" ? product.value : null;
  const stocksVal = stocks.status === "fulfilled" ? stocks.value : [];
  const costHistoryVal = costHistory.status === "fulfilled" ? costHistory.value : [];
  const conversionsVal = conversions.status === "fulfilled" ? conversions.value : [];
  const usedInVal = usedIn.status === "fulfilled" ? usedIn.value : [];

  if (!productVal) return null;

  const branchIds = new Set(context.branches.map((branch) => branch.id));
  const accessibleStocks = stocksVal
    .filter((stock) => branchIds.has(stock.branchId))
    .map((stock) => ({
      branchId: stock.branchId,
      branchName: stock.branch.name,
      current: String(Number(stock.current)),
      minimum: String(Number(stock.minimum)),
      tracked: stock.tracked,
      unit: stock.unit,
    }));

  return {
    product: {
      id: productVal.id,
      name: productVal.name,
      status: productVal.status,
      cost: productVal.cost === null || productVal.cost === undefined ? null : String(Number(productVal.cost)),
      costUnit: productVal.costUnit,
    },
    stocks: accessibleStocks,
    costHistory: costHistoryVal.map((entry) => ({
      cost: String(Number(entry.cost)),
      unit: entry.unit,
      reason: entry.reason,
      createdAt: entry.createdAt.toISOString(),
    })),
    conversions: conversionsVal.map((row) => ({ fromUnit: row.fromUnit, toUnit: row.toUnit, factor: String(Number(row.factor)) })),
    usedIn: usedInVal.map((entry) => ({ id: entry.product.id, name: entry.product.name, status: entry.product.status })),
  };
}

/**
 * @summary Página de ficha de ingrediente con tabs.
 */
export default async function IngredientFichaPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await requirePermission("product.manage");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) {
    return (
      <div className="rounded-[1.5rem] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-10 text-center">
        <p className="text-lg font-bold">Ingrediente inválido</p>
      </div>
    );
  }

  const payload = await loadIngredientDetail(context, id);
  if (!payload) {
    return (
      <div className="rounded-[1.5rem] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-10 text-center">
        <p className="text-lg font-bold">Ingrediente no encontrado</p>
      </div>
    );
  }

  return <IngredientFicha initial={payload} />;
}
