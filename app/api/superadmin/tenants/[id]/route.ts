import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const tenantUpdate = z.object({
  status: z.enum(["active", "suspended"]),
  planId: z.coerce.number().int().positive().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  notes: z.string().trim().max(4000).optional(),
  lastPayment: z.boolean().optional(),
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
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const superAdmin = await authorizeSuperAdmin();
  if (!superAdmin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  const parsed = tenantUpdate.safeParse(await request.json().catch(() => null));
  if (!Number.isInteger(id) || !parsed.success)
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  const customDomain = parsed.data.customDomain?.toLocaleLowerCase("en") || null;
  const domainConflict = customDomain
    ? await prisma.brandSettings.findFirst({
        where: { customDomain, tenantId: { not: id } },
        select: { id: true },
      })
    : null;
  if (domainConflict) {
    return NextResponse.json({ error: "El dominio ya está asignado a otro cliente" }, { status: 409 });
  }
  await prisma.$transaction([
    prisma.tenant.update({ where: { id }, data: { status: parsed.data.status } }),
    prisma.tenantSubscription.upsert({
      where: { tenantId: id },
      create: {
        tenantId: id,
        planId: parsed.data.planId ?? null,
        status: parsed.data.status === "active" ? "active" : "paused",
        endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
        notes: parsed.data.notes || null,
        limits: parsed.data.limits,
        enabled: parsed.data.enabled,
        lastPaymentAt: parsed.data.lastPayment ? new Date() : null,
      },
      update: {
        planId: parsed.data.planId ?? null,
        status: parsed.data.status === "active" ? "active" : "paused",
        endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
        notes: parsed.data.notes || null,
        limits: parsed.data.limits,
        enabled: parsed.data.enabled,
        ...(parsed.data.lastPayment ? { lastPaymentAt: new Date() } : {}),
      },
    }),
    prisma.brandSettings.upsert({
      where: { tenantId: id },
      create: { tenantId: id, customDomain },
      update: { customDomain },
    }),
  ]);
  return NextResponse.json({ ok: true });
}
