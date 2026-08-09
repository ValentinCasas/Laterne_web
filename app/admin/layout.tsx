import { AdminShell } from "@/components/admin/admin-shell";
import { requireSession } from "@/lib/auth";

/** @summary Protege y organiza la estructura compartida de las pantallas administrativas. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  return <AdminShell>{children}</AdminShell>;
}
