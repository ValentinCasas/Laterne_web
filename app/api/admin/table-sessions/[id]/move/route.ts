import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { moveTable, TableServiceError } from "@/lib/table-sessions";

const moveInput = z.object({ targetTableId: z.coerce.number().int().positive() });

/** @summary Traslada la mesa con su sesión y consumos abiertos a otra mesa de la misma sucursal. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("table.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  const parsed = moveInput.safeParse(await request.json().catch(() => null));
  if (!Number.isInteger(id) || !parsed.success) {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
  try {
    const result = await moveTable(auth, id, parsed.data.targetTableId);
    await recordAudit({
      context: auth,
      action: "table.move",
      entityType: "table-session",
      entityId: id,
      newValues: { targetTableId: parsed.data.targetTableId, movedOrders: result.movedOrders },
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
