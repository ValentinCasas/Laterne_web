import { NextResponse } from "next/server";
import { recordAudit } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { closeTableSession, TableServiceError } from "@/lib/table-sessions";

/** @summary Cierra la mesa: entrega los consumos abiertos y cierra la sesión con su timeline. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("order.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  try {
    const result = await closeTableSession(auth, id);
    await recordAudit({
      context: auth,
      action: "table.close",
      entityType: "table-session",
      entityId: id,
      newValues: { delivered: result.delivered, total: result.total },
      request,
    });
    return NextResponse.json(result);
  } catch (reason) {
    if (reason instanceof TableServiceError) {
      return NextResponse.json({ error: reason.message }, { status: reason.status });
    }
    throw reason;
  }
}
