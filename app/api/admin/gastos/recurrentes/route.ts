import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { createRecurringExpense, listRecurringExpenses } from "@/lib/expenses";
import { serialize } from "@/lib/format";

const recurringInput = z.object({
  name: z.string().trim().min(1).max(160),
  amount: z.coerce.number().positive(),
  periodicity: z.enum(["monthly", "weekly", "yearly"]),
  categoryId: z.coerce.number().int().positive().nullable().optional(),
  dayOfMonth: z.coerce.number().int().min(1).max(31).nullable().optional(),
  dayOfWeek: z.coerce.number().int().min(0).max(6).nullable().optional(),
  nextDueDate: z.string().optional(),
  notes: z.string().trim().max(2000).optional(),
});

/** @summary Lista gastos recurrentes previstos. */
export async function GET() {
  const auth = await authorize("purchase.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const items = await listRecurringExpenses(auth.tenant.id);
  return NextResponse.json(serialize(items));
}

/** @summary Crea una previsión de gasto recurrente (no genera movimientos reales). */
export async function POST(request: Request) {
  const auth = await authorize("purchase.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = recurringInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisá los datos del gasto recurrente" }, { status: 400 });

  try {
    const recurring = await createRecurringExpense(auth.tenant.id, parsed.data);
    await recordAudit({
      context: auth,
      action: "create",
      entityType: "recurring-expense",
      entityId: recurring.id,
      newValues: toAuditValue(serialize(recurring)),
      request,
    });
    return NextResponse.json({ item: serialize(recurring) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo crear la previsión" },
      { status: error instanceof Error && "status" in error ? (error as { status?: number }).status ?? 400 : 400 },
    );
  }
}
