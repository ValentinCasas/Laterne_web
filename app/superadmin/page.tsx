import { TenantConsole, type PlatformTenant } from "@/components/superadmin/tenant-console";
import { requireSuperAdmin } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";

/** @summary Carga clientes, uso y planes para el panel exclusivo del propietario de la plataforma. */
export default async function SuperAdminPage() {
  await requireSuperAdmin();
  const [tenants, plans, storage] = await Promise.all([
    prisma.tenant.findMany({
      include: {
        subscription: { include: { plan: { select: { name: true } } } },
        brandSettings: { select: { customDomain: true } },
        platformPayments: {
          select: { amount: true, currency: true, paidAt: true, method: true, reference: true },
          orderBy: { paidAt: "desc" },
          take: 3,
        },
        _count: {
          select: {
            products: true,
            memberships: true,
            customerOrders: true,
            reservations: true,
            mediaAssets: true,
            errorLogs: true,
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
    prisma.mediaAsset.groupBy({
      by: ["tenantId"],
      _sum: { sizeBytes: true },
    }),
  ]);
  const storageByTenant = new Map(storage.map((item) => [item.tenantId, item._sum.sizeBytes ?? 0]));
  return (
    <main className="shell py-8 sm:py-12">
      <TenantConsole
        initialTenants={
          serialize(
            tenants.map((tenant) => ({
              ...tenant,
              storageBytes: storageByTenant.get(tenant.id) ?? 0,
            })),
          ) as unknown as PlatformTenant[]
        }
        plans={plans}
      />
    </main>
  );
}
