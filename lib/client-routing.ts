"use client";

import { adminHrefForContext, parseCanonicalPath, publicHrefForContext, scopedApiPath } from "@/lib/routes";

/** Scopea un endpoint al tenant/branch visibles en la URL actual. */
export function apiPath(path: string) {
  if (typeof window === "undefined") return path;
  return scopedApiPath(window.location.pathname, path);
}

/** Fetch que conserva el contrato de `fetch`, pero hace explícito tenant/branch en la URL API. */
export function scopedFetch(input: RequestInfo | URL, init?: RequestInit) {
  if (typeof input === "string") return fetch(apiPath(input), init);
  return fetch(input, init);
}

/** Construye un enlace público tenant-aware desde la URL visible. */
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

/** Construye un enlace administrativo canónico usando tenant/branch de la pestaña actual. */
export function currentAdminHref(logicalHref: string) {
  if (typeof window === "undefined") return logicalHref;
  const context = parseCanonicalPath(window.location.pathname);
  if (context.surface !== "tenant-admin" || !context.tenantSlug) return logicalHref;
  return adminHrefForContext(context.tenantSlug, logicalHref, context.branchSlug);
}
