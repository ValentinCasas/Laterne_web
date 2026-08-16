import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeSuperAdmin } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

const input = z.object({ action: z.enum(["activate", "suspend"]) });

/**
 * @summary Procesa una creación o acción de las sucursales tras validar contexto y permisos.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ tenantId: string; branchId: string }> },
) {
  const superAdmin = await authorizeSuperAdmin();
  if (!superAdmin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const [{ tenantId, branchId }, parsed] = await Promise.all([
    context.params,
    input.safeParse(await request.json().catch(() => null)),
  ]);
  const tenantIdNumber = Number(tenantId);
  const branchIdNumber = Number(branchId);
  if (!Number.isInteger(tenantIdNumber) || !Number.isInteger(branchIdNumber) || !parsed.success) {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
  const branch = await prisma.branch.findFirst({
    where: { id: branchIdNumber, tenantId: tenantIdNumber },
    select: { id: true, name: true, tenant: { select: { slug: true } } },
  });
  if (!branch) return NextResponse.json({ error: "Sucursal no encontrada" }, { status: 404 });

  const active = parsed.data.action === "activate";
  await prisma.branch.update({ where: { id: branch.id }, data: { active } });
  await recordAudit({
    context: { session: superAdmin.session, tenant: { id: tenantIdNumber } },
    action: parsed.data.action,
    entityType: "branch",
    entityId: branch.id,
    newValues: { active, branch: branch.name, tenantSlug: branch.tenant.slug },
    request,
  });
  return NextResponse.json({ ok: true, active });
}
