import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeSuperAdmin } from "@/lib/auth";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

/**
 * @summary Valida la entrada de una edición de licencia de sucursal.
 */
const licenseUpdateInput = z.object({
  status: z
    .enum(["DRAFT", "TRIAL", "ACTIVE", "PAYMENT_PENDING", "GRACE_PERIOD", "SUSPENDED", "CANCELLED"])
    .optional(),
  planId: z.coerce.number().int().positive().optional().nullable(),
  currentPeriodEnd: z.string().datetime().optional().nullable(),
  graceUntil: z.string().datetime().optional().nullable(),
  priceOverride: z.coerce.number().min(0).optional().nullable(),
  pricePerUser: z.coerce.number().min(0).optional().nullable(),
  /** Cupos de usuarios permitidos; 0 = usar la capacidad del plan. */
  usersAllowed: z.coerce.number().int().min(0).max(100000).optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

/** @summary Edita una licencia existente de la sucursal. */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ tenantId: string; branchId: string; licenseId: string }> },
) {
  const superAdmin = await authorizeSuperAdmin();
  if (!superAdmin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const tenantId = Number((await context.params).tenantId);
  const branchId = Number((await context.params).branchId);
  const licenseId = Number((await context.params).licenseId);
  const parsed = licenseUpdateInput.safeParse(await request.json().catch(() => null));
  if (!Number.isInteger(tenantId) || !Number.isInteger(branchId) || !Number.isInteger(licenseId)) {
    return NextResponse.json({ error: "Licencia inválida" }, { status: 400 });
  }
  if (!parsed.success) return NextResponse.json({ error: "Revisá los datos de la licencia" }, { status: 400 });

  const existing = await prisma.branchLicense.findFirst({ where: { id: licenseId, tenantId, branchId } });
  if (!existing) return NextResponse.json({ error: "Licencia no encontrada" }, { status: 404 });

  const data: Record<string, unknown> = {};
  const nextStatus = parsed.data.status ?? existing.status;
  const nextUsersAllowed = parsed.data.usersAllowed ?? existing.usersAllowed;
  const isDraft = nextStatus === "DRAFT";
  const wantsCapacity = typeof nextUsersAllowed === "number" && nextUsersAllowed > 0;
  if (wantsCapacity && isDraft) {
    data.status = "ACTIVE";
    if (!existing.startsAt) data.startsAt = new Date();
  }
  if (parsed.data.status !== undefined) data.status = parsed.data.status;
  if (parsed.data.planId !== undefined) data.planId = parsed.data.planId;
  if (parsed.data.currentPeriodEnd !== undefined)
    data.currentPeriodEnd = parsed.data.currentPeriodEnd ? new Date(parsed.data.currentPeriodEnd) : null;
  if (parsed.data.graceUntil !== undefined)
    data.graceUntil = parsed.data.graceUntil ? new Date(parsed.data.graceUntil) : null;
  if (parsed.data.priceOverride !== undefined) data.priceOverride = parsed.data.priceOverride;
  if (parsed.data.pricePerUser !== undefined) data.pricePerUser = parsed.data.pricePerUser;
  if (parsed.data.usersAllowed !== undefined) data.usersAllowed = parsed.data.usersAllowed;
  if (parsed.data.notes !== undefined) data.notes = parsed.data.notes;

  const license = await prisma.branchLicense.update({ where: { id: licenseId }, data });

  await recordAudit({
    context: { session: superAdmin.session, tenant: { id: tenantId } },
    action: "branch-license-updated",
    entityType: "branch-license",
    entityId: license.id,
    oldValues: toAuditValue({
      status: existing.status,
      planId: existing.planId,
      usersAllowed: existing.usersAllowed,
      currentPeriodEnd: existing.currentPeriodEnd,
      graceUntil: existing.graceUntil,
    }),
    newValues: toAuditValue({
      status: license.status,
      planId: license.planId,
      usersAllowed: license.usersAllowed,
      currentPeriodEnd: license.currentPeriodEnd,
      graceUntil: license.graceUntil,
    }),
    request,
  });

  return NextResponse.json({ license: toAuditValue(license) });
}

/** @summary Elimina una licencia de la sucursal. */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ tenantId: string; branchId: string; licenseId: string }> },
) {
  const superAdmin = await authorizeSuperAdmin();
  if (!superAdmin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const tenantId = Number((await context.params).tenantId);
  const branchId = Number((await context.params).branchId);
  const licenseId = Number((await context.params).licenseId);
  if (!Number.isInteger(tenantId) || !Number.isInteger(branchId) || !Number.isInteger(licenseId)) {
    return NextResponse.json({ error: "Licencia inválida" }, { status: 400 });
  }
  const existing = await prisma.branchLicense.findFirst({ where: { id: licenseId, tenantId, branchId } });
  if (!existing) return NextResponse.json({ error: "Licencia no encontrada" }, { status: 404 });

  await prisma.branchLicense.delete({ where: { id: licenseId } });
  await recordAudit({
    context: { session: superAdmin.session, tenant: { id: tenantId } },
    action: "branch-license-removed",
    entityType: "branch-license",
    entityId: licenseId,
    oldValues: toAuditValue({
      status: existing.status,
      planId: existing.planId,
      usersAllowed: existing.usersAllowed,
      currentPeriodEnd: existing.currentPeriodEnd,
    }),
    request,
  });
  return new NextResponse(null, { status: 204 });
}