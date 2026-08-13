/**
 * Routing canónico de MenuClick.
 *
 * El tenant y la sucursal viven en la URL. El host solo separa superficies en
 * producción (público/app) o resuelve un dominio personalizado.
 */

export type RouteSurface = "platform-public" | "platform-admin" | "tenant-public" | "tenant-admin" | "unknown";

export type CanonicalRouteContext = {
  surface: RouteSurface;
  tenantSlug?: string;
  branchSlug?: string;
  /** Ruta lógica que entiende el árbol legacy interno (solo durante la transición). */
  logicalPath: string;
};

/** Secciones administrativas cuyo contenido puede depender de una sucursal. */
export const BRANCH_ADMIN_SECTIONS = new Set([
  "productos",
  "opciones-producto",
  "categorias",
  "promociones",
  "eventos",
  "horarios",
  "testimonios",
  "pedidos",
  "reservas",
  "facturacion",
  "inventario",
  "mesas",
  "clientes-frecuentes",
  "estadisticas",
  "notificaciones",
  "archivos",
  "auditoria",
  "datos",
]);

/** Rutas públicas que pueden existir dentro del contexto explícito de una sucursal. */
export const BRANCH_PUBLIC_SECTIONS = new Set([
  "carta",
  "reservas",
  "pedido",
  "productos",
  "promociones",
  "fidelidad",
  "mesa",
]);

function cleanSlug(value: string) {
  return value.trim().toLocaleLowerCase("es");
}

function encodedSlug(value: string) {
  return encodeURIComponent(cleanSlug(value));
}

function normalizedSuffix(path = "") {
  const value = path.trim();
  if (!value || value === "/") return "";
  return value.startsWith("/") ? value : `/${value}`;
}

/** Construye la URL pública canónica de un tenant. */
export function tenantPublicPath(tenantSlug: string, path = "") {
  return `/t/${encodedSlug(tenantSlug)}${normalizedSuffix(path)}`;
}

/** Construye la URL pública canónica de una sucursal. */
export function tenantBranchPublicPath(tenantSlug: string, branchSlug: string, path = "") {
  return `/t/${encodedSlug(tenantSlug)}/s/${encodedSlug(branchSlug)}${normalizedSuffix(path)}`;
}

/** Construye una URL administrativa tenant-level. `path` puede ser `/admin/foo` o `/foo`. */
export function tenantAdminPath(tenantSlug: string, path = "") {
  const suffix = normalizedSuffix(path).replace(/^\/admin(?=\/|$)/, "");
  return `/t/${encodedSlug(tenantSlug)}/admin${suffix}`;
}

/** Construye una URL administrativa branch-level. `path` puede ser `/admin/foo` o `/foo`. */
export function tenantBranchAdminPath(tenantSlug: string, branchSlug: string, path = "") {
  const suffix = normalizedSuffix(path).replace(/^\/admin(?=\/|$)/, "");
  return `/t/${encodedSlug(tenantSlug)}/admin/s/${encodedSlug(branchSlug)}${suffix}`;
}

/** Convierte rutas internas `/superadmin/...` a la superficie pública `/platform/...`. */
export function platformAdminPath(path = "") {
  const suffix = normalizedSuffix(path).replace(/^\/superadmin(?=\/|$)/, "");
  return `/platform${suffix}`;
}

