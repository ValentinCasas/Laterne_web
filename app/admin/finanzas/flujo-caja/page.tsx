import { FinanceCashflowClient } from "@/components/admin/finanzas/finance-cashflow";
import { requirePermission } from "@/lib/auth";
import { getCashFlow } from "@/lib/finance";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

/** @summary Genera los metadatos de la vista de flujo de caja. */
export async function generateMetadata(): Promise<Metadata> {
  const context = await requirePermission("finance.view");
  return { title: `${context.tenant.name} | Finanzas | Flujo de caja` };
}

/** @summary Carga el flujo de caja del período actual. */
export default async function FinanzasFlujoCajaPage() {
  const context = await requirePermission("finance.view");
  const activeBranchId = context.activeBranchId && context.activeBranchId > 0 ? context.activeBranchId : null;

  const [cashFlow, branches, tenant] = await Promise.all([
    getCashFlow(context.tenant.id, { branchId: activeBranchId, period: "month" }),
    prisma.branch.findMany({
      where: { id: { in: context.branches.map((b) => b.id) } },
      orderBy: [{ active: "desc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true, active: true },
    }),
    prisma.tenant.findUnique({
      where: { id: context.tenant.id },
      select: { defaultCurrency: true },
    }),
  ]);

  const currency = tenant?.defaultCurrency || "ARS";

  return (
    <FinanceCashflowClient
      initial={{
        tenantId: context.tenant.id,
        currency,
        activeBranchId,
        cashFlow: serialize(cashFlow),
        branches: serialize(branches),
      }}
    />
  );
}
