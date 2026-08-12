import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/auth";
import { PlatformShell } from "@/components/platform/platform-shell";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: { default: "MenuClick Platform", template: `%s | MenuClick Platform` }, description: "Operación global de clientes y suscripciones MenuClick." };

export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdmin();
  const settings = await prisma.platformSettings.findUnique({ where: { id: 1 }, select: { name: true, logoUrl: true } });
  return <PlatformShell name={settings?.name || "MenuClick"} logoUrl={settings?.logoUrl ?? null}>{children}</PlatformShell>;
}
