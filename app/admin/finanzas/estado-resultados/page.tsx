import { FinancePlClient } from "@/components/admin/finanzas/finance-pl";
import { requirePermission } from "@/lib/auth";
import { getProfitLoss } from "@/lib/finance";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

/** @summary Genera los metadatos de la vista de estado de resultados. */
export async function generateMetadata(): Promise<Metadata> {
  const context = await requirePermission("finance.view");
  return { title: `${context.tenant.name} | Finanzas | Estado de resultados` };
}

/** @summary Carga el estado de resultados del período actual. */
export default async function FinanzasEstadoResultadosPage() {
  const context = await requirePermission("finance.view");
  const activeBranchId = context.activeBranchId && context.activeBranchId > 0 ? context.activeBranchId : null;

  const [pl, tenant] = await Promise.all([
    getProfitLoss(context.tenant.id, { branchId: activeBranchId }),
    prisma.tenant.findUnique({
      where: { id: context.tenant.id },
      select: { defaultCurrency: true },
    }),
  ]);

  const currency = tenant?.defaultCurrency || "ARS";

  return (
    <FinancePlClient
      initial={{
        tenantId: context.tenant.id,
        currency,
        activeBranchId,
        pl: serialize(pl),
      }}
    />
  );
}
