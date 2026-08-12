import { PlatformDashboard } from "@/components/platform/platform-dashboard";
import { requireSuperAdmin } from "@/lib/auth";
import { platformTenants } from "@/lib/platform-data";

/** @summary Carga clientes, uso y planes para el panel exclusivo del propietario de la plataforma. */
export default async function SuperAdminPage() {
  await requireSuperAdmin();
  const tenants = await platformTenants();
  return (
    <PlatformDashboard tenants={tenants as never} />
  );
}
