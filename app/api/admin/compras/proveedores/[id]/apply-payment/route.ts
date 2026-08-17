import { NextResponse } from "next/server";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { applySupplierPayment } from "@/lib/purchases";

/** @summary Aplica un pago a las partidas abiertas seleccionadas del proveedor. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("purchase.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { id } = await params;
  const parsed = await request.json().catch(() => null);
  if (!parsed || typeof parsed !== "object") {
    return NextResponse.json({ error: "Revisá los datos del pago" }, { status: 400 });
  }

  try {
    const amount = Number(parsed.amount);
    const entryIds = Array.isArray(parsed.entryIds) ? parsed.entryIds.map(Number) : [];
    const method = typeof parsed.method === "string" ? parsed.method : "transferencia";
    const notes = typeof parsed.notes === "string" ? parsed.notes : null;

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "El monto debe ser mayor a cero" }, { status: 400 });
    }
    if (!entryIds.length) {
      return NextResponse.json({ error: "Seleccioná al menos una partida" }, { status: 400 });
    }

    const result = await applySupplierPayment(auth.tenant.id, auth.user.id, Number(id), {
      amount,
      entryIds,
      method,
      notes,
    });

    await recordAudit({
      context: auth,
      action: "create",
      entityType: "supplier-payment",
      entityId: Number(id),
      newValues: toAuditValue(serialize(result)),
      request,
    });

    return NextResponse.json(serialize(result));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo aplicar el pago" },
      { status: 400 },
    );
  }
}
