import { InventoryManager } from "@/components/admin/inventory-manager";
import { requirePermission } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const context = await requirePermission("product.manage");
  return { title: `${context.tenant.name} | Inventario` };
}

/** @summary Carga inventario usando exclusivamente la sucursal explícita de la URL o el scope consolidado. */
export default async function InventoryPage() {
  const context = await requirePermission("product.manage");
  const selectedBranchId = context.activeBranchId != null && context.activeBranchId > 0 ? context.activeBranchId : 0;
  const stockWhere = selectedBranchId
    ? { tenantId: context.tenant.id, branchId: selectedBranchId }
    : { tenantId: context.tenant.id };
  const movementWhere = selectedBranchId
    ? { tenantId: context.tenant.id, stock: { branchId: selectedBranchId } }
    : { tenantId: context.tenant.id };

  const [branches, products, categories, stocks, movements] = await Promise.all([
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
        stock: { include: { product: { select: { name: true } }, branch: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  return (
    <InventoryManager
      branches={serialize(branches)}
      products={serialize(products)}
      categories={serialize(categories)}
      initialStocks={serialize(stocks) as unknown as Parameters<typeof InventoryManager>[0]["initialStocks"]}
      movements={serialize(movements) as unknown as Parameters<typeof InventoryManager>[0]["movements"]}
      initialBranchId={selectedBranchId}
    />
  );
}
