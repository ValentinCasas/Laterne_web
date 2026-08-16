import { IngredientsBoard } from "@/components/admin/ingredients-board";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

/**
 * @summary Genera los metadatos de la vista para el tenant autorizado.
 */
export async function generateMetadata(): Promise<Metadata> {
  const context = await requirePermission("product.manage");
  return { title: `${context.tenant.name} | Ingredientes` };
}

/** @summary Carga los datos del panel de ingredientes para el tenant autorizado. */
async function loadIngredientsData(context: Awaited<ReturnType<typeof requirePermission>>) {
  const [products, branches, tenant] = await Promise.all([
    prisma.product.findMany({
      where: { tenantId: context.tenant.id, status: { not: "archived" } },
      select: {
        id: true,
        name: true,
        cost: true,
        costUnit: true,
        status: true,
        recipeItems: { select: { id: true } },
        _count: { select: { usedInRecipes: true } },
        inventoryStocks: { include: { branch: { select: { id: true, name: true } } } },
        costHistory: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { name: "asc" },
    }),
    prisma.branch.findMany({
      where: { id: { in: context.branches.map((branch) => branch.id) } },
      select: { id: true, name: true },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
    prisma.tenant.findUnique({ where: { id: context.tenant.id }, select: { defaultCurrency: true } }),
  ]);

  const ingredientIds = new Set(
    products
      .filter(
        (product) =>
          product.cost !== null ||
          product.recipeItems.length > 0 ||
          product._count.usedInRecipes > 0 ||
          product.inventoryStocks.some((stock) => stock.tracked),
      )
      .map((product) => product.id),
  );

  const ingredients = products
    .filter((product) => ingredientIds.has(product.id))
    .map((product) => {
      const lastCost = product.costHistory[0] ?? null;
      return {
        id: product.id,
        name: product.name,
        cost: product.cost === null || product.cost === undefined ? null : String(Number(product.cost)),
        costUnit: product.costUnit,
        status: product.status,
        hasRecipe: product.recipeItems.length > 0,
        usedInCount: product._count.usedInRecipes,
        stocks: product.inventoryStocks.map((stock) => ({
          branchId: stock.branchId,
          branchName: stock.branch.name,
          current: String(Number(stock.current)),
          minimum: String(Number(stock.minimum)),
          tracked: stock.tracked,
          unit: stock.unit,
        })),
        lastCost: lastCost
          ? {
              cost: String(Number(lastCost.cost)),
              unit: lastCost.unit,
              reason: lastCost.reason,
              createdAt: lastCost.createdAt.toISOString(),
            }
          : null,
      };
    });

  return {
    ingredients,
    branches: branches.map((branch) => ({ id: branch.id, name: branch.name })),
    currency: tenant?.defaultCurrency ?? "ARS",
  };
}

/**
 * @summary Página de ingredientes con costo, stock por sucursal y conversiones.
 */
export default async function IngredientsPage() {
  const context = await requirePermission("product.manage");
  const payload = await loadIngredientsData(context);
  return <IngredientsBoard initial={payload} />;
}
