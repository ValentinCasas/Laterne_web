import { TenantConsole, type PlatformTenant } from "@/components/superadmin/tenant-console";
import { requireSuperAdmin } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";

/** @summary Carga clientes, uso y planes para el panel exclusivo del propietario de la plataforma. */
export default async function SuperAdminPage() {
  await requireSuperAdmin();
  const [tenants, plans] = await Promise.all([
    prisma.tenant.findMany({
      include: {
        subscription: { include: { plan: { select: { name: true } } } },
        _count: {
          select: {
            products: true,
            memberships: true,
            customerOrders: true,
            reservations: true,
            mediaAssets: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.plan.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { displayOrder: "asc" },
    }),
  ]);
  return (
    <main className="shell py-8 sm:py-12">
      <TenantConsole initialTenants={serialize(tenants) as unknown as PlatformTenant[]} plans={plans} />
    </main>
  );
}
