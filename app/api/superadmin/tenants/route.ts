import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";

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
  const base = slugify(value).slice(0, 100) || "negocio";
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
  if (parsed.data.planId && !(await prisma.plan.findUnique({ where: { id: parsed.data.planId } })))
    return NextResponse.json({ error: "Plan no encontrado" }, { status: 404 });
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
    await transaction.tenantMembership.create({
      data: { tenantId: created.id, userId: user.id, roleId: role.id },
    });
    await Promise.all([
      transaction.businessInfo.create({ data: { tenantId: created.id } }),
      transaction.brandSettings.create({ data: { tenantId: created.id } }),
      transaction.notificationSettings.create({ data: { tenantId: created.id } }),
      transaction.onboardingProgress.create({ data: { tenantId: created.id, completedSteps: [] } }),
      transaction.reservationSettings.create({ data: { tenantId: created.id } }),
      transaction.tenantSubscription.create({
        data: { tenantId: created.id, planId: parsed.data.planId ?? null, status: "active" },
      }),
    ]);
    return created;
  });
  return NextResponse.json({ tenant }, { status: 201 });
}
