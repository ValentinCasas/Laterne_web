/**
 * Routing canónico de MenuClick.
 *
 * El tenant y la sucursal viven en la URL. El host solo separa superficies en
 * producción (público/app) o resuelve un dominio personalizado.
 */

import type { Route } from "next";

export type RouteSurface =
  "platform-public" | "platform-admin" | "tenant-public" | "tenant-admin" | "unknown";

export type CanonicalRouteContext = {
  surface: RouteSurface;
  tenantSlug?: string;
  /** Identidad pública inmutable del negocio, presente en URLs administrativas canónicas. */
  tenantGuid?: string;
  branchSlug?: string;
  /** Ruta lógica que entiende el árbol interno heredado durante la transición. */
  logicalPath: string;
};

/** Secciones administrativas cuyo contenido puede depender de una sucursal. */
export const BRANCH_ADMIN_SECTIONS = new Set([
  "productos",
  "ingredientes",
  "recetas",
  "opciones-producto",
  "categorias",
  "promociones",
  "eventos",
  "horarios",
  "testimonios",
  "pedidos",
  "cocina",
  "impresion",
  "salon",
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

/**
 * @summary Limpia un slug antes de incorporarlo a una ruta.
 */
function cleanSlug(value: string) {
  return value.trim().toLocaleLowerCase("es");
}

/**
 * @summary Codifica un slug limpio para utilizarlo en una URL.
 */
function encodedSlug(value: string) {
  return encodeURIComponent(cleanSlug(value));
}

/**
 * @summary Normaliza un sufijo de ruta evitando barras duplicadas.
 */
function normalizedSuffix(path = "") {
  const value = path.trim();
  if (!value || value === "/") return "";
  return value.startsWith("/") ? value : `/${value}`;
}

/**
 * @summary Construye una ruta pública canónica para un tenant.
 */
export function tenantPublicPath(tenantSlug: string, path = ""): Route {
  return `/t/${encodedSlug(tenantSlug)}${normalizedSuffix(path)}` as Route;
}

/**
 * @summary Construye una ruta pública canónica para una sucursal.
 */
export function tenantBranchPublicPath(tenantSlug: string, branchSlug: string, path = ""): Route {
  return `/t/${encodedSlug(tenantSlug)}/s/${encodedSlug(branchSlug)}${normalizedSuffix(path)}` as Route;
}

/**
 * @summary Construye una ruta administrativa canónica para un tenant.
 * @param path Ruta como `/admin/foo` o `/foo`.
 */
export function tenantAdminPath(tenantSlug: string, path = ""): Route {
  const suffix = normalizedSuffix(path).replace(/^\/admin(?=\/|$)/, "");
  return `/t/${encodedSlug(tenantSlug)}/admin${suffix}` as Route;
}

/**
 * @summary Construye una ruta administrativa canónica para una sucursal.
 * @param path Ruta como `/admin/foo` o `/foo`.
 */
export function tenantBranchAdminPath(tenantSlug: string, branchSlug: string, path = ""): Route {
  const suffix = normalizedSuffix(path).replace(/^\/admin(?=\/|$)/, "");
  return `/t/${encodedSlug(tenantSlug)}/admin/s/${encodedSlug(branchSlug)}${suffix}` as Route;
}

/**
 * @summary Construye una ruta administrativa canónica (identidad por GUID) para un tenant.
 * @param path Ruta como `/admin/foo` o `/foo`.
 */
export function tenantAdminGuidPath(guid: string, tenantSlug: string, path = ""): Route {
  const suffix = normalizedSuffix(path).replace(/^\/admin(?=\/|$)/, "");
  return `/t/${guid.trim()}/${encodedSlug(tenantSlug)}/admin${suffix}` as Route;
}

/**
 * @summary Construye una ruta administrativa canónica (identidad por GUID) para una sucursal.
 * @param path Ruta como `/admin/foo` o `/foo`.
 */
export function tenantBranchAdminGuidPath(
  guid: string,
  tenantSlug: string,
  branchSlug: string,
  path = "",
): Route {
  const suffix = normalizedSuffix(path).replace(/^\/admin(?=\/|$)/, "");
  return `/t/${guid.trim()}/${encodedSlug(tenantSlug)}/admin/s/${encodedSlug(branchSlug)}${suffix}` as Route;
}

/**
 * @summary Ruta canónica del detalle de un cliente en Platform: `/platform/clientes/{guid}/{slug}`.
 */
export function platformClientPath(guid: string, tenantSlug: string, path = ""): Route {
  const suffix = normalizedSuffix(path).replace(/^\/clientes(?=\/|$)/, "");
  return `/platform/clientes/${guid.trim()}/${encodedSlug(tenantSlug)}${suffix}` as Route;
}

/**
 * @summary Ruta canónica del detalle de una sucursal de un cliente en Platform.
 */
export function platformBranchPath(guid: string, tenantSlug: string, branchSlug: string, path = ""): Route {
  const suffix = normalizedSuffix(path).replace(/^\/clientes(?=\/|$)/, "");
  return `/platform/clientes/${guid.trim()}/${encodedSlug(tenantSlug)}/sucursales/${encodedSlug(branchSlug)}${suffix}` as Route;
}

/**
 * @summary Convierte una ruta interna `/superadmin/...` en la ruta pública `/platform/...`.
 */
export function platformAdminPath(path = ""): Route {
  const suffix = normalizedSuffix(path).replace(/^\/superadmin(?=\/|$)/, "");
  return `/platform${suffix}` as Route;
}

/**
 * @summary Obtiene el primer segmento administrativo lógico (`pedidos`, `usuarios`, etc.).
 */
export function adminSectionFromLogicalPath(path: string) {
  const pathOnly = path.split(/[?#]/, 1)[0];
  const normalized = pathOnly.replace(/^\/admin\/?/, "");
  return normalized.split("/")[0] || "";
}

/**
 * @summary Indica si una ruta administrativa requiere contexto de sucursal.
 */
export function isBranchAdminLogicalPath(path: string) {
  const section = adminSectionFromLogicalPath(path);
  return section === "" || BRANCH_ADMIN_SECTIONS.has(section);
}

/**
 * @summary Clasifica una URL canónica y extrae su contexto sin depender del host, cookies ni estado React.
 */
export function parseCanonicalPath(pathname: string): CanonicalRouteContext {
  const path = pathname.split("?")[0] || "/";

  // Identidad por GUID: /t/{guid}/{slug}/admin/s/{branch}/... y /t/{guid}/{slug}/admin/...
  const branchAdminGuid = path.match(/^\/t\/([^/]+)\/([^/]+)\/admin\/s\/([^/]+)(\/.*)?$/);
  if (branchAdminGuid) {
    const rest = branchAdminGuid[4] || "";
    return {
      surface: "tenant-admin",
      tenantGuid: decodeURIComponent(branchAdminGuid[1]),
      tenantSlug: decodeURIComponent(branchAdminGuid[2]),
      branchSlug: decodeURIComponent(branchAdminGuid[3]),
      logicalPath: `/admin${rest}`,
    };
  }

  const tenantAdminGuid = path.match(/^\/t\/([^/]+)\/([^/]+)\/admin(\/.*)?$/);
  if (tenantAdminGuid) {
    const rest = tenantAdminGuid[3] || "";
    return {
      surface: "tenant-admin",
      tenantGuid: decodeURIComponent(tenantAdminGuid[1]),
      tenantSlug: decodeURIComponent(tenantAdminGuid[2]),
      logicalPath: `/admin${rest}`,
    };
  }

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

  // Detalle canónico de cliente en Platform: /platform/clientes/{guid}/{slug}/...
  const platformBranchDetail = path.match(
    /^\/platform\/clientes\/([^/]+)\/([^/]+)\/sucursales\/([^/]+)(\/.*)?$/,
  );
  if (platformBranchDetail) {
    const rest = platformBranchDetail[4] || "";
    return {
      surface: "platform-admin",
      tenantGuid: decodeURIComponent(platformBranchDetail[1]),
      tenantSlug: decodeURIComponent(platformBranchDetail[2]),
      branchSlug: decodeURIComponent(platformBranchDetail[3]),
      logicalPath: `/superadmin/clientes/${decodeURIComponent(platformBranchDetail[1])}/${decodeURIComponent(platformBranchDetail[2])}/sucursales/${decodeURIComponent(platformBranchDetail[3])}${rest}`,
    };
  }

  const platformClientDetail = path.match(/^\/platform\/clientes\/([^/]+)\/([^/]+)(?:\/(.*))?$/);
  if (platformClientDetail) {
    const rest = platformClientDetail[3] || "";
    return {
      surface: "platform-admin",
      tenantGuid: decodeURIComponent(platformClientDetail[1]),
      tenantSlug: decodeURIComponent(platformClientDetail[2]),
      logicalPath: `/superadmin/clientes/${decodeURIComponent(platformClientDetail[1])}/${decodeURIComponent(platformClientDetail[2])}${rest}`,
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

/**
 * @summary Construye un enlace administrativo y conserva la sucursal solo cuando corresponde.
 * @param tenantGuid Identidad pública inmutable; si se provee se usa la URL con GUID.
 */
export function adminHrefForContext(
  tenantSlug: string,
  logicalHref: string,
  branchSlug?: string,
  tenantGuid?: string,
): Route {
  const path = normalizedSuffix(logicalHref).replace(/^\/admin(?=\/|$)/, "");
  const withBranch = branchSlug && isBranchAdminLogicalPath(logicalHref);
  if (tenantGuid) {
    return (
      withBranch
        ? tenantBranchAdminGuidPath(tenantGuid, tenantSlug, branchSlug as string, path)
        : tenantAdminGuidPath(tenantGuid, tenantSlug, path)
    ) as Route;
  }
  return (
    withBranch ? tenantBranchAdminPath(tenantSlug, branchSlug as string, path) : tenantAdminPath(tenantSlug, path)
  ) as Route;
}

/**
 * @summary Convierte un enlace público heredado, como `/carta`, en una ruta canónica para el contexto resuelto.
 */
export function publicHrefForContext(tenantSlug: string, logicalHref: string, branchSlug?: string): Route {
  if (/^(?:https?:|mailto:|tel:|#)/i.test(logicalHref)) return logicalHref as Route;
  const match = logicalHref.match(/^([^?#]*)(\?[^#]*)?(#.*)?$/);
  const path = match?.[1] || "/";
  const suffix = `${match?.[2] || ""}${match?.[3] || ""}`;
  if ((path === "" || path === "/") && branchSlug)
    return `${tenantBranchPublicPath(tenantSlug, branchSlug)}${suffix}` as Route;
  if (branchSlug) {
    const section = path.replace(/^\//, "").split("/")[0];
    if (BRANCH_PUBLIC_SECTIONS.has(section)) {
      return `${tenantBranchPublicPath(tenantSlug, branchSlug, path)}${suffix}` as Route;
    }
  }
  return `${tenantPublicPath(tenantSlug, path)}${suffix}` as Route;
}

/**
 * @summary Construye un enlace público que respeta dominios personalizados y preserva el contexto visible.
 */
export function publicHrefForVisiblePath(
  visiblePathname: string,
  tenantSlug: string,
  logicalHref: string,
  branchSlug?: string,
): Route {
  if (/^(?:https?:|mailto:|tel:|#)/i.test(logicalHref)) return logicalHref as Route;
  const canonical = parseCanonicalPath(visiblePathname);
  if (canonical.surface === "tenant-public" && canonical.tenantSlug) {
    return publicHrefForContext(canonical.tenantSlug, logicalHref, canonical.branchSlug ?? branchSlug);
  }

  // Dominio personalizado o heredado: el host ya identifica al tenant, por eso no
  // agregamos `/t/{slug}`. Solo preservamos `/s/{branch}` cuando la vista lo requiere.
  const match = logicalHref.match(/^([^?#]*)(\?[^#]*)?(#.*)?$/);
  const path = match?.[1] || "/";
  const suffix = `${match?.[2] || ""}${match?.[3] || ""}`;
  if (!branchSlug) return `${path}${suffix}` as Route;
  if (path === "" || path === "/") return `/s/${encodedSlug(branchSlug)}${suffix}` as Route;
  const section = path.replace(/^\//, "").split("/")[0];
  return (
    BRANCH_PUBLIC_SECTIONS.has(section) ? `/s/${encodedSlug(branchSlug)}${path}${suffix}` : `${path}${suffix}`
  ) as Route;
}

/**
 * @summary Construye un enlace administrativo canónico a partir de la ruta visible actual.
 */
export function adminHrefFromPathname(pathname: string, logicalHref: string): Route {
  const context = parseCanonicalPath(pathname);
  if (context.surface !== "tenant-admin" || !context.tenantSlug) return logicalHref as Route;
  return adminHrefForContext(context.tenantSlug, logicalHref, context.branchSlug, context.tenantGuid);
}

/**
 * @summary Construye un enlace público canónico a partir de la ruta visible actual.
 */
export function publicHrefFromPathname(pathname: string, logicalHref: string): Route {
  const context = parseCanonicalPath(pathname);
  if (context.surface !== "tenant-public" || !context.tenantSlug) return logicalHref as Route;
  return publicHrefForContext(context.tenantSlug, logicalHref, context.branchSlug);
}

/**
 * @summary Construye una ruta de API heredada limitada al tenant y la sucursal de la URL visible.
 */
export function scopedApiPath(pathname: string, apiPath: string): Route {
  if (!apiPath.startsWith("/api/")) return apiPath as Route;
  if (apiPath.startsWith("/api/platform/") || apiPath.startsWith("/api/t/")) return apiPath as Route;
  const context = parseCanonicalPath(pathname);

  if (apiPath.startsWith("/api/superadmin/")) {
    return `/api/platform/${apiPath.slice("/api/superadmin/".length)}` as Route;
  }

  if (context.surface === "platform-admin" && apiPath.startsWith("/api/auth/")) {
    return `/api/platform/auth/${apiPath.slice("/api/auth/".length)}` as Route;
  }

  if (context.surface === "platform-admin" && apiPath.startsWith("/api/admin/leads/")) {
    return `/api/platform/leads/${apiPath.slice("/api/admin/leads/".length)}` as Route;
  }

  if (!context.tenantSlug) return apiPath as Route;
  const tenant = context.tenantGuid
    ? `${context.tenantGuid}/${encodedSlug(context.tenantSlug)}`
    : encodedSlug(context.tenantSlug);
  const branch = context.branchSlug ? `/s/${encodedSlug(context.branchSlug)}` : "";

  if (apiPath.startsWith("/api/admin/")) {
    return `/api/t/${tenant}/admin${branch}/${apiPath.slice("/api/admin/".length)}` as Route;
  }
  if (apiPath === "/api/admin") return `/api/t/${tenant}/admin${branch}` as Route;

  if (apiPath.startsWith("/api/auth/")) {
    return `/api/t/${tenant}/auth/${apiPath.slice("/api/auth/".length)}` as Route;
  }

  const publicRest = apiPath.slice("/api/".length);
  return `/api/t/${tenant}${branch}/${publicRest}` as Route;
}

/**
 * @summary Cambia la sucursal de una ruta administrativa sin perder su sección ni su contexto consolidado.
 */
export function switchAdminBranchPath(pathname: string, branchSlug?: string): Route {
  const context = parseCanonicalPath(pathname);
  if (context.surface !== "tenant-admin" || !context.tenantSlug) return pathname as Route;
  const logical = context.logicalPath;
  return adminHrefForContext(context.tenantSlug, logical, branchSlug, context.tenantGuid);
}
