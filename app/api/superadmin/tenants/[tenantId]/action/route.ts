import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeSuperAdmin } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

const input = z.object({
  action: z.enum(["suspend", "reactivate"]),
  reason: z.string().trim().max(300).optional(),
});

/**
 * @summary Procesa una creación o acción de los tenants tras validar contexto y permisos.
 */
export async function POST(request: Request, context: { params: Promise<{ tenantId: string }> }) {
  const superAdmin = await authorizeSuperAdmin();
  if (!superAdmin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).tenantId);
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!Number.isInteger(id) || !parsed.success)
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  const tenant = await prisma.tenant.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!tenant) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  const status = parsed.data.action === "suspend" ? "suspended" : "active";
  await prisma.$transaction([
    prisma.tenant.update({ where: { id }, data: { status } }),
    prisma.tenantSubscription.updateMany({
      where: { tenantId: id },
      data: { status: status === "active" ? "ACTIVE" : "SUSPENDED" },
    }),
  ]);
  await recordAudit({
    context: { session: superAdmin.session, tenant: { id } },
    action: parsed.data.action,
    entityType: "tenant",
    entityId: id,
    newValues: { status, reason: parsed.data.reason ?? null },
    request,
  });
  return NextResponse.json({ ok: true, status });
}
