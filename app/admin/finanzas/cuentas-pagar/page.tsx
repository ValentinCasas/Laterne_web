import { FinancePayablesClient } from "@/components/admin/finanzas/finance-payables";
import { requirePermission } from "@/lib/auth";
import { listPayables, getPayablesAging } from "@/lib/finance";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

/** @summary Genera los metadatos de la vista de cuentas a pagar. */
export async function generateMetadata(): Promise<Metadata> {
  const context = await requirePermission("finance.view");
  return { title: `${context.tenant.name} | Finanzas | Cuentas a pagar` };
}

/** @summary Carga las cuentas a pagar desde el ledger de proveedores. */
export default async function FinanzasCuentasPagarPage() {
  const context = await requirePermission("finance.view");
  const activeBranchId = context.activeBranchId && context.activeBranchId > 0 ? context.activeBranchId : null;

  const [items, aging, tenant] = await Promise.all([
    listPayables(context.tenant.id, { branchId: activeBranchId }),
    getPayablesAging(context.tenant.id, activeBranchId),
    prisma.tenant.findUnique({
      where: { id: context.tenant.id },
      select: { defaultCurrency: true },
    }),
  ]);

  const currency = tenant?.defaultCurrency || "ARS";

  return (
    <FinancePayablesClient
      initial={{
        tenantId: context.tenant.id,
        currency,
        activeBranchId,
        items: serialize(items.items),
        aging: serialize(aging),
      }}
    />
  );
}
