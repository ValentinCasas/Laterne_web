import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { annulExpense, loadExpense, updateExpense } from "@/lib/expenses";
import { serialize } from "@/lib/format";

/** @summary Detalle de un gasto con pagos. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("purchase.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { id } = await params;
  try {
    const expense = await loadExpense(auth.tenant.id, Number(id));
    return NextResponse.json(serialize(expense));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar el gasto" },
      { status: 404 },
    );
  }
}

/** @summary Edita un gasto sin pagos. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("purchase.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { id } = await params;
  const parsed = z
    .object({
      categoryId: z.coerce.number().int().positive().optional(),
      supplierId: z.coerce.number().int().positive().nullable().optional(),
      branchId: z.coerce.number().int().positive().nullable().optional(),
      expenseDate: z.string().optional(),
      dueDate: z.string().nullable().optional(),
      amountNet: z.coerce.number().min(0).optional(),
      taxPercent: z.coerce.number().min(0).max(100).optional(),
      paymentMethod: z.string().trim().max(40).nullable().optional(),
      financialCategory: z.string().trim().max(80).nullable().optional(),
      notes: z.string().trim().max(2000).nullable().optional(),
      attachmentId: z.coerce.number().int().positive().nullable().optional(),
      status: z.string().max(24).optional(),
    })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisá los datos del gasto" }, { status: 400 });

  try {
    const expense = await updateExpense(auth.tenant.id, Number(id), parsed.data);
    await recordAudit({
      context: auth,
      action: "update",
      entityType: "expense",
      entityId: expense.id,
      newValues: toAuditValue(serialize(expense)),
      request,
    });
    return NextResponse.json({ item: serialize(expense) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo actualizar el gasto" },
      { status: error instanceof Error && "status" in error ? (error as { status?: number }).status ?? 400 : 400 },
    );
  }
}

/** @summary Anula un gasto sin pagos. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("purchase.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { id } = await params;
  const parsed = z.object({ status: z.literal("cancelled") }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Acción no válida" }, { status: 400 });

  try {
    const expense = await annulExpense(auth.tenant.id, Number(id));
    await recordAudit({
      context: auth,
      action: "annul",
      entityType: "expense",
      entityId: expense.id,
      newValues: { status: "cancelled" },
      request,
    });
    return NextResponse.json({ item: serialize(expense) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo anular el gasto" },
      { status: error instanceof Error && "status" in error ? (error as { status?: number }).status ?? 400 : 400 },
    );
  }
}
