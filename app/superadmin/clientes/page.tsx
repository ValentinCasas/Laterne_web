import { ClientList } from "@/components/platform/client-list";
import { platformTenants } from "@/lib/platform-data";

/**
 * @summary Carga y renderiza el listado de clientes de la plataforma.
 */
export default async function PlatformClientsPage() {
  return <ClientList tenants={await platformTenants()} />;
}
