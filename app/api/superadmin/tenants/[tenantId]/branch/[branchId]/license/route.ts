import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeSuperAdmin } from "@/lib/auth";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

/**
 * @summary Valida la entrada relacionada con las sucursales.
 */
const branchLicenseInput = z.object({
  status: z.enum(["DRAFT", "TRIAL", "ACTIVE", "PAYMENT_PENDING", "GRACE_PERIOD", "SUSPENDED", "CANCELLED"]),
  planId: z.coerce.number().int().positive().optional().nullable(),
  currentPeriodEnd: z.string().datetime().optional().nullable(),
  graceUntil: z.string().datetime().optional().nullable(),
  priceOverride: z.coerce.number().min(0).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

/** @summary Actualiza la licencia de una sucursal desde la consola de la plataforma. */
export async function POST(
  request: Request,
  context: { params: Promise<{ tenantId: string; branchId: string }> },
) {
  const superAdmin = await authorizeSuperAdmin();
  if (!superAdmin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const tenantId = Number((await context.params).tenantId);
  const branchId = Number((await context.params).branchId);
  const parsed = branchLicenseInput.safeParse(await request.json().catch(() => null));
  if (!Number.isInteger(tenantId) || !Number.isInteger(branchId) || !parsed.success) {
    return NextResponse.json({ error: "Revisá los datos de la licencia" }, { status: 400 });
  }

  const branch = await prisma.branch.findFirst({ where: { id: branchId, tenantId } });
  if (!branch) return NextResponse.json({ error: "Sucursal no encontrada" }, { status: 404 });

  const license = await prisma.branchLicense.upsert({
    where: { tenantId_branchId: { tenantId, branchId } },
    create: {
      tenantId,
      branchId,
      status: parsed.data.status,
      planId: parsed.data.planId ?? undefined,
      currentPeriodEnd: parsed.data.currentPeriodEnd ? new Date(parsed.data.currentPeriodEnd) : null,
      graceUntil: parsed.data.graceUntil ? new Date(parsed.data.graceUntil) : null,
      priceOverride: parsed.data.priceOverride ?? null,
      notes: parsed.data.notes ?? null,
    },
    update: {
      status: parsed.data.status,
      planId: parsed.data.planId ?? null,
      currentPeriodEnd: parsed.data.currentPeriodEnd ? new Date(parsed.data.currentPeriodEnd) : null,
      graceUntil: parsed.data.graceUntil ? new Date(parsed.data.graceUntil) : null,
      priceOverride: parsed.data.priceOverride ?? null,
      notes: parsed.data.notes ?? null,
    },
  });

  await recordAudit({
    context: { session: superAdmin.session, tenant: { id: tenantId } },
    action: "branch-license-assigned",
    entityType: "branch-license",
    entityId: license.id,
    newValues: toAuditValue({
      branchId,
      status: license.status,
      planId: license.planId,
      currentPeriodEnd: license.currentPeriodEnd,
      graceUntil: license.graceUntil,
    }),
    request,
  });

  return NextResponse.json({ license: toAuditValue(license) });
}
