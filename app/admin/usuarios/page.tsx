import { UserManager, type UserListItem } from "@/components/admin/user-manager";
import { requirePermission } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

/**
 * @summary Genera los metadatos de la vista de usuarios.
 */
export async function generateMetadata(): Promise<Metadata> {
  const context = await requirePermission("user.manage");
  return { title: `${context.tenant.name} | Usuarios` };
}

/**
 * @summary Página dedicada de gestión de usuarios/empleados del tenant.
 *
 * Carga la lista completa de usuarios con su rol, branches, estado y último
 * acceso. El componente UserManager maneja la ficha, creación, edición,
 * eliminación, matriz de permisos y gestión de PIN.
 */
export default async function UsuariosPage() {
  const context = await requirePermission("user.manage");

  const memberships = await prisma.tenantMembership.findMany({
    where: { tenantId: context.tenant.id },
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

  const lastSessions = await prisma.authSession.findMany({
    where: {
      userId: { in: memberships.map((m) => m.userId) },
      context: "tenant",
    },
    select: { userId: true, lastSeenAt: true },
    orderBy: { lastSeenAt: "desc" },
    distinct: ["userId"],
  });

  const lastAccessMap = new Map(lastSessions.map((s) => [s.userId, s.lastSeenAt]));

  const users: UserListItem[] = memberships.map((m) => ({
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

  return <UserManager initialUsers={serialize(users) as unknown as UserListItem[]} />;
}
