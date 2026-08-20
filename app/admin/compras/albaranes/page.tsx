import { requirePermission } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { listPurchaseReceipts } from "@/lib/purchases";
import { ComprasAlbaranesClient } from "./client";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const context = await requirePermission("purchase.manage");
  return { title: `${context.tenant.name} | Albaranes de compra` };
}

export default async function AlbaranesPage() {
  const context = await requirePermission("purchase.manage");
  const activeBranchId = context.activeBranchId && context.activeBranchId > 0 ? context.activeBranchId : null;
  const branchFilter = activeBranchId ? { branchId: activeBranchId } : {};
  const receipts = await listPurchaseReceipts(context.tenant.id, { ...branchFilter, limit: 100 });

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <ComprasAlbaranesClient initialReceipts={serialize(receipts.items) as any} total={receipts.total} />
  );
}