/** Devuelve el primer segmento administrativo lógico (`pedidos`, `usuarios`, etc.). */
export function adminSectionFromLogicalPath(path: string) {
  const pathOnly = path.split(/[?#]/, 1)[0];
  const normalized = pathOnly.replace(/^\/admin\/?/, "");
  return normalized.split("/")[0] || "";
}

/** Indica si una ruta administrativa lógica soporta scope de sucursal. */
export function isBranchAdminLogicalPath(path: string) {
  const section = adminSectionFromLogicalPath(path);
  return section === "" || BRANCH_ADMIN_SECTIONS.has(section);
}

/** Interpreta una URL canónica sin depender del host, cookies ni estado React. */
export function parseCanonicalPath(pathname: string): CanonicalRouteContext {
  const path = pathname.split("?")[0] || "/";

  const branchAdmin = path.match(/^\/t\/([^/]+)\/admin\/s\/([^/]+)(\/.*)?$/);
  if (branchAdmin) {
    const rest = branchAdmin[3] || "";
    return {
      surface: "tenant-admin",
      tenantSlug: decodeURIComponent(branchAdmin[1]),
      branchSlug: decodeURIComponent(branchAdmin[2]),
      logicalPath: `/admin${rest}`,
    };
  }

  const tenantAdmin = path.match(/^\/t\/([^/]+)\/admin(\/.*)?$/);
  if (tenantAdmin) {
    const rest = tenantAdmin[2] || "";
    return {
      surface: "tenant-admin",
      tenantSlug: decodeURIComponent(tenantAdmin[1]),
      logicalPath: `/admin${rest}`,
    };
  }

  const branchPublic = path.match(/^\/t\/([^/]+)\/s\/([^/]+)(\/.*)?$/);
  if (branchPublic) {
    const rest = branchPublic[3] || "";
    return {
      surface: "tenant-public",
      tenantSlug: decodeURIComponent(branchPublic[1]),
      branchSlug: decodeURIComponent(branchPublic[2]),
      logicalPath: `/s/${encodeURIComponent(decodeURIComponent(branchPublic[2]))}${rest}`,
    };
  }

  const tenantPublic = path.match(/^\/t\/([^/]+)(\/.*)?$/);
  if (tenantPublic) {
    return {
      surface: "tenant-public",
      tenantSlug: decodeURIComponent(tenantPublic[1]),
      logicalPath: tenantPublic[2] || "/",
    };
  }

  const platformAdmin = path.match(/^\/platform(\/.*)?$/);
  if (platformAdmin) {
    return {
      surface: "platform-admin",
      logicalPath: `/superadmin${platformAdmin[1] || ""}`,
    };
  }

  return { surface: "platform-public", logicalPath: path };
}

/** Ruta admin canónica para un enlace lógico `/admin/...`, preservando branch solo cuando corresponde. */
export function adminHrefForContext(
  tenantSlug: string,
  logicalHref: string,
  branchSlug?: string,
) {
  return branchSlug && isBranchAdminLogicalPath(logicalHref)
    ? tenantBranchAdminPath(tenantSlug, branchSlug, logicalHref)
    : tenantAdminPath(tenantSlug, logicalHref);
}

/** Convierte un href público legacy (`/carta`) al path tenant/branch canónico. */
export function publicHrefForContext(
  tenantSlug: string,
  logicalHref: string,
  branchSlug?: string,
) {
  if (/^(?:https?:|mailto:|tel:|#)/i.test(logicalHref)) return logicalHref;
  const match = logicalHref.match(/^([^?#]*)(\?[^#]*)?(#.*)?$/);
  const path = match?.[1] || "/";
  const suffix = `${match?.[2] || ""}${match?.[3] || ""}`;
  if ((path === "" || path === "/") && branchSlug) return `${tenantBranchPublicPath(tenantSlug, branchSlug)}${suffix}`;
  if (branchSlug) {
    const section = path.replace(/^\//, "").split("/")[0];
    if (BRANCH_PUBLIC_SECTIONS.has(section)) {
      return `${tenantBranchPublicPath(tenantSlug, branchSlug, path)}${suffix}`;
    }
  }
  return `${tenantPublicPath(tenantSlug, path)}${suffix}`;
}

/** Construye links públicos respetando dominios personalizados (paths planos) y rutas canónicas `/t/...`. */
export function publicHrefForVisiblePath(
  visiblePathname: string,
  tenantSlug: string,
  logicalHref: string,
  branchSlug?: string,
) {
  if (/^(?:https?:|mailto:|tel:|#)/i.test(logicalHref)) return logicalHref;
  const canonical = parseCanonicalPath(visiblePathname);
  if (canonical.surface === "tenant-public" && canonical.tenantSlug) {
    return publicHrefForContext(canonical.tenantSlug, logicalHref, canonical.branchSlug ?? branchSlug);
  }

  // Dominio personalizado/legacy: el host ya identifica al tenant, por eso no
  // agregamos `/t/{slug}`. Solo preservamos `/s/{branch}` cuando la vista lo requiere.
  const match = logicalHref.match(/^([^?#]*)(\?[^#]*)?(#.*)?$/);
  const path = match?.[1] || "/";
  const suffix = `${match?.[2] || ""}${match?.[3] || ""}`;
  if (!branchSlug) return `${path}${suffix}`;
  if (path === "" || path === "/") return `/s/${encodedSlug(branchSlug)}${suffix}`;
  const section = path.replace(/^\//, "").split("/")[0];
  return BRANCH_PUBLIC_SECTIONS.has(section)
    ? `/s/${encodedSlug(branchSlug)}${path}${suffix}`
    : `${path}${suffix}`;
}


/** Construye un href admin canónico a partir de la URL visible de la pestaña. */
export function adminHrefFromPathname(pathname: string, logicalHref: string) {
  const context = parseCanonicalPath(pathname);
  if (context.surface !== "tenant-admin" || !context.tenantSlug) return logicalHref;
  return adminHrefForContext(context.tenantSlug, logicalHref, context.branchSlug);
}

/** Construye un href público canónico a partir de la URL visible de la pestaña. */
export function publicHrefFromPathname(pathname: string, logicalHref: string) {
  const context = parseCanonicalPath(pathname);
  if (context.surface !== "tenant-public" || !context.tenantSlug) return logicalHref;
  return publicHrefForContext(context.tenantSlug, logicalHref, context.branchSlug);
}

/** Extrae tenant/branch de la URL visible y scopea un endpoint API legacy. */
export function scopedApiPath(pathname: string, apiPath: string) {
  if (!apiPath.startsWith("/api/")) return apiPath;
  if (apiPath.startsWith("/api/platform/") || apiPath.startsWith("/api/t/")) return apiPath;
  const context = parseCanonicalPath(pathname);

  if (apiPath.startsWith("/api/superadmin/")) {
    return `/api/platform/${apiPath.slice("/api/superadmin/".length)}`;
  }

  if (context.surface === "platform-admin" && apiPath.startsWith("/api/auth/")) {
    return `/api/platform/auth/${apiPath.slice("/api/auth/".length)}`;
  }

  if (context.surface === "platform-admin" && apiPath.startsWith("/api/admin/leads/")) {
    return `/api/platform/leads/${apiPath.slice("/api/admin/leads/".length)}`;
  }

  if (!context.tenantSlug) return apiPath;
  const tenant = encodedSlug(context.tenantSlug);
  const branch = context.branchSlug ? `/s/${encodedSlug(context.branchSlug)}` : "";

  if (apiPath.startsWith("/api/admin/")) {
    return `/api/t/${tenant}/admin${branch}/${apiPath.slice("/api/admin/".length)}`;
  }
  if (apiPath === "/api/admin") return `/api/t/${tenant}/admin${branch}`;

  if (apiPath.startsWith("/api/auth/")) {
    return `/api/t/${tenant}/auth/${apiPath.slice("/api/auth/".length)}`;
  }

  const publicRest = apiPath.slice("/api/".length);
  return `/api/t/${tenant}${branch}/${publicRest}`;
}

/** Convierte una ruta admin visible en su equivalente consolidado o branch específico. */
export function switchAdminBranchPath(pathname: string, branchSlug?: string) {
  const context = parseCanonicalPath(pathname);
  if (context.surface !== "tenant-admin" || !context.tenantSlug) return pathname;
  const logical = context.logicalPath;
  return branchSlug && isBranchAdminLogicalPath(logical)
    ? tenantBranchAdminPath(context.tenantSlug, branchSlug, logical)
    : tenantAdminPath(context.tenantSlug, logical);
}
