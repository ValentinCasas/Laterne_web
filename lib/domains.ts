const ROOT_DOMAIN = (process.env.ROOT_DOMAIN ?? "menu-click.app").toLocaleLowerCase("es").replace(/\.$/, "");
const PLATFORM_SUBDOMAIN = (process.env.PLATFORM_SUBDOMAIN ?? "platform").toLocaleLowerCase("es");
const APP_SUBDOMAIN = (process.env.APP_SUBDOMAIN ?? "app").toLocaleLowerCase("es");

/** @summary Slug del negocio de demostración usado como respaldo en desarrollo local. */
export const DEV_TENANT_SLUG = process.env.DEV_TENANT_SLUG ?? "laterne";

export const ROOT_DOMAIN_NAME = ROOT_DOMAIN;
export const PLATFORM_HOST = `${PLATFORM_SUBDOMAIN}.${ROOT_DOMAIN}`;
export const APP_HOST = `${APP_SUBDOMAIN}.${ROOT_DOMAIN}`;

/** @summary Slug reservados para no colisionar con subdominios propios del producto. */
export const RESERVED_SLUGS = new Set([
  "app",
  "platform",
  "admin",
  "api",
  "www",
  "static",
  "assets",
  "cdn",
  "mail",
  "smtp",
  "webmail",
  "docs",
  "status",
  "help",
  "soporte",
  "blog",
  "demo",
  "login",
  "auth",
  "superadmin",
  "m",
  "vpn",
  "proxy",
]);

/** @summary Nombre de host asignado al sitio público de un negocio (ej: laterne.menu-click.app). */
export function tenantHost(slug: string) {
  return `${slug.toLocaleLowerCase("es")}.${ROOT_DOMAIN}`;
}

/** @summary URL pública de un negocio con su subdominio propio. */
export function publicTenantUrl(slug: string) {
  return `https://${tenantHost(slug)}`;
}

/** @summary Determina si el host corresponde al panel de control de la plataforma. */
export function isPlatformHost(host: string) {
  return host.toLocaleLowerCase("es") === PLATFORM_HOST;
}

/** @summary Determina si el host corresponde al panel administrativo de los negocios. */
export function isAppHost(host: string) {
  return host.toLocaleLowerCase("es") === APP_HOST;
}

/** @summary Determina si el host pertenece al sitio público de algún negocio del producto. */
export function isTenantHost(host: string) {
  const normalized = host.toLocaleLowerCase("es");
  return normalized.endsWith(`.${ROOT_DOMAIN}`) && !isPlatformHost(normalized) && !isAppHost(normalized);
}

/** @summary Determina si el host es un equipo local sin resolución de DNS. */
export function isLocalhost(host: string) {
  const normalized = host.toLocaleLowerCase("es");
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

/** @summary Indica si un slug está reservado para el producto y no puede elegirse como negocio. */
export function isReservedSlug(slug: string) {
  return RESERVED_SLUGS.has(slug.toLocaleLowerCase("es"));
}
