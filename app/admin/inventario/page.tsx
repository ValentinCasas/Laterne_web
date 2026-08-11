import { InventoryManager } from "@/components/admin/inventory-manager";
import { requirePermission } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> { const context = await requirePermission("product.manage"); return { title: `${context.tenant.name} | Inventario` }; }

/** @summary Carga productos, sucursales, existencias y últimos movimientos del negocio autorizado. */
export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ branchId?: string }> }) {
  const context = await requirePermission("product.manage");
  const requestedBranchId = Number((await searchParams).branchId);
  const selectedBranchId = context.branches.some((branch) => branch.id === requestedBranchId)
    ? requestedBranchId
    : context.branches[0]?.id ?? 0;
  const [branches, products, stocks, movements] = await Promise.all([
    prisma.branch.findMany({
      where: { id: { in: context.branches.map((branch) => branch.id) } },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
    prisma.product.findMany({
      where: { tenantId: context.tenant.id },
      select: { id: true, name: true, imageUrl: true, availability: true },
      orderBy: { name: "asc" },
    }),
    prisma.inventoryStock.findMany({ where: { tenantId: context.tenant.id, branchId: selectedBranchId } }),
    prisma.stockMovement.findMany({
       where: { tenantId: context.tenant.id, stock: { branchId: selectedBranchId } },
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
      initialStocks={serialize(stocks) as unknown as Parameters<typeof InventoryManager>[0]["initialStocks"]}
      movements={serialize(movements) as unknown as Parameters<typeof InventoryManager>[0]["movements"]}
      initialBranchId={selectedBranchId}
    />
  );
}
