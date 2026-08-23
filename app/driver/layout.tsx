import type { ReactNode } from "react";
import { requireDriver } from "@/lib/auth";
import { publicTenantUrl } from "@/lib/domains";
import { AdminShell } from "@/components/admin/admin-shell";

export const dynamic = "force-dynamic";

/** @summary Shell unificado del repartidor: reutiliza el AdminShell real del sistema. */
export default async function DriverLayout({ children }: { children: ReactNode }) {
  const context = await requireDriver();
  const branches = context.branches.map(({ id, name, slug, active, isPrimary }) => ({
    id,
    name,
    slug,
    active,
    isPrimary,
  }));

  return (
    <AdminShell
      permissions={context.permissions}
      roleKey={context.membership.role.key}
      tenantName={context.tenant.name}
      tenantSlug={context.tenant.slug}
      tenantGuid={context.tenant.publicGuid}
      publicSiteUrl={publicTenantUrl(context.tenant.slug, context.tenant.customDomain)}
      adminTheme={context.tenant.adminTheme}
      adminAccent={context.tenant.adminAccent}
      palette={context.tenant.palette ?? undefined}
      branches={branches}
      activeBranchId={context.activeBranchId}
      allBranches={context.allBranches}
      userName={context.user.name}
      userEmail={context.user.email}
      userImageUrl={context.user.imageUrl}
    >
      {children}
    </AdminShell>
  );
}
