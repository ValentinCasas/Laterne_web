import { FinanceDashboardClient } from "@/components/admin/finanzas/finance-dashboard";
import { requirePermission } from "@/lib/auth";
import { getFinanceDashboard } from "@/lib/finance";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

/** @summary Genera los metadatos de la vista de resumen financiero. */
export async function generateMetadata(): Promise<Metadata> {
  const context = await requirePermission("finance.view");
  return { title: `${context.tenant.name} | Finanzas` };
}

/** @summary Carga el dashboard financiero con KPIs y movimientos recientes. */
export default async function FinanzasPage() {
  const context = await requirePermission("finance.view");
  const activeBranchId = context.activeBranchId && context.activeBranchId > 0 ? context.activeBranchId : null;

  const [dashboard, tenant] = await Promise.all([
    getFinanceDashboard(context.tenant.id, { branchId: activeBranchId }),
    prisma.tenant.findUnique({
      where: { id: context.tenant.id },
      select: { defaultCurrency: true },
    }),
  ]);

  const currency = tenant?.defaultCurrency || "ARS";

  return (
    <FinanceDashboardClient
      initial={{
        tenantId: context.tenant.id,
        currency,
        activeBranchId,
        dashboard: serialize(dashboard),
      }}
    />
  );
}
