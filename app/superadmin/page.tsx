import { PlatformDashboard } from "@/components/platform/platform-dashboard";
import { requireSuperAdmin } from "@/lib/auth";
import { platformTenants } from "@/lib/platform-data";
import { prisma } from "@/lib/prisma";

/** @summary Carga clientes, uso y oportunidades para el panel exclusivo del propietario de la plataforma. */
export default async function SuperAdminPage() {
  await requireSuperAdmin();
  const [tenants, newLeads] = await Promise.all([
    platformTenants(),
    prisma.salesLead.count({ where: { status: "new" } }),
  ]);
  return (
    <PlatformDashboard tenants={tenants as never} newLeads={newLeads} />
  );
}
