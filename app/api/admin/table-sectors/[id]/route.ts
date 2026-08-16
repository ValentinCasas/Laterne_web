import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { deleteTableSector, TableServiceError, updateTableSector } from "@/lib/table-sessions";

const sectorUpdate = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

/** @summary Actualiza nombre, orden o visibilidad de un sector del salón. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("table.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  const parsed = sectorUpdate.safeParse(await request.json().catch(() => null));
  if (!Number.isInteger(id) || !parsed.success) {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
  try {
    const result = await updateTableSector(auth, id, parsed.data);
    await recordAudit({
      context: auth,
      action: "sector.update",
      entityType: "table-sector",
      entityId: id,
      newValues: toAuditValue(serialize(result.sector)),
      request,
    });
    return NextResponse.json({ sector: serialize(result.sector) });
  } catch (reason) {
    if (reason instanceof TableServiceError) {
      return NextResponse.json({ error: reason.message }, { status: reason.status });
    }
    throw reason;
  }
}

/** @summary Elimina un sector desvinculando sus mesas sin borrar pedidos históricos. */
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("table.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  try {
    const result = await deleteTableSector(auth, id);
    await recordAudit({
      context: auth,
      action: "sector.delete",
      entityType: "table-sector",
      entityId: id,
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
