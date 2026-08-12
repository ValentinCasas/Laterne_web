const normalizeConfiguredDomain = (value: string | undefined) =>
  (value ?? "").trim().toLocaleLowerCase("es").replace(/\.$/, "");

/** @summary Indica si la aplicación está ejecutándose bajo `next dev`. */
export const isDevelopmentEnvironment = process.env.NODE_ENV === "development";

/** @summary Dominio real usado exclusivamente fuera de development. */
export const PRODUCTION_ROOT_DOMAIN = normalizeConfiguredDomain(process.env.ROOT_DOMAIN);

/** @summary Dominio reservado para ejecutar el producto localmente sin HSTS. */
export const DEVELOPMENT_ROOT_DOMAIN = normalizeConfiguredDomain(process.env.DEV_ROOT_DOMAIN);

const PLATFORM_SUBDOMAIN = (process.env.PLATFORM_SUBDOMAIN ?? "platform").trim().toLocaleLowerCase("es");
const APP_SUBDOMAIN = (process.env.APP_SUBDOMAIN ?? "app").trim().toLocaleLowerCase("es");
const ACTIVE_ROOT_DOMAIN = isDevelopmentEnvironment ? DEVELOPMENT_ROOT_DOMAIN : PRODUCTION_ROOT_DOMAIN;
const DEVELOPMENT_PORT = (process.env.DEV_PORT ?? "").trim().match(/^\d+$/)?.[0] ?? "";

/** @summary Slug configurado para resolver el tenant local, sin elegir negocios implícitamente. */
export const DEV_TENANT_SLUG = (process.env.DEV_TENANT_SLUG ?? "").trim().toLocaleLowerCase("es");

export const ROOT_DOMAIN_NAME = ACTIVE_ROOT_DOMAIN;
export const PLATFORM_HOST = ACTIVE_ROOT_DOMAIN ? `${PLATFORM_SUBDOMAIN}.${ACTIVE_ROOT_DOMAIN}` : "";
export const APP_HOST = ACTIVE_ROOT_DOMAIN ? `${APP_SUBDOMAIN}.${ACTIVE_ROOT_DOMAIN}` : "";
export const DEV_PLATFORM_HOST = DEVELOPMENT_ROOT_DOMAIN
  ? `${PLATFORM_SUBDOMAIN}.${DEVELOPMENT_ROOT_DOMAIN}`
  : "";
export const DEV_APP_HOST = DEVELOPMENT_ROOT_DOMAIN ? `${APP_SUBDOMAIN}.${DEVELOPMENT_ROOT_DOMAIN}` : "";

/** @summary Devuelve los hosts conocidos que pueden solicitar recursos al servidor Next en development. */
export function developmentAllowedOrigins() {
  if (!DEVELOPMENT_ROOT_DOMAIN) return ["localhost", "127.0.0.1"];
  return [
    "localhost",
    "127.0.0.1",
    `*.${DEVELOPMENT_ROOT_DOMAIN}`,
    DEV_PLATFORM_HOST,
    DEV_APP_HOST,
    DEV_TENANT_SLUG ? `${DEV_TENANT_SLUG}.${DEVELOPMENT_ROOT_DOMAIN}` : "",
  ].filter(Boolean);
}

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

/** @summary Nombre de host asignado al sitio público de un negocio en el entorno activo. */
export function tenantHost(slug: string) {
  return `${slug.toLocaleLowerCase("es")}.${ROOT_DOMAIN_NAME}`;
}

/** @summary URL pública de un negocio usando HTTP local, HTTPS en producción y dominio propio cuando corresponde. */
export function publicTenantUrl(slug: string, customDomain?: string | null) {
  const host = !isDevelopmentEnvironment && customDomain?.trim() ? customDomain.trim() : tenantHost(slug);
  const port = isDevelopmentEnvironment && DEVELOPMENT_PORT ? `:${DEVELOPMENT_PORT}` : "";
  return `${isDevelopmentEnvironment ? "http" : "https"}://${host}${port}`;
}

