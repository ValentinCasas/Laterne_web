import { AdminShell } from "@/components/admin/admin-shell";
import { requirePermission } from "@/lib/auth";
import { publicTenantUrl } from "@/lib/domains";

/** @summary Protege y organiza la estructura compartida de las pantallas administrativas. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const context = await requirePermission("admin.access");
  return (
    <AdminShell
      permissions={context.permissions}
      tenantName={context.tenant.name}
      publicSiteUrl={publicTenantUrl(context.tenant.slug, context.tenant.customDomain)}
    >
      {children}
    </AdminShell>
  );
}
