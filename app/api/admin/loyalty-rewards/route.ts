import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";

/**
 * @summary Valida la entrada relacionada con las recompensas de fidelización.
 */
const rewardInput = z.object({
  name: z.string().trim().min(2).max(140),
  pointsNeeded: z.coerce.number().int().min(1).max(1_000_000),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  benefitType: z.string().trim().min(2).max(30).default("discount"),
  value: z.string().trim().max(120).optional().or(z.literal("")),
  active: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).max(10000).optional(),
});

/** @summary Lista las recompensas canjeables configuradas por el negocio. */
export async function GET() {
  const auth = await authorize("customer.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const rewards = await prisma.loyaltyReward.findMany({
    where: { tenantId: auth.tenant.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({ rewards: serialize(rewards) });
}

/** @summary Crea una nueva recompensa del programa de fidelidad. */
export async function POST(request: Request) {
  const auth = await authorize("customer.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = rewardInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Revisá los datos de la recompensa" }, { status: 400 });
  const reward = await prisma.loyaltyReward.create({
    data: {
      tenantId: auth.tenant.id,
      name: parsed.data.name,
      pointsNeeded: parsed.data.pointsNeeded,
      description: parsed.data.description || null,
      benefitType: parsed.data.benefitType,
      value: parsed.data.value || null,
      active: parsed.data.active ?? true,
      sortOrder: parsed.data.sortOrder ?? 0,
    },
  });
  await recordAudit({
    context: auth,
    action: "create",
    entityType: "loyalty-reward",
    entityId: reward.id,
    newValues: toAuditValue(serialize(reward)),
    request,
  });
  return NextResponse.json({ reward: serialize(reward) }, { status: 201 });
}