/** @summary Construye el acceso administrativo del negocio en el host reservado de la aplicación. */
export function adminLoginUrl(tenantId?: number, tenantSlug?: string) {
  const host = APP_HOST || "localhost";
  const port = isDevelopmentEnvironment && DEVELOPMENT_PORT ? `:${DEVELOPMENT_PORT}` : "";
  const query = tenantId
    ? `?tenantId=${encodeURIComponent(String(tenantId))}`
    : tenantSlug
      ? `?tenantSlug=${encodeURIComponent(tenantSlug)}`
      : "";
  return `${isDevelopmentEnvironment ? "http" : "https"}://${host}${port}/login${query}`;
}

/** @summary Determina si el host corresponde al panel de control de la plataforma. */
export function isPlatformHost(host: string) {
  const normalized = host.toLocaleLowerCase("es");
  return Boolean(
    PLATFORM_HOST &&
    (normalized === PLATFORM_HOST ||
      normalized === ROOT_DOMAIN_NAME ||
      normalized === `www.${ROOT_DOMAIN_NAME}`),
  );
}

/** @summary Determina si el host corresponde al panel administrativo de los negocios. */
export function isAppHost(host: string) {
  return Boolean(APP_HOST && host.toLocaleLowerCase("es") === APP_HOST);
}

/** @summary Determina si el host pertenece al sitio público de algún negocio del producto. */
export function isTenantHost(host: string) {
  const normalized = host.toLocaleLowerCase("es");
  return Boolean(
    ROOT_DOMAIN_NAME &&
    normalized.endsWith(`.${ROOT_DOMAIN_NAME}`) &&
    !isPlatformHost(normalized) &&
    !isAppHost(normalized),
  );
}

/** @summary Determina si el host es localhost o loopback. */
export function isLocalhost(host: string) {
  const normalized = host.toLocaleLowerCase("es");
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

/** @summary Detecta loopback e IPs privadas usadas por la red local de `next dev`. */
export function isLocalDevelopmentHost(host: string) {
  const normalized = host.toLocaleLowerCase("es");
  if (isLocalhost(normalized)) return true;
  const octets = normalized.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd");
  }
  return (
    octets[0] === 10 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168) ||
    (octets[0] === 169 && octets[1] === 254)
  );
}

/** @summary Indica si un slug está reservado para el producto y no puede elegirse como negocio. */
export function isReservedSlug(slug: string) {
  return RESERVED_SLUGS.has(slug.toLocaleLowerCase("es"));
}

/** @summary Experiencia que corresponde a un host: plataforma, administración de clientes, sitio público o desconocido. */
export type HostKind = "platform" | "app" | "tenant" | "unknown";

/** @summary Normaliza un host ignorando proxies, puertos y variaciones de mayúsculas. */
export function normalizeHost(host: string) {
  return (host ?? "").split(",")[0].trim().split(":")[0].toLocaleLowerCase("es");
}

/** @summary Construye el origen de la solicitud respetando HTTP local y el protocolo del proxy en producción. */
export function requestOrigin(requestHeaders: Pick<Headers, "get">) {
  const forwardedHost = requestHeaders.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || requestHeaders.get("host")?.trim();
  if (host) {
    const forwardedProtocol = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const protocol = isDevelopmentEnvironment ? "http" : forwardedProtocol || "https";
    return `${protocol}://${host}`;
  }
  return process.env.NEXT_PUBLIC_SITE_URL || (isDevelopmentEnvironment ? "http://localhost:3000" : null);
}

/** @summary Clasifica un host según la experiencia que debe ofrecer, sin consultar la base de datos. */
export function classifyHost(host: string): { kind: HostKind; slug?: string } {
  const normalized = normalizeHost(host);
  if (!normalized) return { kind: "unknown" };
  if (isPlatformHost(normalized)) return { kind: "platform" };
  if (isAppHost(normalized)) return { kind: "app" };
  if (process.env.NODE_ENV === "development" && isLocalDevelopmentHost(normalized) && DEV_TENANT_SLUG) {
    return { kind: "tenant", slug: DEV_TENANT_SLUG };
  }
  if (isTenantHost(normalized)) {
    const prefix = normalized.slice(0, -(ROOT_DOMAIN_NAME.length + 1));
    if (!prefix.includes(".")) return { kind: "tenant", slug: prefix };
  }
  return { kind: "unknown" };
}
