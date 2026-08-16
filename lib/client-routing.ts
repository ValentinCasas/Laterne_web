"use client";

import { parseCanonicalPath, publicHrefForContext, scopedApiPath } from "@/lib/routes";

/**
 * @summary Convierte una ruta lógica de API en su variante canónica con contexto.
 * Solo se usa en event handlers/effects, nunca durante el render.
 */
export function apiPath(path: string) {
  if (typeof window === "undefined") return path;
  return scopedApiPath(window.location.pathname, path);
}

/**
 * @summary Ejecuta una solicitud usando la ruta de API canónica del contexto visible.
 */
export function scopedFetch(input: RequestInfo | URL, init?: RequestInit) {
  if (typeof input === "string") return fetch(apiPath(input), init);
  return fetch(input, init);
}

/**
 * @summary Construye un enlace público conservando tenant y sucursal actuales.
 * No se usa durante el render (depende de `window`); los enlaces visibles se
 * resuelven en el servidor con `publicHrefForContext`/`publicHrefForVisiblePath`.
 */
export function currentPublicHref(logicalHref: string, options?: { preserveBranch?: boolean }) {
  if (typeof window === "undefined") return logicalHref;
  const context = parseCanonicalPath(window.location.pathname);
  if (!context.tenantSlug) return logicalHref;
  return publicHrefForContext(
    context.tenantSlug,
    logicalHref,
    options?.preserveBranch === false ? undefined : context.branchSlug,
  );
}
