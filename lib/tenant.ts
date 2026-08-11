import { cache } from "react";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  DEV_TENANT_SLUG,
  ROOT_DOMAIN_NAME,
  isAppHost,
  isLocalhost,
  isPlatformHost,
} from "@/lib/domains";

/** @summary Indica que el host de la solicitud no se puede asociar a ningún negocio. */
export class UnknownHostError extends Error {
  constructor(host: string) {
    super(`No existe un negocio para el dominio ${host || "desconocido"}`);
    this.name = "UnknownHostError";
  }
}

/** @summary Extrae el host normalizado de la solicitud ignorando proxies y puertos. */
function requestHost(requestHeaders: Headers) {
  return (requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "")
    .split(",")[0]
    .trim()
    .split(":")[0]
    .toLocaleLowerCase("es");
}

/** @summary Resuelve el negocio de un host mediante dominio propio o subdominio del producto. */
export const resolveTenantByHost = cache(async (host: string) => {
  if (!host) return null;

  const customDomain = await prisma.brandSettings.findFirst({
    where: { customDomain: host },
    select: { tenant: true },
  });
  if (customDomain) return customDomain.tenant;

  if (!isPlatformHost(host) && !isAppHost(host) && host.endsWith(`.${ROOT_DOMAIN_NAME}`)) {
    const slug = host.slice(0, -(ROOT_DOMAIN_NAME.length + 1)).split(".").at(-1);
    if (slug) {
      return prisma.tenant.findUnique({ where: { slug } });
    }
  }
  return null;
});

/** @summary Devuelve el negocio del host solicitado sin permitir coincidencias por defecto. */
export const getDefaultTenant = cache(async () => {
  const requestHeaders = await headers();
  const host = requestHost(requestHeaders);

  const resolved = await resolveTenantByHost(host);
  if (resolved) return resolved;

  if (isLocalhost(host) && process.env.NODE_ENV !== "production") {
    const devTenant = await prisma.tenant.findUnique({ where: { slug: DEV_TENANT_SLUG } });
    if (devTenant) return devTenant;
    const firstActive = await prisma.tenant.findFirst({
      where: { status: "active" },
      orderBy: { id: "asc" },
    });
    if (firstActive) return firstActive;
  }

  throw new UnknownHostError(host);
});

/** @summary Busca un negocio activo mediante su identificador público legible. */
export const getTenantBySlug = cache(async (slug: string) => {
  return prisma.tenant.findFirst({ where: { slug, status: "active" } });
});
