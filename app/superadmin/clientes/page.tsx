import { ClientList } from "@/components/superadmin/client-list";
import { platformTenants } from "@/lib/platform-data";
import { adminLoginUrl } from "@/lib/domains";

export default async function PlatformClientsPage() { return <ClientList tenants={await platformTenants()} adminBaseUrl={adminLoginUrl().replace(/\/login$/, "")} />; }
