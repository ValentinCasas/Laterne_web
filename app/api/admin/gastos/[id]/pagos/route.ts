import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { payExpense } from "@/lib/expenses";
import { serialize } from "@/lib/format";

const paymentInput = z.object({
  amount: z.coerce.number().positive(),
  method: z.enum(["transferencia", "efectivo", "tarjeta", "otro"]),
  paidAt: z.string().optional(),
  notes: z.string().trim().max(240).optional(),
});

/** @summary Registra un pago parcial o total contra el gasto. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("purchase.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { id } = await params;
  const parsed = paymentInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisá los datos del pago" }, { status: 400 });

  try {
    const result = await payExpense(auth.tenant.id, auth.session.userId, {
      expenseId: Number(id),
      amount: parsed.data.amount,
      method: parsed.data.method,
      paidAt: parsed.data.paidAt,
      notes: parsed.data.notes,
    });
    await recordAudit({
      context: auth,
      action: "pay",
      entityType: "purchase-payment",
      entityId: result.payment.id,
      newValues: toAuditValue(serialize(result)),
      request,
    });
    return NextResponse.json({ item: serialize(result.payment), status: result.status, balance: result.balance }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo registrar el pago" },
      { status: error instanceof Error && "status" in error ? (error as { status?: number }).status ?? 400 : 400 },
    );
  }
}
