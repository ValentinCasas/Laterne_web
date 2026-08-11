import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/auth";
import { PlatformShell } from "@/components/superadmin/platform-shell";

export const metadata: Metadata = { title: { default: "MenuClick Platform", template: `%s | MenuClick Platform` }, description: "Operación global de clientes y suscripciones MenuClick." };

export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdmin();
  return <PlatformShell>{children}</PlatformShell>;
}
