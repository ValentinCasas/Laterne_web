import { InventoryManager } from "@/components/admin/inventory-manager";
import { requirePermission } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** @summary Carga productos, sucursales, existencias y últimos movimientos del negocio autorizado. */
export default async function InventoryPage() {
  const context = await requirePermission("product.manage");
  const [branches, products, stocks, movements] = await Promise.all([
    prisma.branch.findMany({
      where: { tenantId: context.tenant.id },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
    prisma.product.findMany({
      where: { tenantId: context.tenant.id },
      select: { id: true, name: true, imageUrl: true, availability: true },
      orderBy: { name: "asc" },
    }),
    prisma.inventoryStock.findMany({ where: { tenantId: context.tenant.id } }),
    prisma.stockMovement.findMany({
      where: { tenantId: context.tenant.id },
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
    />
  );
}
