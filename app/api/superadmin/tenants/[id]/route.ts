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
        lastPaymentAt: parsed.data.lastPayment ? new Date() : null,
      },
      update: {
        planId: parsed.data.planId ?? null,
        status: parsed.data.status === "active" ? "active" : "paused",
        endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
        notes: parsed.data.notes || null,
        ...(parsed.data.lastPayment ? { lastPaymentAt: new Date() } : {}),
      },
    }),
  ]);
  return NextResponse.json({ ok: true });
}
