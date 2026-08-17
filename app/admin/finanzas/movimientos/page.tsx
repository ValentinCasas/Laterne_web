import { FinanceMovementsClient } from "@/components/admin/finanzas/finance-movements";
import { requirePermission } from "@/lib/auth";
import { listFinancialMovements } from "@/lib/finance";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

/** @summary Genera los metadatos de la vista de movimientos financieros. */
export async function generateMetadata(): Promise<Metadata> {
  const context = await requirePermission("finance.view");
  return { title: `${context.tenant.name} | Finanzas | Movimientos` };
}

/** @summary Carga el listado de movimientos financieros con filtros iniciales. */
export default async function FinanzasMovimientosPage() {
  const context = await requirePermission("finance.view");
  const activeBranchId = context.activeBranchId && context.activeBranchId > 0 ? context.activeBranchId : null;

  const [movements, accounts, tenant] = await Promise.all([
    listFinancialMovements(context.tenant.id, { branchId: activeBranchId, limit: 50 }),
    prisma.financialAccount.findMany({
      where: { tenantId: context.tenant.id, status: "active" },
      select: { id: true, name: true, type: true },
      orderBy: { name: "asc" },
    }),
    prisma.tenant.findUnique({
      where: { id: context.tenant.id },
      select: { defaultCurrency: true },
    }),
  ]);

  const currency = tenant?.defaultCurrency || "ARS";

  return (
    <FinanceMovementsClient
      initial={{
        tenantId: context.tenant.id,
        currency,
        activeBranchId,
        movements: serialize(movements.items),
        accounts: serialize(accounts),
        total: movements.total,
      }}
    />
  );
}
