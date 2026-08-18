import { IngredientFicha } from "@/components/admin/ingredient-ficha";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
  const [product, stocks, costHistory, conversions, usedIn] = await Promise.all([
    prisma.product.findFirst({
      where: { id, tenantId: context.tenant.id },
      select: { id: true, name: true, status: true, cost: true, costUnit: true },
    }),
    prisma.inventoryStock.findMany({
      where: { tenantId: context.tenant.id, productId: id },
      include: { branch: { select: { id: true, name: true } } },
    }),
    prisma.ingredientCostHistory.findMany({
      where: { tenantId: context.tenant.id, productId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.unitConversion.findMany({
      where: { tenantId: context.tenant.id },
      select: { fromUnit: true, toUnit: true, factor: true },
      orderBy: [{ fromUnit: "asc" }, { toUnit: "asc" }],
    }),
    prisma.recipeIngredient.findMany({
      where: { tenantId: context.tenant.id, ingredientProductId: id },
      select: { product: { select: { id: true, name: true, status: true } } },
      distinct: ["productId"],
    }),
  ]);

  if (!product) return null;

  const branchIds = new Set(context.branches.map((branch) => branch.id));
  const accessibleStocks = stocks
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
      id: product.id,
      name: product.name,
      status: product.status,
      cost: product.cost === null || product.cost === undefined ? null : String(Number(product.cost)),
      costUnit: product.costUnit,
    },
    stocks: accessibleStocks,
    costHistory: costHistory.map((entry) => ({
      cost: String(Number(entry.cost)),
      unit: entry.unit,
      reason: entry.reason,
      createdAt: entry.createdAt.toISOString(),
    })),
    conversions: conversions.map((row) => ({ fromUnit: row.fromUnit, toUnit: row.toUnit, factor: String(Number(row.factor)) })),
    usedIn: usedIn.map((entry) => ({ id: entry.product.id, name: entry.product.name, status: entry.product.status })),
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
