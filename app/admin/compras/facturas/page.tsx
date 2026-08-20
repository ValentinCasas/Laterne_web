import { requirePermission } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { listPurchaseInvoices } from "@/lib/purchases";
import { ComprasFacturasClient } from "./client";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const context = await requirePermission("purchase.manage");
  return { title: `${context.tenant.name} | Facturas de compra` };
}

export default async function FacturasPage() {
  const context = await requirePermission("purchase.manage");
  const activeBranchId = context.activeBranchId && context.activeBranchId > 0 ? context.activeBranchId : null;
  const branchFilter = activeBranchId ? { branchId: activeBranchId } : {};
  const invoices = await listPurchaseInvoices(context.tenant.id, { ...branchFilter, limit: 100 });

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <ComprasFacturasClient initialInvoices={serialize(invoices.items) as any} total={invoices.total} />
  );
}
