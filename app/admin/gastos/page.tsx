import { ExpensesManager } from "@/components/admin/expenses-manager";
import { requirePermission } from "@/lib/auth";
import { expenseSummary, listExpenseCategories, listExpenses, listRecurringExpenses } from "@/lib/expenses";
import { listSuppliers } from "@/lib/purchases";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

/**
 * @summary Genera los metadatos de la vista para el tenant autorizado.
 */
export async function generateMetadata(): Promise<Metadata> {
  const context = await requirePermission("purchase.manage");
  return { title: `${context.tenant.name} | Gastos` };
}

/** @summary Carga el módulo de gastos: listado, KPIs, categorías y previsiones recurrentes. */
export default async function GastosPage() {
  const context = await requirePermission("purchase.manage");
  const activeBranchId = context.activeBranchId && context.activeBranchId > 0 ? context.activeBranchId : null;

  const [branches, suppliers, categories, expenses, recurring, summary, tenant] = await Promise.all([
    prisma.branch.findMany({
      where: { id: { in: context.branches.map((branch) => branch.id) } },
      orderBy: [{ active: "desc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true, active: true },
    }),
    listSuppliers(context.tenant.id),
    listExpenseCategories(context.tenant.id, true),
    listExpenses(context.tenant.id, { limit: 60 }),
    listRecurringExpenses(context.tenant.id),
    expenseSummary(context.tenant.id),
    prisma.tenant.findUnique({ where: { id: context.tenant.id }, select: { defaultCurrency: true } }),
  ]);

  const currency = tenant?.defaultCurrency || "ARS";
  return (
    <ExpensesManager
      initial={{
        tenantId: context.tenant.id,
        currency,
        activeBranchId,
        branches: serialize(branches) as unknown as Parameters<typeof ExpensesManager>[0]["initial"]["branches"],
        suppliers: serialize(suppliers) as unknown as Parameters<typeof ExpensesManager>[0]["initial"]["suppliers"],
        categories: serialize(categories) as unknown as Parameters<typeof ExpensesManager>[0]["initial"]["categories"],
        expenses: serialize(expenses.items) as unknown as Parameters<typeof ExpensesManager>[0]["initial"]["expenses"],
        recurring: serialize(recurring) as unknown as Parameters<typeof ExpensesManager>[0]["initial"]["recurring"],
        summary: serialize(summary) as unknown as Parameters<typeof ExpensesManager>[0]["initial"]["summary"],
      }}
    />
  );
}
