import { NextResponse } from "next/server";
import { z } from "zod";
import type { AuthorizationContext } from "@/lib/auth";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export const leadStatusSchema = z.object({
  status: z.enum(["new", "contacted", "demo_scheduled", "quote_sent", "negotiation", "won", "lost"]),
  note: z.string().trim().max(500).optional(),
});

/** @summary Actualiza la etapa comercial de una oportunidad, registra el historial y audita el cambio. */
export async function updateLeadStatus(input: {
  id: number;
  status: string;
  note?: string;
  auth: Pick<AuthorizationContext, "session">;
  request?: Request;
}) {
  const oldLead = await prisma.salesLead.findUnique({ where: { id: input.id } });
  if (!oldLead) return NextResponse.json({ error: "Oportunidad no encontrada" }, { status: 404 });
  if (oldLead.status === input.status && !input.note) {
    return NextResponse.json({ lead: toAuditValue(oldLead) });
  }

  const lead = await prisma.$transaction(async (transaction) => {
    const updated = await transaction.salesLead.update({
      where: { id: input.id },
      data: { status: input.status, assignedToId: input.auth.session.userId },
      include: { plan: { select: { name: true } } },
    });
    await transaction.leadStatusHistory.create({
      data: {
        leadId: input.id,
        userId: input.auth.session.userId,
        fromStatus: oldLead.status,
        toStatus: input.status,
        note: input.note,
      },
    });
    return updated;
  });
  await recordAudit({
    context: input.auth,
    action: "status_change",
    entityType: "sales_lead",
    entityId: input.id,
    oldValues: toAuditValue(oldLead),
    newValues: toAuditValue(lead),
    request: input.request,
  });
  return NextResponse.json({ lead: toAuditValue(lead) });
}