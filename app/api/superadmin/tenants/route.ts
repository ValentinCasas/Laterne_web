import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorizeSuperAdmin } from "@/lib/auth";
import { deleteTenants } from "@/lib/delete-tenant";
import { prisma } from "@/lib/prisma";
import { isReservedSlug } from "@/lib/domains";
import { slugify } from "@/lib/slug";
import { defaultPalette } from "@/lib/theme-palettes";

const tenantDeleteInput = z.object({
  tenantIds: z.array(z.coerce.number().int().positive()).min(1).max(100),
});

const tenantInput = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z.string().trim().max(120).optional(),
  ownerName: z.string().trim().min(2).max(160),
  ownerEmail: z
    .string()
    .trim()
    .email()
    .max(255)
    .transform((value) => value.toLocaleLowerCase("es")),
  password: z.string().min(10).max(100),
  planId: z.coerce.number().int().positive().optional().nullable(),
});

/** @summary Genera un identificador público de negocio que no colisiona con otro cliente. */
async function uniqueTenantSlug(value: string) {
  const slug = slugify(value).slice(0, 100) || "negocio";
  const base = isReservedSlug(slug) ? `${slug}-negocio` : slug;
  let candidate = base;
  let suffix = 2;
  while (await prisma.tenant.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

/** @summary Crea un cliente completo con propietario, permisos y configuración inicial aislada. */
export async function POST(request: Request) {
  const superAdmin = await authorizeSuperAdmin();
  if (!superAdmin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = tenantInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Revisá los datos del cliente y la contraseña" }, { status: 400 });
  if (await prisma.user.findUnique({ where: { email: parsed.data.ownerEmail } }))
    return NextResponse.json({ error: "El email ya pertenece a un usuario" }, { status: 409 });
  const selectedPlan = parsed.data.planId
    ? await prisma.plan.findUnique({
        where: { id: parsed.data.planId },
        select: { id: true, trialDays: true, active: true },
      })
    : null;
  if (parsed.data.planId && (!selectedPlan || !selectedPlan.active))
    return NextResponse.json({ error: "Plan no encontrado o inactivo" }, { status: 404 });
  const tenant = await prisma.$transaction(async (transaction) => {
    const created = await transaction.tenant.create({
      data: {
        name: parsed.data.name,
        slug: await uniqueTenantSlug(parsed.data.slug || parsed.data.name),
        status: "active",
      },
    });
    const role = await transaction.role.create({
      data: {
        tenantId: created.id,
        key: "owner",
        name: "Propietario",
        description: "Control total del negocio",
        system: true,
      },
    });
    const permissions = await transaction.permission.findMany({ select: { id: true } });
    await transaction.rolePermission.createMany({
      data: permissions.map((permission) => ({ roleId: role.id, permissionId: permission.id })),
    });
    const user = await transaction.user.create({
      data: {
        name: parsed.data.ownerName,
        email: parsed.data.ownerEmail,
        password: await bcrypt.hash(parsed.data.password, 12),
        role: 1,
        imageUrl: "avatar_profile_default.png",
      },
    });
    const membership = await transaction.tenantMembership.create({
      data: { tenantId: created.id, userId: user.id, roleId: role.id },
    });
    const branch = await transaction.branch.create({
      data: {
        tenantId: created.id,
        name: `${created.name} · Principal`,
        slug: "principal",
        address: "Dirección a configurar",
        isPrimary: true,
      },
    });
    await transaction.branchMembership.create({ data: { membershipId: membership.id, branchId: branch.id } });
    const palette = await transaction.themePalette.create({
      data: {
        tenantId: created.id,
        name: "Original",
        primary: defaultPalette.primary,
        secondary: defaultPalette.secondary,
        accent: defaultPalette.accent,
        background: defaultPalette.background,
        surface: defaultPalette.surface,
        surfaceElevated: defaultPalette.surfaceElevated,
        text: defaultPalette.text,
        textMuted: defaultPalette.textMuted,
        border: defaultPalette.border,
        success: defaultPalette.success,
        warning: defaultPalette.warning,
        danger: defaultPalette.danger,
        baseMode: defaultPalette.baseMode,
      },
    });
    await transaction.tenant.update({ where: { id: created.id }, data: { activePaletteId: palette.id } });
    await Promise.all([
      transaction.businessInfo.create({ data: { tenantId: created.id } }),
      transaction.brandSettings.create({ data: { tenantId: created.id } }),
      transaction.notificationSettings.create({ data: { tenantId: created.id } }),
      transaction.onboardingProgress.create({ data: { tenantId: created.id, completedSteps: [] } }),
      transaction.reservationSettings.create({ data: { tenantId: created.id } }),
      transaction.tenantSubscription.create({
        data: {
          tenantId: created.id,
          planId: parsed.data.planId ?? null,
          status: parsed.data.planId ? "TRIAL" : "ACTIVE",
          trialEndsAt: parsed.data.planId
            ? new Date(Date.now() + (selectedPlan?.trialDays ?? 7) * 24 * 60 * 60 * 1000)
            : null,
          currentPeriodStart: new Date(),
        },
      }),
    ]);
    return created;
  });
  await recordAudit({
    context: superAdmin,
    action: "create",
    entityType: "tenant",
    entityId: tenant.id,
    newValues: toAuditValue(tenant),
    request,
  });
  return NextResponse.json({ tenant, tenantId: tenant.id }, { status: 201 });
}

/** @summary Elimina por completo los clientes seleccionados junto con todos sus datos. */
export async function DELETE(request: Request) {
  const superAdmin = await authorizeSuperAdmin();
  if (!superAdmin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = tenantDeleteInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Seleccioná al menos un cliente para eliminar" }, { status: 400 });
  const { deleted } = await deleteTenants([...new Set(parsed.data.tenantIds)]);
  if (!deleted.length)
    return NextResponse.json({ error: "No se encontraron clientes con esos IDs" }, { status: 404 });
  for (const tenant of deleted) {
    await recordAudit({
      context: superAdmin,
      action: "delete",
      entityType: "tenant",
      entityId: tenant.id,
      newValues: { name: tenant.name, slug: tenant.slug, status: tenant.status },
      request,
    });
  }
  return NextResponse.json({
    deleted: deleted.map((tenant) => ({ id: tenant.id, name: tenant.name, slug: tenant.slug })),
  });
}
