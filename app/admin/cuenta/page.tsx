import { AccountSecurity } from "@/components/admin/account-security";
import { requirePermission } from "@/lib/auth";

/** @summary Protege y presenta las herramientas de seguridad de la cuenta actual. */
export default async function AccountPage() {
  await requirePermission("admin.access");
  return <AccountSecurity />;
}
