import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { ensureTenantCapacity } from "@/lib/tenant-limits";
import { acquireTenantUserLock, assertMemberBranchCapacity, releaseTenantUserLock } from "@/lib/license";

/**
 * @summary Lista los usuarios del tenant con su rol, branches y último acceso.
 */
export async function GET(request: Request) {
  const auth = await authorize("user.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim().toLocaleLowerCase("es") ?? "";
  const roleId = url.searchParams.get("roleId") ? Number(url.searchParams.get("roleId")) : undefined;
  const status = url.searchParams.get("status") ?? undefined;

  const memberships = await prisma.tenantMembership.findMany({
    where: {
      tenantId: auth.tenant.id,
      ...(roleId ? { roleId } : {}),
      ...(status ? { status } : {}),
    },
    include: {
      user: {
        select: { id: true, name: true, email: true, imageUrl: true, pinHash: true, createdAt: true },
      },
      role: { select: { id: true, key: true, name: true } },
      branchAccess: {
        include: {
          branch: { select: { id: true, name: true, slug: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const filtered = q
    ? memberships.filter((m) =>
        `${m.user.name} ${m.user.email}`.toLocaleLowerCase("es").includes(q),
      )
    : memberships;

  const lastSessions = await prisma.authSession.findMany({
    where: {
      userId: { in: filtered.map((m) => m.userId) },
      context: "tenant",
    },
    select: { userId: true, lastSeenAt: true },
    orderBy: { lastSeenAt: "desc" },
    distinct: ["userId"],
  });

  const lastAccessMap = new Map(lastSessions.map((s) => [s.userId, s.lastSeenAt]));

  const users = filtered.map((m) => ({
    id: m.userId,
    membershipId: m.id,
    name: m.user.name,
    email: m.user.email,
    imageUrl: m.user.imageUrl,
    hasPin: !!m.user.pinHash,
    role: m.role,
    status: m.status,
    allBranches: m.allBranches,
    branches: m.branchAccess.map((ba) => ba.branch),
    lastAccessAt: lastAccessMap.get(m.userId)?.toISOString() ?? null,
    createdAt: m.createdAt.toISOString(),
  }));

  return NextResponse.json({ users });
}

/**
 * @summary Crea un usuario y su membresía dentro del tenant validando licencias y permisos.
 */
export async function POST(request: Request) {
  const auth = await authorize("user.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const parsed = z
    .object({
      name: z.string().trim().min(1),
      email: z.string().trim().email(),
      password: z.string().min(8),
      roleId: z.number().int().positive(),
      branchIds: z.array(z.number().int().positive()).optional().default([]),
      allBranches: z.boolean().optional().default(false),
    })
    .safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Datos incompletos o inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const { name, email, password, roleId, branchIds, allBranches } = parsed.data;
  const emailLower = email.toLocaleLowerCase("es");

  // Verificar que el rol pertenece al tenant
  const role = await prisma.role.findFirst({ where: { id: roleId, tenantId: auth.tenant.id } });
  if (!role) return NextResponse.json({ error: "Rol inválido" }, { status: 400 });

  // Verificar que el email no esté registrado
  const existingUser = await prisma.user.findUnique({ where: { email: emailLower } });
  if (existingUser) {
    const existingMembership = await prisma.tenantMembership.findFirst({
      where: { tenantId: auth.tenant.id, userId: existingUser.id },
    });
    if (existingMembership) {
      return NextResponse.json({ error: "Este email ya está registrado en el negocio" }, { status: 409 });
    }
  }

  // Verificar capacidad de usuarios
  await ensureTenantCapacity(auth.tenant.id, "users");

  // Verificar que las branches pertenecen al tenant
  const branches = branchIds.length
    ? await prisma.branch.findMany({ where: { tenantId: auth.tenant.id, id: { in: branchIds } }, select: { id: true } })
    : [];

  try {
    const result = await prisma.$transaction(async (tx) => {
      await acquireTenantUserLock(tx, auth.tenant.id);
      try {
        await assertMemberBranchCapacity({
          db: tx,
          tenantId: auth.tenant.id,
          roleKey: role.key,
          allBranches,
          branchIds: branches.map((b) => b.id),
        });

        const user = existingUser
          ? existingUser
          : await tx.user.create({
              data: {
                name,
                email: emailLower,
                password: await bcrypt.hash(password, 12),
                role: ["owner", "administrator"].includes(role.key) ? 1 : 0,
                imageUrl: "avatar_profile_default.png",
              },
            });

        if (!existingUser) {
          const membership = await tx.tenantMembership.create({
            data: { tenantId: auth.tenant.id, userId: user.id, roleId, allBranches },
          });

          if (branches.length) {
            await tx.branchMembership.createMany({
              data: branches.map((b) => ({ membershipId: membership.id, branchId: b.id })),
            });
          }

          return { user, membership, role, isNew: true };
        }

        // Si el usuario ya existe (en otro tenant), crear membresía
        const membership = await tx.tenantMembership.create({
          data: { tenantId: auth.tenant.id, userId: user.id, roleId, allBranches },
        });

        if (branches.length) {
          await tx.branchMembership.createMany({
            data: branches.map((b) => ({ membershipId: membership.id, branchId: b.id })),
          });
        }

        return { user, membership, role, isNew: true };
      } finally {
        await releaseTenantUserLock(tx, auth.tenant.id);
      }
    });

    const safeUser = { ...result.user, password: undefined, pinHash: undefined };
    await recordAudit({
      context: auth,
      action: "create",
      entityType: "usuarios",
      entityId: result.user.id,
      newValues: toAuditValue(serialize({ ...safeUser, roleId: result.role.id, roleName: result.role.name })),
      request,
    });

    return NextResponse.json({
      user: {
        ...safeUser,
        membershipId: result.membership.id,
        role: result.role,
        status: result.membership.status,
        branches: branches.map((b) => ({ id: b.id })),
        allBranches,
      },
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo crear el usuario" },
      { status: 400 },
    );
  }
}
