import { PurchasesManager } from "@/components/admin/purchases-manager";
import { requirePermission } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { listPurchaseInvoices, listPurchaseOrders, listPurchaseReceipts, listSuppliers } from "@/lib/purchases";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

/**
 * @summary Genera los metadatos de la vista para el tenant autorizado.
 */
export async function generateMetadata(): Promise<Metadata> {
  const context = await requirePermission("purchase.manage");
  return { title: `${context.tenant.name} | Compras` };
}

/** @summary Carga el módulo de compras: pedidos, recepciones, facturas y proveedores. */
export default async function ComprasPage() {
  const context = await requirePermission("purchase.manage");
  const activeBranchId = context.activeBranchId && context.activeBranchId > 0 ? context.activeBranchId : null;

  const branchFilter = activeBranchId ? { branchId: activeBranchId } : {};
  const [branches, suppliers, products, orders, receipts, invoices, tenant] = await Promise.all([
    prisma.branch.findMany({
      where: { id: { in: context.branches.map((branch) => branch.id) } },
      orderBy: [{ active: "desc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true, active: true },
    }),
    listSuppliers(context.tenant.id),
    prisma.product.findMany({
      where: { tenantId: context.tenant.id },
      select: { id: true, name: true, cost: true, costUnit: true, imageUrl: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
    listPurchaseOrders(context.tenant.id, { ...branchFilter, limit: 60 }),
    listPurchaseReceipts(context.tenant.id, { ...branchFilter, limit: 40 }),
    listPurchaseInvoices(context.tenant.id, { limit: 60 }),
    prisma.tenant.findUnique({ where: { id: context.tenant.id }, select: { defaultCurrency: true } }),
  ]);

  const currency = tenant?.defaultCurrency || "ARS";
  return (
    <PurchasesManager
      initial={{
        tenantId: context.tenant.id,
        currency,
        activeBranchId,
        branches: serialize(branches) as unknown as Parameters<typeof PurchasesManager>[0]["initial"]["branches"],
        suppliers: serialize(suppliers) as unknown as Parameters<typeof PurchasesManager>[0]["initial"]["suppliers"],
        products: serialize(products) as unknown as Parameters<typeof PurchasesManager>[0]["initial"]["products"],
        orders: serialize(orders.items) as unknown as Parameters<typeof PurchasesManager>[0]["initial"]["orders"],
        receipts: serialize(receipts.items) as unknown as Parameters<typeof PurchasesManager>[0]["initial"]["receipts"],
        invoices: serialize(invoices.items) as unknown as Parameters<typeof PurchasesManager>[0]["initial"]["invoices"],
      }}
    />
  );
}
