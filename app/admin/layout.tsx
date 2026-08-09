import { AdminShell } from "@/components/admin/admin-shell";
import { requirePermission } from "@/lib/auth";

/** @summary Protege y organiza la estructura compartida de las pantallas administrativas. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const context = await requirePermission("admin.access");
  return <AdminShell permissions={context.permissions}>{children}</AdminShell>;
}
