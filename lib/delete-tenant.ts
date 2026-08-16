import { prisma } from "@/lib/prisma";

type DeletedTenant = { id: number; name: string; slug: string; status: string };

/**
 * @summary Elimina por completo uno o varios tenants dentro de una transacción.
 *
 * El modelo confía en ON DELETE CASCADE, pero hay tres FKs que lo bloquean:
 * - `productcategory` referencia product/category con NoAction.
 * - `tenantmembership` referencia role con Restrict.
 *
 * Por eso se limpian esas filas antes de borrar el tenant y se eliminan los
 * usuarios que quedan sin membresía (a menos que sean super admins o compartan
 * otro tenant).
 */
export async function deleteTenants(tenantIds: number[]) {
  return prisma.$transaction(async (tx) => {
    const tenants = await tx.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, name: true, slug: true, status: true },
    });
    const ids = tenants.map((tenant) => tenant.id);
    if (!ids.length) return { deleted: [] as DeletedTenant[], orphanUsers: 0 };

    // Desbloquea el cascade de productos/categorías y de roles.
    await tx.productCategory.deleteMany({ where: { tenantId: { in: ids } } });
    await tx.tenantMembership.deleteMany({ where: { tenantId: { in: ids } } });
    await tx.branchMembership.deleteMany({ where: { branch: { tenantId: { in: ids } } } });

    const memberUsers = await tx.user.findMany({
      where: { memberships: { some: { tenantId: { in: ids } } } },
      select: { id: true },
    });

    const result = await tx.tenant.deleteMany({ where: { id: { in: ids } } });

    const orphanUsers = await tx.user
      .deleteMany({
        where: {
          id: { in: memberUsers.map((user) => user.id) },
          isSuperAdmin: false,
          memberships: { none: {} },
        },
      })
      .then((response) => response.count);

    return { deleted: tenants, orphanUsers, removedRows: result.count };
  });
}
