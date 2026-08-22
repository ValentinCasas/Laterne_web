import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { tenantDriverGuidPath } from "@/lib/routes";

/** @summary Redirige el acceso administrativo heredado al panel personal canónico del repartidor. */
export default async function AdminDriverRedirectPage() {
  const context = await requirePermission("admin.access");
  redirect(tenantDriverGuidPath(context.tenant.publicGuid, context.tenant.slug));
}
