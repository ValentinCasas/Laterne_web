import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { authorizeSuperAdmin } from "@/lib/auth";
import { isAppHost, isLocalhost, isPlatformHost, isReservedSlug, ROOT_DOMAIN_NAME } from "@/lib/domains";
import { prisma } from "@/lib/prisma";

const tenantUpdate = z.object({
  status: z.enum(["active", "suspended"]),
  planId: z.coerce.number().int().positive().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  notes: z.string().trim().max(4000).optional(),
  lastPayment: z.boolean().optional(),
  paymentAmount: z.coerce.number().positive().max(100_000_000).optional().nullable(),
  paymentMethod: z.string().trim().min(2).max(40).optional(),
  paymentReference: z.string().trim().max(120).optional(),
  paymentPeriod: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
  customDomain: z
    .string()
    .trim()
    .max(255)
    .regex(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i)
    .optional()
    .or(z.literal("")),
  limits: z.object({
    products: z.coerce.number().int().min(0).max(1_000_000),
    users: z.coerce.number().int().min(0).max(100_000),
    storageMb: z.coerce.number().int().min(0).max(10_000_000),
  }),
  enabled: z.array(z.string().trim().min(1).max(80)).max(50),
});

/** @summary Cambia estado, plan, vencimiento y registro de pago de un cliente de la plataforma. */
export async function PATCH(request: Request, context: { params: Promise<{ tenantId: string }> }) {
  const superAdmin = await authorizeSuperAdmin();
  if (!superAdmin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).tenantId);
  const parsed = tenantUpdate.safeParse(await request.json().catch(() => null));
  if (!Number.isInteger(id) || !parsed.success)
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  const customDomain = parsed.data.customDomain?.toLocaleLowerCase("en") || null;
  const customDomainLabel = customDomain?.endsWith(`.${ROOT_DOMAIN_NAME}`)
    ? customDomain
        .slice(0, -(ROOT_DOMAIN_NAME.length + 1))
        .split(".")
        .at(-1)
    : null;
  if (
    customDomain &&
    (isPlatformHost(customDomain) ||
      isAppHost(customDomain) ||
      isLocalhost(customDomain) ||
      (customDomainLabel && isReservedSlug(customDomainLabel)))
  ) {
    return NextResponse.json({ error: "Ese dominio está reservado por MenuClick" }, { status: 400 });
  }
  const domainConflict = customDomain
    ? await prisma.brandSettings.findFirst({
        where: { customDomain, tenantId: { not: id } },
        select: { id: true },
      })
    : null;
  if (domainConflict) {
    return NextResponse.json({ error: "El dominio ya está asignado a otro cliente" }, { status: 409 });
  }
  const plan = parsed.data.planId
    ? await prisma.plan.findUnique({
        where: { id: parsed.data.planId },
        include: { prices: { where: { active: true }, orderBy: { validFrom: "desc" }, take: 1 } },
      })
    : null;
  if (parsed.data.planId && (!plan || !plan.active))
    return NextResponse.json({ error: "Plan no encontrado o inactivo" }, { status: 404 });
  const paymentAmount = parsed.data.paymentAmount ?? Number(plan?.prices[0]?.amount ?? 0);
  if (parsed.data.lastPayment && paymentAmount <= 0) {
    return NextResponse.json({ error: "Indicá el importe del pago registrado" }, { status: 400 });
  }
  const now = new Date();
  const subscriptionStatus = parsed.data.status === "active" ? "ACTIVE" : "SUSPENDED";
  await prisma.$transaction(async (transaction) => {
    await transaction.tenant.update({ where: { id }, data: { status: parsed.data.status } });
    await transaction.tenantSubscription.upsert({
      where: { tenantId: id },
      create: {
        tenantId: id,
        planId: parsed.data.planId ?? null,
        status: subscriptionStatus,
        endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
        currentPeriodStart: now,
        currentPeriodEnd: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
        notes: parsed.data.notes || null,
        limits: parsed.data.limits,
        enabled: parsed.data.enabled,
        lastPaymentAt: parsed.data.lastPayment ? now : null,
        renewalAmount: parsed.data.lastPayment ? paymentAmount : null,
      },
      update: {
        planId: parsed.data.planId ?? null,
        status: subscriptionStatus,
        endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
        currentPeriodStart: now,
        currentPeriodEnd: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
        notes: parsed.data.notes || null,
        limits: parsed.data.limits,
        enabled: parsed.data.enabled,
        ...(parsed.data.lastPayment ? { lastPaymentAt: now, renewalAmount: paymentAmount } : {}),
      },
    });
    await transaction.brandSettings.upsert({
      where: { tenantId: id },
      create: { tenantId: id, customDomain },
      update: { customDomain },
    });
    if (parsed.data.lastPayment) {
      await transaction.platformPayment.create({
        data: {
          tenantId: id,
          period: parsed.data.paymentPeriod ?? now.toISOString().slice(0, 7),
          paidAt: now,
          amount: paymentAmount,
          currency: plan?.prices[0]?.currency ?? "ARS",
          method: parsed.data.paymentMethod ?? "manual",
          reference: parsed.data.paymentReference || null,
          createdById: superAdmin.user.id,
        },
      });
    }
  });
  await recordAudit({
    context: superAdmin,
    action: "update",
    entityType: "tenant_subscription",
    entityId: id,
    newValues: {
      status: parsed.data.status,
      planId: parsed.data.planId ?? null,
      endsAt: parsed.data.endsAt ?? null,
      customDomain,
      paymentRecorded: Boolean(parsed.data.lastPayment),
    },
    request,
  });
  return NextResponse.json({ ok: true });
}
