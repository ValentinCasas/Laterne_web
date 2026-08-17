import { FinanceAccountsClient } from "@/components/admin/finanzas/finance-accounts";
import { requirePermission } from "@/lib/auth";
import { listFinancialAccounts } from "@/lib/finance";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

/** @summary Genera los metadatos de la vista de cuentas financieras. */
export async function generateMetadata(): Promise<Metadata> {
  const context = await requirePermission("finance.view");
  return { title: `${context.tenant.name} | Finanzas | Cuentas` };
}

/** @summary Carga el listado de cuentas financieras del negocio. */
export default async function FinanzasCuentasPage() {
  const context = await requirePermission("finance.view");
  const activeBranchId = context.activeBranchId && context.activeBranchId > 0 ? context.activeBranchId : null;

  const [accounts, tenant] = await Promise.all([
    listFinancialAccounts(context.tenant.id, { branchId: activeBranchId }),
    prisma.tenant.findUnique({
      where: { id: context.tenant.id },
      select: { defaultCurrency: true },
    }),
  ]);

  const currency = tenant?.defaultCurrency || "ARS";

  return (
    <FinanceAccountsClient
      initial={{
        tenantId: context.tenant.id,
        currency,
        activeBranchId,
        accounts: serialize(accounts),
      }}
    />
  );
}
