import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const statusSchema = z.object({
  status: z.enum(["new", "contacted", "demo_scheduled", "quote_sent", "negotiation", "won", "lost"]),
  note: z.string().trim().max(500).optional(),
});

/** @summary Cambia el estado comercial de una oportunidad y conserva su historial. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("lead.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  const parsed = statusSchema.safeParse(await request.json());
  if (!Number.isInteger(id) || !parsed.success) {
    return NextResponse.json({ error: "Estado u oportunidad inválidos" }, { status: 400 });
  }
  const oldLead = await prisma.salesLead.findUnique({ where: { id } });
  if (!oldLead) return NextResponse.json({ error: "Oportunidad no encontrada" }, { status: 404 });
  if (oldLead.status === parsed.data.status && !parsed.data.note) {
    return NextResponse.json({ lead: toAuditValue(oldLead) });
  }

  const lead = await prisma.$transaction(async (transaction) => {
    const updated = await transaction.salesLead.update({
      where: { id },
      data: { status: parsed.data.status, assignedToId: auth.session.userId },
      include: { plan: { select: { name: true } } },
    });
    await transaction.leadStatusHistory.create({
      data: {
        leadId: id,
        userId: auth.session.userId,
        fromStatus: oldLead.status,
        toStatus: parsed.data.status,
        note: parsed.data.note,
      },
    });
    return updated;
  });
  await recordAudit({
    context: auth,
    action: "status_change",
    entityType: "sales_lead",
    entityId: id,
    oldValues: toAuditValue(oldLead),
    newValues: toAuditValue(lead),
    request,
  });
  return NextResponse.json({ lead: toAuditValue(lead) });
}
