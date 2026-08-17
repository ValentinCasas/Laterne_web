import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { reverseReceivablePayment } from "@/lib/finance";

const reverseSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await authorize("finance.reversal");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const id = Number((await context.params).id);
  const parsed = reverseSchema.safeParse(await request.json().catch(() => null));
  if (!Number.isInteger(id) || !parsed.success)
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });

  try {
    const payment = await reverseReceivablePayment(auth.tenant.id, auth.session.userId, id, parsed.data.reason);
    await recordAudit({
      context: auth,
      action: "receivable-payment-reversal",
      entityType: "receivable-payment",
      entityId: id,
      newValues: toAuditValue({ reversed: true, reason: parsed.data.reason }),
      request,
    });
    return NextResponse.json({ payment: serialize(payment) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo anular el pago" },
      { status: error instanceof Error && "status" in error ? (error as { status?: number }).status ?? 400 : 400 },
    );
  }
}
