import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeSuperAdmin } from "@/lib/auth";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

/**
 * @summary Valida la entrada de una licencia de sucursal asignada desde Platform.
 */
const branchLicenseInput = z.object({
  status: z.enum(["DRAFT", "TRIAL", "ACTIVE", "PAYMENT_PENDING", "GRACE_PERIOD", "SUSPENDED", "CANCELLED"]),
  planId: z.coerce.number().int().positive().optional().nullable(),
  currentPeriodEnd: z.string().datetime().optional().nullable(),
  graceUntil: z.string().datetime().optional().nullable(),
  priceOverride: z.coerce.number().min(0).optional().nullable(),
  pricePerUser: z.coerce.number().min(0).optional().nullable(),
  /** Cupos de usuarios permitidos; 0 = usar la capacidad del plan. */
  usersAllowed: z.coerce.number().int().min(0).max(100000).optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

/** @summary Crea una licencia nueva para la sucursal (una sucursal puede tener varias). */
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

  const license = await prisma.branchLicense.create({
    data: {
      tenantId,
      branchId,
      status: parsed.data.status,
      planId: parsed.data.planId ?? undefined,
      currentPeriodEnd: parsed.data.currentPeriodEnd ? new Date(parsed.data.currentPeriodEnd) : null,
      graceUntil: parsed.data.graceUntil ? new Date(parsed.data.graceUntil) : null,
      priceOverride: parsed.data.priceOverride ?? null,
      pricePerUser: parsed.data.pricePerUser ?? null,
      usersAllowed: parsed.data.usersAllowed ?? 0,
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
      usersAllowed: license.usersAllowed,
      currentPeriodEnd: license.currentPeriodEnd,
      graceUntil: license.graceUntil,
    }),
    request,
  });

  return NextResponse.json({ license: toAuditValue(license) }, { status: 201 });
}

/** @summary Lista las licencias de una sucursal con su estado efectivo y el plan asociado. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ tenantId: string; branchId: string }> },
) {
  const superAdmin = await authorizeSuperAdmin();
  if (!superAdmin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const tenantId = Number((await context.params).tenantId);
  const branchId = Number((await context.params).branchId);
  if (!Number.isInteger(tenantId) || !Number.isInteger(branchId)) {
    return NextResponse.json({ error: "Sucursal inválida" }, { status: 400 });
  }
  const licenses = await prisma.branchLicense.findMany({
    where: { tenantId, branchId },
    include: { plan: { select: { id: true, name: true } } },
    orderBy: [{ status: "asc" }, { id: "asc" }],
  });
  return NextResponse.json({ licenses: toAuditValue(licenses) });
}