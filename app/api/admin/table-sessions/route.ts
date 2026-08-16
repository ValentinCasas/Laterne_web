import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { openTableSession, TableServiceError } from "@/lib/table-sessions";

/** @summary Valida la entrada para abrir una mesa. */
const openInput = z.object({
  tableId: z.coerce.number().int().positive(),
  customerName: z.string().trim().max(160).optional(),
  phone: z.string().trim().max(60).optional(),
  partySize: z.coerce.number().int().min(1).max(100).default(1),
  waiterUserId: z.coerce.number().int().positive().optional().nullable(),
  notes: z.string().trim().max(2000).optional(),
  reserved: z.boolean().optional(),
});

/** @summary Abre una mesa creando su sesión operativa con validación de tenant/sucursal. */
export async function POST(request: Request) {
  const auth = await authorize("table.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = openInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisá los datos de la mesa" }, { status: 400 });
  try {
    const result = await openTableSession(auth, parsed.data);
    await recordAudit({
      context: auth,
      action: "table.open",
      entityType: "table-session",
      entityId: result.session.id,
      newValues: toAuditValue(serialize(result.session)),
      request,
    });
    return NextResponse.json({ session: serialize(result.session), table: result.table }, { status: 201 });
  } catch (reason) {
    if (reason instanceof TableServiceError) {
      return NextResponse.json({ error: reason.message }, { status: reason.status });
    }
    throw reason;
  }
}
