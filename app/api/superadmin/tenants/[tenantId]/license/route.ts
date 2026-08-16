import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeSuperAdmin } from "@/lib/auth";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

/**
 * @summary Valida la entrada relacionada con los tenants.
 */
const licenseInput = z.object({
  planId: z.coerce.number().int().positive(),
  status: z.enum(["TRIAL", "ACTIVE", "PAYMENT_PENDING", "GRACE_PERIOD", "SUSPENDED", "CANCELLED"]),
  endsAt: z.string().datetime().optional().nullable(),
});

/** @summary Asigna una licencia comercial y deriva límites y funcionalidades desde el plan elegido. */
export async function POST(request: Request, context: { params: Promise<{ tenantId: string }> }) {
  const superAdmin = await authorizeSuperAdmin();
  if (!superAdmin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const tenantId = Number((await context.params).tenantId);
  const parsed = licenseInput.safeParse(await request.json().catch(() => null));
  if (!Number.isInteger(tenantId) || !parsed.success)
    return NextResponse.json({ error: "Revisá la licencia seleccionada" }, { status: 400 });
  const [tenant, plan] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } }),
    prisma.plan.findFirst({
      where: { id: parsed.data.planId, active: true },
      include: { features: { where: { included: true }, include: { feature: { select: { key: true } } } } },
    }),
  ]);
  if (!tenant) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  if (!plan) return NextResponse.json({ error: "El plan no existe o está inactivo" }, { status: 404 });
  const enabled = plan.features.map((item) => item.feature.key);
  const subscription = await prisma.tenantSubscription.upsert({
    where: { tenantId },
    create: {
      tenantId,
      planId: plan.id,
      status: parsed.data.status,
      startsAt: new Date(),
      endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
      currentPeriodStart: new Date(),
      currentPeriodEnd: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
      limits: plan.capacity ?? {},
      enabled,
      overrides: {},
    },
    update: {
      planId: plan.id,
      status: parsed.data.status,
      endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
      currentPeriodEnd: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
      limits: plan.capacity ?? {},
      enabled,
    },
  });
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      status:
        parsed.data.status === "SUSPENDED" || parsed.data.status === "CANCELLED" ? "suspended" : "active",
    },
  });
  await recordAudit({
    context: { session: superAdmin.session, tenant: { id: tenantId } },
    action: "license-assigned",
    entityType: "tenant-subscription",
    entityId: subscription.id,
    newValues: toAuditValue({
      planId: plan.id,
      plan: plan.name,
      status: parsed.data.status,
      endsAt: parsed.data.endsAt,
      enabled,
    }),
    request,
  });
  return NextResponse.json({
    subscription: toAuditValue(subscription),
    plan: { id: plan.id, name: plan.name },
    enabled,
  });
}
