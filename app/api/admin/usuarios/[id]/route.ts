import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { acquireTenantUserLock, assertMemberBranchCapacity, releaseTenantUserLock } from "@/lib/license";

/**
 * @summary Recupera la ficha completa de un usuario: datos, rol, permisos, branches y auditoría.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await authorize("user.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const userId = Number((await context.params).id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const membership = await prisma.tenantMembership.findFirst({
    where: { tenantId: auth.tenant.id, userId },
    include: {
      user: {
        select: {
          id: true, name: true, email: true, imageUrl: true, pinHash: true, createdAt: true, updatedAt: true,
        },
      },
      role: {
        select: {
          id: true, key: true, name: true, description: true,
          permissions: { select: { permission: { select: { key: true, name: true, description: true } } } },
        },
      },
      branchAccess: {
        include: {
          branch: { select: { id: true, name: true, slug: true, active: true } },
        },
      },
    },
  });

  if (!membership) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  // Último acceso
  const lastSession = await prisma.authSession.findFirst({
    where: { userId, context: "tenant" },
    select: { lastSeenAt: true, createdAt: true },
    orderBy: { lastSeenAt: "desc" },
  });

  // Sesiones activas
  const activeSessions = await prisma.authSession.count({
    where: { userId, context: "tenant", revokedAt: null, expiresAt: { gt: new Date() } },
  });

  // Auditoría reciente del usuario
  const auditLogs = await prisma.auditLog.findMany({
    where: { entityType: "usuarios", entityId: String(userId) },
    select: {
      id: true, action: true, createdAt: true, oldValues: true, newValues: true,
      user: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  // Todos los roles disponibles del tenant (para el editor)
  const availableRoles = await prisma.role.findMany({
    where: { tenantId: auth.tenant.id },
    select: { id: true, key: true, name: true, description: true, system: true },
    orderBy: { name: "asc" },
  });

  // Todas las branches del tenant (para el selector)
  const allBranches = await prisma.branch.findMany({
    where: { tenantId: auth.tenant.id, active: true },
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  });

  // Todos los permisos disponibles (para la matriz)
  const allPermissions = await prisma.permission.findMany({
    select: { key: true, name: true, description: true },
    orderBy: { key: "asc" },
  });

  const userPermissions = membership.role.permissions.map((rp) => rp.permission.key);

  return NextResponse.json({
    user: {
      ...membership.user,
      pinHash: undefined, // Nunca exponer el hash
      hasPin: !!membership.user.pinHash,
    },
    membership: {
      id: membership.id,
      status: membership.status,
      allBranches: membership.allBranches,
    },
    role: {
      ...membership.role,
      permissions: undefined,
    },
    permissions: userPermissions,
    branches: membership.branchAccess.map((ba) => ba.branch),
    lastAccessAt: lastSession?.lastSeenAt?.toISOString() ?? null,
    activeSessions,
    auditLogs: auditLogs.map((log) => ({
      ...log,
      oldValues: log.oldValues ? JSON.parse(log.oldValues as string) : null,
      newValues: log.newValues ? JSON.parse(log.newValues as string) : null,
    })),
    availableRoles,
    allBranches,
    allPermissions,
  });
}

/**
 * @summary Actualiza un usuario validando que no pueda auto-otorgarse permisos superiores.
 */
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await authorize("user.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const userId = Number((await context.params).id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  // No puedes editarte a ti mismo (debe hacerlo desde tu perfil)
  if (userId === auth.session.userId) {
    return NextResponse.json({ error: "Usá tu perfil para editar tu propia cuenta" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const parsed = z
    .object({
      name: z.string().trim().min(1).optional(),
      email: z.string().trim().email().optional(),
      password: z.string().min(8).optional(),
      roleId: z.number().int().positive().optional(),
      branchIds: z.array(z.number().int().positive()).optional(),
      allBranches: z.boolean().optional(),
      status: z.enum(["active", "inactive"]).optional(),
    })
    .safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Datos incompletos o inválidos" }, { status: 400 });
  }

  const data = parsed.data;

  const membership = await prisma.tenantMembership.findFirst({
    where: { tenantId: auth.tenant.id, userId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      role: {
        select: {
          id: true, key: true, name: true,
          permissions: { select: { permission: { select: { key: true } } } },
        },
      },
      branchAccess: { select: { branchId: true } },
    },
  });

  if (!membership) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  // VALIDACIÓN DE AUTO-ESCALADA: el usuario que edita no puede asignar permisos que él no tiene
  if (data.roleId) {
    const targetRole = await prisma.role.findFirst({
      where: { id: data.roleId, tenantId: auth.tenant.id },
      include: { permissions: { select: { permission: { select: { key: true } } } } },
    });
    if (!targetRole) return NextResponse.json({ error: "Rol inválido" }, { status: 400 });

    const targetPermKeys = targetRole.permissions.map((rp) => rp.permission.key);
    const myPermKeys = membership.role.permissions.map((rp) => rp.permission.key);

    // Owner y administrator pueden asignar cualquier rol
    const myRoleKey = auth.membership.role.key;
    if (myRoleKey !== "owner" && myRoleKey !== "administrator") {
      const unauthorized = targetPermKeys.filter((p) => !myPermKeys.includes(p));
      if (unauthorized.length > 0) {
        return NextResponse.json(
          { error: `No podés asignar permisos que no tenés: ${unauthorized.join(", ")}` },
          { status: 403 },
        );
      }
    }
  }

  // Verificar branches
  const branchIds = data.branchIds ?? membership.branchAccess.map((ba) => ba.branchId);
  const allBranches = data.allBranches ?? membership.allBranches;
  const role = data.roleId
    ? await prisma.role.findFirst({ where: { id: data.roleId, tenantId: auth.tenant.id } })
    : membership.role;

  if (data.roleId && !role) {
    return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
  }

  const branches = branchIds.length
    ? await prisma.branch.findMany({
        where: { tenantId: auth.tenant.id, id: { in: branchIds } },
        select: { id: true },
      })
    : [];

  try {
    await prisma.$transaction(async (tx) => {
      await acquireTenantUserLock(tx, auth.tenant.id);
      try {
        await assertMemberBranchCapacity({
          db: tx,
          tenantId: auth.tenant.id,
          roleKey: role!.key,
          allBranches,
          branchIds: branches.map((b) => b.id),
          excludeUserId: userId,
        });

        // Actualizar membresía
        await tx.tenantMembership.update({
          where: { id: membership.id },
          data: {
            ...(data.roleId ? { roleId: data.roleId } : {}),
            ...(data.allBranches !== undefined ? { allBranches: data.allBranches } : {}),
            ...(data.status ? { status: data.status } : {}),
          },
        });

        // Actualizar branches
        await tx.branchMembership.deleteMany({ where: { membershipId: membership.id } });
        if (branches.length) {
          await tx.branchMembership.createMany({
            data: branches.map((b) => ({ membershipId: membership.id, branchId: b.id })),
          });
        }

        // Actualizar usuario
        const userUpdate: Record<string, unknown> = {};
        if (data.name) userUpdate.name = data.name;
        if (data.email) userUpdate.email = data.email.toLocaleLowerCase("es");
        if (data.password) userUpdate.password = await bcrypt.hash(data.password, 12);
        if (data.roleId) {
          userUpdate.role = ["owner", "administrator"].includes(role!.key) ? 1 : 0;
        }

        if (Object.keys(userUpdate).length > 0) {
          await tx.user.update({ where: { id: userId }, data: userUpdate });
        }

        // Revocar sesiones si cambió el rol o el estado
        if (data.roleId || data.status) {
          await tx.authSession.updateMany({
            where: { userId, membershipId: membership.id, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }

        return true;
      } finally {
        await releaseTenantUserLock(tx, auth.tenant.id);
      }
    });

    // Auditoría
    const newRoleName = role?.name ?? membership.role.name;
    await recordAudit({
      context: auth,
      action: "update",
      entityType: "usuarios",
      entityId: userId,
      oldValues: toAuditValue(serialize({
        name: membership.user.name,
        email: membership.user.email,
        roleName: membership.role.name,
        status: membership.status,
      })),
      newValues: toAuditValue(serialize({
        name: data.name ?? membership.user.name,
        email: data.email?.toLocaleLowerCase("es") ?? membership.user.email,
        roleName: newRoleName,
        status: data.status ?? membership.status,
      })),
      request,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo actualizar el usuario" },
      { status: 400 },
    );
  }
}

/**
 * @summary Elimina un usuario del tenant revocando sus sesiones y limpiando accesos.
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await authorize("user.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const userId = Number((await context.params).id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  if (userId === auth.session.userId) {
    return NextResponse.json({ error: "No podés eliminarte a ti mismo" }, { status: 400 });
  }

  const membership = await prisma.tenantMembership.findFirst({
    where: { tenantId: auth.tenant.id, userId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      role: { select: { key: true, name: true } },
    },
  });

  if (!membership) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  // No eliminar owner
  if (membership.role.key === "owner") {
    return NextResponse.json({ error: "No se puede eliminar al propietario" }, { status: 403 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Revocar todas las sesiones del tenant
      await tx.authSession.updateMany({
        where: { userId, membershipId: membership.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      // Eliminar membresía (cascade elimina branchAccess)
      await tx.tenantMembership.delete({ where: { id: membership.id } });

      // Si no tiene más membresías, eliminar el usuario
      const remaining = await tx.tenantMembership.count({ where: { userId } });
      if (!remaining) {
        await tx.user.delete({ where: { id: userId } });
      }
    });

    const safeUser = { ...membership.user, password: undefined, pinHash: undefined };
    await recordAudit({
      context: auth,
      action: "delete",
      entityType: "usuarios",
      entityId: userId,
      oldValues: toAuditValue(serialize({ ...safeUser, roleName: membership.role.name })),
      request,
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo eliminar el usuario" },
      { status: 400 },
    );
  }
}
