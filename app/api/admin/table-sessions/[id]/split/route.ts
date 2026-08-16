import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { splitSession, TableServiceError } from "@/lib/table-sessions";

const splitInput = z.object({
  orderIds: z.array(z.coerce.number().int().positive()).min(1).max(60),
  targetTableId: z.coerce.number().int().positive(),
});

/** @summary Separa la cuenta moviendo comandas a una mesa libre de la misma sucursal. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("table.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  const parsed = splitInput.safeParse(await request.json().catch(() => null));
  if (!Number.isInteger(id) || !parsed.success) {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
  try {
    const result = await splitSession(auth, id, parsed.data.orderIds, parsed.data.targetTableId);
    await recordAudit({
      context: auth,
      action: "table.split",
      entityType: "table-session",
      entityId: id,
      newValues: { ...parsed.data, newSessionId: result.session.id, moved: result.moved },
      request,
    });
    return NextResponse.json({ session: serialize(result.session), moved: result.moved }, { status: 201 });
  } catch (reason) {
    if (reason instanceof TableServiceError) {
      return NextResponse.json({ error: reason.message }, { status: reason.status });
    }
    throw reason;
  }
}
