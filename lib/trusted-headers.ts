import { trustProxy } from "./config";

/**
 * Resolución de headers de proxy con confianza explícita.
 *
 * MenuClick resuelve tenants por host/dominio, así que no puede confiar a ciegas
 * en `X-Forwarded-Host`/`X-Forwarded-Proto`/`X-Forwarded-For` provenientes de
 * Internet (son falsificables). Solo cuando `TRUST_PROXY=true` (el operador
 * confirma que las peticiones entran por un proxy conocido: Nginx, Traefik,
 * Cloudflare, load balancer) se utilizan esos headers.
 *
 * Sin `TRUST_PROXY`, el host efectivo sale del header `Host` normalizado y los
 * headers reenviados se descartan antes de llegar a las rutas internas.
 */

export type HeaderLike = Pick<Headers, "get">;

export function trustProxyEnabled() {
  return trustProxy();
}

/** @summary Devuelve el host reenviado por un proxy confiable, o null si no aplica. */
export function forwardedHost(headers: HeaderLike) {
  if (!trustProxyEnabled()) return null;
  return headers.get("x-forwarded-host")?.split(",")[0]?.trim() || null;
}

/** @summary Devuelve el protocolo reenviado por un proxy confiable, o null si no aplica. */
export function forwardedProto(headers: HeaderLike) {
  if (!trustProxyEnabled()) return null;
  const value = headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (value === "https" || value === "http") return value;
  return null;
}

/** @summary Host efectivo de la solicitud respetando la política de proxy. */
export function effectiveHost(headers: HeaderLike) {
  return forwardedHost(headers) || headers.get("host")?.trim() || "";
}

/** @summary Protocolo efectivo (http/https) respetando la política de proxy. */
export function effectiveProto(headers: HeaderLike) {
  return forwardedProto(headers) || "http";
}

/**
 * @summary Devuelve una copia de los headers con los `X-Forwarded-*` sanitizados.
 * Cuando no hay proxy confiable, se eliminan para que las rutas internas usen
 * únicamente el header `Host` y la IP real del socket.
 */
export function sanitizedForwardedHeaders(headers: Headers) {
  if (trustProxyEnabled()) return headers;
  const copy = new Headers(headers);
  copy.delete("x-forwarded-host");
  copy.delete("x-forwarded-proto");
  copy.delete("x-forwarded-for");
  copy.delete("x-real-ip");
  return copy;
}