import { AdminShell } from "@/components/admin/admin-shell";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** @summary Protege y organiza la estructura compartida de las pantallas administrativas. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const context = await requirePermission("admin.access");
  const user = await prisma.user.findUnique({
    where: { id: context.session.userId },
    select: { isSuperAdmin: true },
  });
  return (
    <AdminShell permissions={context.permissions} isSuperAdmin={Boolean(user?.isSuperAdmin)}>
      {children}
    </AdminShell>
  );
}
