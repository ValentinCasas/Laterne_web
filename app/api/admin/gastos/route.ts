import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { createExpense, expenseSummary, listExpenses } from "@/lib/expenses";
import { serialize } from "@/lib/format";

const expenseInput = z.object({
  categoryId: z.coerce.number().int().positive(),
  supplierId: z.coerce.number().int().positive().nullable().optional(),
  branchId: z.coerce.number().int().positive().nullable().optional(),
  expenseDate: z.string().optional(),
  dueDate: z.string().nullable().optional(),
  amountNet: z.coerce.number().min(0),
  taxPercent: z.coerce.number().min(0).max(100).optional().default(0),
  paymentMethod: z.string().trim().max(40).nullable().optional(),
  financialCategory: z.string().trim().max(80).nullable().optional(),
  notes: z.string().trim().max(2000).optional(),
  attachmentId: z.coerce.number().int().positive().nullable().optional(),
  recurringId: z.coerce.number().int().positive().nullable().optional(),
});

/** @summary Lista gastos con filtros. */
export async function GET(request: Request) {
  const auth = await authorize("purchase.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const url = new URL(request.url);
  const [list, summary] = await Promise.all([
    listExpenses(auth.tenant.id, {
      branchId: url.searchParams.get("branchId") ? Number(url.searchParams.get("branchId")) : null,
      supplierId: url.searchParams.get("supplierId") ? Number(url.searchParams.get("supplierId")) : null,
      categoryId: url.searchParams.get("categoryId") ? Number(url.searchParams.get("categoryId")) : null,
      status: url.searchParams.get("status") || undefined,
      query: url.searchParams.get("q") || undefined,
      from: url.searchParams.get("from") || undefined,
      to: url.searchParams.get("to") || undefined,
      limit: Number(url.searchParams.get("limit") ?? 60),
      offset: Number(url.searchParams.get("offset") ?? 0),
    }),
    expenseSummary(auth.tenant.id),
  ]);
  return NextResponse.json(serialize({ ...list, summary }));
}

/** @summary Crea un gasto que no afecta inventario. */
export async function POST(request: Request) {
  const auth = await authorize("purchase.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = expenseInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisá los datos del gasto" }, { status: 400 });

  try {
    const expense = await createExpense(auth.tenant.id, auth.session.userId, {
      ...parsed.data,
      attachmentId: parsed.data.attachmentId ?? null,
    });
    await recordAudit({
      context: auth,
      action: "create",
      entityType: "expense",
      entityId: expense.id,
      newValues: toAuditValue(serialize(expense)),
      request,
    });
    return NextResponse.json({ item: serialize(expense) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo crear el gasto" },
      { status: error instanceof Error && "status" in error ? (error as { status?: number }).status ?? 400 : 400 },
    );
  }
}
