import type { Route } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getDefaultTenant, UnknownHostError } from "@/lib/tenant";
import { headers } from "next/headers";
import { classifyHost } from "@/lib/domains";

/** @summary Pide al servidor tratar los recursos estáticos antes que esta página. */
const STATIC_PATH_PATTERN =
  /\.(?:avif|css|gif|ico|jpe?g|js|json|map|pdf|png|svg|txt|webp|woff2?|mp4|webm|usdz|glb|gltf)(?:\?.*)?$/i;
const STATIC_DIRECTORY_PREFIXES = ["/_next/", "/images/", "/icons/", "/models/", "/favicon", "/manifest"];

/**
 * @summary Detecta recursos estáticos para evitar tratarlos como redirecciones administrables.
 */
function looksLikeStaticAsset(pathname: string) {
  if (STATIC_PATH_PATTERN.test(pathname)) return true;
  return STATIC_DIRECTORY_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/** @summary Aplica redirecciones administrables únicamente a rutas que no coinciden con una página vigente. */
export default async function ManagedRedirectPage({ params }: { params: Promise<{ path: string[] }> }) {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "";
  const sourcePath = `/${(await params).path.join("/")}`;

  if (looksLikeStaticAsset(sourcePath)) notFound();
  if (classifyHost(host).kind !== "tenant") notFound();

  let tenant;
  try {
    tenant = await getDefaultTenant();
  } catch (error) {
    if (error instanceof UnknownHostError) notFound();
    throw error;
  }

  const rule = await prisma.redirectRule.findUnique({
    where: { tenantId_sourcePath: { tenantId: tenant.id, sourcePath } },
  });
  if (!rule?.active || rule.targetPath === sourcePath) notFound();
  const targetPath = rule.targetPath as Route;
  if (rule.permanent) permanentRedirect(targetPath);
  redirect(targetPath);
}
