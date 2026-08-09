import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const ticketUpdate = z.object({
  status: z.enum(["open", "in_progress", "resolved", "closed"]),
  adminNotes: z.string().trim().max(4000).optional(),
});

/** @summary Actualiza el estado y notas internas de una consulta de soporte. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("support.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  const parsed = ticketUpdate.safeParse(await request.json().catch(() => null));
  if (!Number.isInteger(id) || !parsed.success)
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  const current = await prisma.supportTicket.findFirst({ where: { id, tenantId: auth.tenant.id } });
  if (!current) return NextResponse.json({ error: "Consulta no encontrada" }, { status: 404 });
  const ticket = await prisma.supportTicket.update({
    where: { id },
    data: { status: parsed.data.status, adminNotes: parsed.data.adminNotes || null },
  });
  await recordAudit({
    context: auth,
    action: "update",
    entityType: "support-ticket",
    entityId: id,
    oldValues: toAuditValue(serialize(current)),
    newValues: toAuditValue(serialize(ticket)),
    request,
  });
  return NextResponse.json({ ticket: serialize(ticket) });
}
