import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorizeSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";

/**
 * @summary Valida la entrada relacionada con los planes.
 */
const planSchema = z.object({
  name: z.string().trim().min(3).max(140),
  slug: z.string().trim().max(100).optional(),
  summary: z.string().trim().min(10).max(500),
  audience: z.string().trim().max(255).optional(),
  type: z.enum(["implementation", "maintenance"]),
  billingMode: z.enum(["one_time", "monthly", "quote"]),
  badge: z.string().trim().max(80).optional(),
  highlighted: z.boolean().default(false),
  active: z.boolean().default(true),
  displayOrder: z.coerce.number().int().min(0).max(10000),
  currency: z.string().trim().length(3).default("ARS"),
  amount: z.coerce.number().nonnegative().nullable(),
  billingPeriod: z.enum(["once", "month"]),
  featureIds: z.array(z.number().int().positive()).max(200),
});

/** @summary Actualiza un plan y conserva un historial de precios mediante nuevas vigencias. */
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorizeSuperAdmin();
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Plan inválido" }, { status: 404 });
  const parsed = planSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Revisá la información del plan" }, { status: 400 });
  const oldPlan = await prisma.plan.findUnique({
    where: { id },
    include: { prices: { where: { active: true }, orderBy: { validFrom: "desc" }, take: 1 }, features: true },
  });
  if (!oldPlan) return NextResponse.json({ error: "Plan no encontrado" }, { status: 404 });
  const data = parsed.data;
  const slug = slugify(data.slug || data.name);
  const previousPrice = oldPlan.prices[0];
  const nextAmount = data.billingMode === "quote" ? null : data.amount;
  const changedPrice =
    !previousPrice ||
    Number(previousPrice.amount ?? 0) !== Number(nextAmount ?? 0) ||
    previousPrice.currency !== data.currency.toUpperCase() ||
    previousPrice.billingPeriod !== data.billingPeriod;

  try {
    const plan = await prisma.$transaction(async (transaction) => {
      await transaction.planFeature.deleteMany({ where: { planId: id } });
      if (changedPrice) {
        await transaction.planPrice.updateMany({
          where: { planId: id, active: true },
          data: { active: false, validUntil: new Date() },
        });
      }
      return transaction.plan.update({
        where: { id },
        data: {
          slug,
          name: data.name,
          summary: data.summary,
          audience: data.audience || null,
          type: data.type,
          billingMode: data.billingMode,
          badge: data.badge || null,
          highlighted: data.highlighted,
          active: data.active,
          displayOrder: data.displayOrder,
          features: {
            create: data.featureIds.map((featureId, index) => ({ featureId, displayOrder: index * 10 })),
          },
          ...(changedPrice
            ? {
                prices: {
                  create: {
                    currency: data.currency.toUpperCase(),
                    amount: nextAmount,
                    billingPeriod: data.billingPeriod,
                  },
                },
              }
            : {}),
        },
        include: {
          prices: { where: { active: true }, orderBy: { validFrom: "desc" }, take: 1 },
          features: { include: { feature: true }, orderBy: { displayOrder: "asc" } },
        },
      });
    });
    await recordAudit({
      context: auth,
      action: "update",
      entityType: "plan",
      entityId: id,
      oldValues: toAuditValue(oldPlan),
      newValues: toAuditValue(plan),
      request,
    });
    revalidatePath("/planes");
    revalidatePath("/para-negocios");
    return NextResponse.json({ plan: toAuditValue(plan) });
  } catch {
    return NextResponse.json({ error: "No se pudo guardar el plan" }, { status: 409 });
  }
}

/** @summary Oculta un plan comercial sin borrar sus precios históricos ni oportunidades asociadas. */
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorizeSuperAdmin();
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  const oldPlan = Number.isInteger(id) ? await prisma.plan.findUnique({ where: { id } }) : null;
  if (!oldPlan) return NextResponse.json({ error: "Plan no encontrado" }, { status: 404 });
  const plan = await prisma.plan.update({ where: { id }, data: { active: false } });
  await recordAudit({
    context: auth,
    action: "archive",
    entityType: "plan",
    entityId: id,
    oldValues: toAuditValue(oldPlan),
    newValues: toAuditValue(plan),
    request,
  });
  revalidatePath("/planes");
  revalidatePath("/para-negocios");
  return NextResponse.json({ plan: toAuditValue(plan) });
}
