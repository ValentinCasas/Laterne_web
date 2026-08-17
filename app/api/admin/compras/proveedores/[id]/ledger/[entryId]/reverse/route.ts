import { NextResponse } from "next/server";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { reverseSupplierLedgerEntry } from "@/lib/purchases";

/** @summary Revierte una entrada del ledger de proveedor. */
export async function POST(request: Request, { params }: { params: Promise<{ entryId: string }> }) {
  const auth = await authorize("purchase.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { entryId } = await params;
  const parsed = await request.json().catch(() => null);
  const reason = parsed?.reason ? String(parsed.reason).trim() : undefined;

  try {
    const reversal = await reverseSupplierLedgerEntry(auth.tenant.id, auth.user.id, Number(entryId), reason);
    await recordAudit({
      context: auth,
      action: "reverse",
      entityType: "supplier-ledger",
      entityId: Number(entryId),
      newValues: toAuditValue(serialize(reversal)),
      request,
    });
    return NextResponse.json(serialize(reversal));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo revertir el movimiento" },
      { status: 400 },
    );
  }
}
