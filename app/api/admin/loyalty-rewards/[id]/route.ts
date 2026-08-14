import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const rewardInput = z.object({
  name: z.string().trim().min(2).max(140),
  pointsNeeded: z.coerce.number().int().min(1).max(1_000_000),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  benefitType: z.string().trim().min(2).max(30).default("discount"),
  value: z.string().trim().max(120).optional().or(z.literal("")),
  active: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).max(10000).optional(),
});

/** @summary Actualiza la configuración de una recompensa del programa de fidelidad. */
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("customer.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  const parsed = rewardInput.safeParse(await request.json().catch(() => null));
  if (!Number.isInteger(id) || !parsed.success)
    return NextResponse.json({ error: "Revisá los datos de la recompensa" }, { status: 400 });
  const current = await prisma.loyaltyReward.findFirst({
    where: { id, tenantId: auth.tenant.id },
  });
  if (!current) return NextResponse.json({ error: "Recompensa no encontrada" }, { status: 404 });
  const reward = await prisma.loyaltyReward.update({
    where: { id },
    data: {
      name: parsed.data.name,
      pointsNeeded: parsed.data.pointsNeeded,
      description: parsed.data.description || null,
      benefitType: parsed.data.benefitType,
      value: parsed.data.value || null,
      active: parsed.data.active ?? current.active,
      sortOrder: parsed.data.sortOrder ?? current.sortOrder,
    },
  });
  await recordAudit({
    context: auth,
    action: "update",
    entityType: "loyalty-reward",
    entityId: id,
    oldValues: toAuditValue(serialize(current)),
    newValues: toAuditValue(serialize(reward)),
    request,
  });
  return NextResponse.json({ reward: serialize(reward) });
}

/** @summary Elimina una recompensa del programa de fidelidad. */
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("customer.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  const current = await prisma.loyaltyReward.findFirst({
    where: { id, tenantId: auth.tenant.id },
  });
  if (!current) return NextResponse.json({ error: "Recompensa no encontrada" }, { status: 404 });
  await prisma.loyaltyReward.delete({ where: { id } });
  await recordAudit({
    context: auth,
    action: "delete",
    entityType: "loyalty-reward",
    entityId: id,
    oldValues: toAuditValue(serialize(current)),
    request,
  });
  return NextResponse.json({ ok: true });
}
