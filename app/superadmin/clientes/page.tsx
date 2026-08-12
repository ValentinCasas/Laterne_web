import { ClientList } from "@/components/superadmin/client-list";
import { platformTenants } from "@/lib/platform-data";

export default async function PlatformClientsPage() { return <ClientList tenants={await platformTenants()} />; }
