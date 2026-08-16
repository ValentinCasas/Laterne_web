import { AdminShell } from "@/components/admin/admin-shell";
import { requirePermission } from "@/lib/auth";
import { publicTenantUrl } from "@/lib/domains";
import type { Metadata } from "next";

/**
 * @summary Genera los metadatos de la vista para el tenant autorizado.
 */
export async function generateMetadata(): Promise<Metadata> {
  const context = await requirePermission("admin.access");
  return {
    title: { default: `${context.tenant.name} | Administración`, template: `%s | ${context.tenant.name}` },
    description: `Panel de administración de ${context.tenant.name}.`,
  };
}

/** @summary Protege y organiza la estructura compartida de las pantallas administrativas. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const context = await requirePermission("admin.access");
  return (
    <AdminShell
      permissions={context.permissions}
      tenantName={context.tenant.name}
      tenantSlug={context.tenant.slug}
      tenantGuid={context.tenant.publicGuid}
      publicSiteUrl={publicTenantUrl(context.tenant.slug, context.tenant.customDomain)}
      adminTheme={context.tenant.adminTheme}
      adminAccent={context.tenant.adminAccent}
      palette={context.tenant.palette ?? undefined}
      branches={context.branches}
      activeBranchId={context.activeBranchId}
      allBranches={context.allBranches}
    >
      {children}
    </AdminShell>
  );
}
