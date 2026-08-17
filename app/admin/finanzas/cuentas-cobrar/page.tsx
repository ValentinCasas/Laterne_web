import { FinanceReceivablesClient } from "@/components/admin/finanzas/finance-receivables";
import { requirePermission } from "@/lib/auth";
import { listReceivables, getReceivablesAging } from "@/lib/finance";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

/** @summary Genera los metadatos de la vista de cuentas a cobrar. */
export async function generateMetadata(): Promise<Metadata> {
  const context = await requirePermission("finance.view");
  return { title: `${context.tenant.name} | Finanzas | Cuentas a cobrar` };
}

/** @summary Carga las cuentas a cobrar con resumen de aging. */
export default async function FinanzasCuentasCobrarPage() {
  const context = await requirePermission("finance.view");
  const activeBranchId = context.activeBranchId && context.activeBranchId > 0 ? context.activeBranchId : null;

  const [documents, aging, tenant] = await Promise.all([
    listReceivables(context.tenant.id, { branchId: activeBranchId }),
    getReceivablesAging(context.tenant.id, activeBranchId),
    prisma.tenant.findUnique({
      where: { id: context.tenant.id },
      select: { defaultCurrency: true },
    }),
  ]);

  const currency = tenant?.defaultCurrency || "ARS";

  return (
    <FinanceReceivablesClient
      initial={{
        tenantId: context.tenant.id,
        currency,
        activeBranchId,
        documents: serialize(documents.items),
        aging: serialize(aging),
      }}
    />
  );
}
