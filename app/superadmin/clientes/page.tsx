import { ClientList } from "@/components/platform/client-list";
import { platformTenants } from "@/lib/platform-data";

export default async function PlatformClientsPage() { return <ClientList tenants={await platformTenants()} />; }
