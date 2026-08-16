import { InventoryManager } from "@/components/admin/inventory-manager";
import { requirePermission } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { inventoryPolicy, loadCountSessions, loadInventoryDashboard, loadTransfers } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
/**
 * @summary Genera los metadatos de la vista para el tenant autorizado.
 */
export async function generateMetadata(): Promise<Metadata> {
  const context = await requirePermission("product.manage");
  return { title: `${context.tenant.name} | Inventario` };
}

/** @summary Carga inventario usando exclusivamente la sucursal explícita de la URL o el contexto consolidado. */
export default async function InventoryPage() {
  const context = await requirePermission("product.manage");
  const selectedBranchId =
    context.activeBranchId != null && context.activeBranchId > 0 ? context.activeBranchId : 0;
  const stockWhere = selectedBranchId
    ? { tenantId: context.tenant.id, branchId: selectedBranchId }
    : { tenantId: context.tenant.id };
  const movementWhere = selectedBranchId
    ? { tenantId: context.tenant.id, stock: { branchId: selectedBranchId } }
    : { tenantId: context.tenant.id };

  const [branches, products, categories, stocks, movements, settings] = await Promise.all([
      prisma.branch.findMany({
        where: { id: { in: context.branches.map((branch) => branch.id) } },
        orderBy: [{ active: "desc" }, { name: "asc" }],
      }),
      prisma.product.findMany({
        where: { tenantId: context.tenant.id },
        select: {
          id: true,
          name: true,
          imageUrl: true,
          availability: true,
          cost: true,
          costUnit: true,
          categories: { include: { category: { select: { id: true, name: true } } } },
        },
        orderBy: { name: "asc" },
      }),
      prisma.category.findMany({
        where: { tenantId: context.tenant.id },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.inventoryStock.findMany({ where: stockWhere }),
      prisma.stockMovement.findMany({
        where: movementWhere,
        include: {
          stock: {
            select: {
              productId: true,
              product: { select: { name: true } },
              branch: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 60,
      }),
      inventoryPolicy(context.tenant.id),
    ]);

  const conversions = await prisma.unitConversion.findMany({
    where: { tenantId: context.tenant.id },
    select: { fromUnit: true, toUnit: true, factor: true },
  });
  const dashboardData = await loadInventoryDashboard(
    context.tenant.id,
    selectedBranchId || null,
    conversions.map((row) => ({ fromUnit: row.fromUnit, toUnit: row.toUnit, factor: Number(row.factor) })),
  );
  const countSessions = await loadCountSessions(context.tenant.id, selectedBranchId || undefined);
  const transferRows = await loadTransfers(context.tenant.id, selectedBranchId || undefined);

  return (
    <InventoryManager
      branches={serialize(branches)}
      products={serialize(products) as unknown as Parameters<typeof InventoryManager>[0]["products"]}
      categories={serialize(categories)}
      initialStocks={serialize(stocks) as unknown as Parameters<typeof InventoryManager>[0]["initialStocks"]}
      movements={serialize(movements) as unknown as Parameters<typeof InventoryManager>[0]["movements"]}
      initialBranchId={selectedBranchId}
      settings={serialize(settings)}
      dashboard={serialize(dashboardData) as unknown as Parameters<typeof InventoryManager>[0]["dashboard"]}
      initialCounts={serialize(countSessions) as unknown as Parameters<typeof InventoryManager>[0]["initialCounts"]}
      initialTransfers={serialize(transferRows) as unknown as Parameters<typeof InventoryManager>[0]["initialTransfers"]}
    />
  );
}
