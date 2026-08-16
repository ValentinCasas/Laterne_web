import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { saveTablePosition, TableServiceError } from "@/lib/table-sessions";

const positionInput = z.object({
  x: z.coerce.number().min(0).max(1000),
  y: z.coerce.number().min(0).max(1000),
});

/** @summary Guarda la posición de la mesa en el plano del salón. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("table.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  const parsed = positionInput.safeParse(await request.json().catch(() => null));
  if (!Number.isInteger(id) || !parsed.success) {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
  try {
    const result = await saveTablePosition(auth, id, parsed.data.x, parsed.data.y);
    await recordAudit({
      context: auth,
      action: "table.position",
      entityType: "dining-table",
      entityId: id,
      newValues: parsed.data,
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
