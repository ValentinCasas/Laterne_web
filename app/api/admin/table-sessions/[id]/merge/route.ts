import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { mergeSessions, TableServiceError } from "@/lib/table-sessions";

const mergeInput = z.object({ targetSessionId: z.coerce.number().int().positive() });

/** @summary Une la mesa con otra: los consumos pasan al destino y la fuente se cierra. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("table.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  const parsed = mergeInput.safeParse(await request.json().catch(() => null));
  if (!Number.isInteger(id) || !parsed.success) {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
  try {
    const result = await mergeSessions(auth, id, parsed.data.targetSessionId);
    await recordAudit({
      context: auth,
      action: "table.merge",
      entityType: "table-session",
      entityId: id,
      newValues: { ...parsed.data, moved: result.moved },
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
