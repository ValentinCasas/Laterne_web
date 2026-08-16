import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { tableSessionStatuses } from "@/lib/table-status";
import { TableServiceError, updateTableSession } from "@/lib/table-sessions";

/** @summary Valida la actualización de una sesión de mesa. */
const updateInput = z.object({
  customerName: z.string().trim().max(160).optional(),
  phone: z.string().trim().max(60).optional(),
  partySize: z.coerce.number().int().min(1).max(100).optional(),
  waiterUserId: z.coerce.number().int().positive().optional().nullable(),
  notes: z.string().trim().max(2000).optional(),
  status: z.enum(tableSessionStatuses).optional(),
});

/** @summary Actualiza los datos operativos de una mesa abierta (cliente, comensales, camarero, estado). */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("table.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  const parsed = updateInput.safeParse(await request.json().catch(() => null));
  if (!Number.isInteger(id) || !parsed.success) {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
  try {
    const result = await updateTableSession(auth, id, parsed.data);
    if (result.changed) {
      await recordAudit({
        context: auth,
        action: "table.update",
        entityType: "table-session",
        entityId: id,
        newValues: toAuditValue(serialize(result.session)),
        request,
      });
    }
    return NextResponse.json({ session: serialize(result.session) });
  } catch (reason) {
    if (reason instanceof TableServiceError) {
      return NextResponse.json({ error: reason.message }, { status: reason.status });
    }
    throw reason;
  }
}
