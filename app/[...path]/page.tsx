import type { Route } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getDefaultTenant } from "@/lib/tenant";

/** @summary Aplica redirecciones administrables únicamente a rutas que no coinciden con una página vigente. */
export default async function ManagedRedirectPage({ params }: { params: Promise<{ path: string[] }> }) {
  const tenant = await getDefaultTenant();
  const sourcePath = `/${(await params).path.join("/")}`;
  const rule = await prisma.redirectRule.findUnique({
    where: { tenantId_sourcePath: { tenantId: tenant.id, sourcePath } },
  });
  if (!rule?.active || rule.targetPath === sourcePath) notFound();
  const targetPath = rule.targetPath as Route;
  if (rule.permanent) permanentRedirect(targetPath);
  redirect(targetPath);
}
