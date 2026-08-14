import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveHostKind } from "@/lib/host-gate";
import {
  adminRootUrl,
  classifyHost,
  isLocalDevelopmentHost,
  normalizeHost,
  publicRootUrl,
} from "@/lib/domains";
import {
  isBranchAdminLogicalPath,
  parseCanonicalPath,
  platformAdminPath,
  tenantAdminPath,
  tenantBranchAdminPath,
  tenantBranchPublicPath,
  tenantPublicPath,
} from "@/lib/routes";

const TENANT_AUTH_PATHS = new Set(["/login", "/recuperar-acceso", "/restablecer-acceso"]);
const PLATFORM_MARKETING_PREFIXES = [
  "/planes",
  "/para-negocios",
  "/solicitar-demo",
  "/legal",
  "/cliente",
  "/clientes",
  "/funcionalidades",
  "/multi-sucursal",
];
const LEGACY_TENANT_PUBLIC_PREFIXES = [
  "/carta",
  "/reservas",
  "/pedido",
  "/productos",
  "/promociones",
  "/fidelidad",
  "/mesa",
  "/ayuda",
  "/sin-conexion",
  "/s",
];

function startsWithAny(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function requestHost(request: NextRequest) {
  return normalizeHost(request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.hostname);
}

function baseHost(url: string) {
  return normalizeHost(new URL(url).hostname);
}

function contextHeaders(
  request: NextRequest,
  values: {
    routeKind: string;
    tenantSlug?: string;
    branchSlug?: string;
    adminScope?: "tenant" | "branch" | "consolidated";
  },
) {
  const headers = new Headers(request.headers);
  headers.set("x-menuclick-original-path", request.nextUrl.pathname + request.nextUrl.search);
  headers.set("x-menuclick-route-kind", values.routeKind);
  if (values.tenantSlug) headers.set("x-menuclick-tenant-slug", values.tenantSlug.trim().toLocaleLowerCase("es"));
  else headers.delete("x-menuclick-tenant-slug");
  if (values.branchSlug) headers.set("x-menuclick-branch-slug", values.branchSlug.trim().toLocaleLowerCase("es"));
  else headers.delete("x-menuclick-branch-slug");
  if (values.adminScope) headers.set("x-menuclick-admin-scope", values.adminScope);
  else headers.delete("x-menuclick-admin-scope");
  return headers;
}

function rewrite(
  request: NextRequest,
  pathname: string,
  values: Parameters<typeof contextHeaders>[1],
) {
  const target = request.nextUrl.clone();
  target.pathname = pathname;
  return NextResponse.rewrite(target, { request: { headers: contextHeaders(request, values) } });
}

function redirectTo(request: NextRequest, absoluteBase: string, pathname: string) {
  const target = new URL(pathname, `${absoluteBase.replace(/\/$/, "")}/`);
  target.search = request.nextUrl.search;
  return NextResponse.redirect(target);
}

function apiRewrite(request: NextRequest): NextResponse | null {
  const pathname = request.nextUrl.pathname;

  let match = pathname.match(/^\/api\/platform\/auth\/(.+)$/);
  if (match) return rewrite(request, `/api/auth/${match[1]}`, { routeKind: "platform-admin" });

  match = pathname.match(/^\/api\/platform\/(.+)$/);
  if (match) return rewrite(request, `/api/superadmin/${match[1]}`, { routeKind: "platform-admin" });

  match = pathname.match(/^\/api\/t\/([^/]+)\/admin\/s\/([^/]+)(?:\/(.*))?$/);
  if (match) {
    return rewrite(request, `/api/admin${match[3] ? `/${match[3]}` : ""}`, {
      routeKind: "tenant-admin",
      tenantSlug: decodeURIComponent(match[1]),
      branchSlug: decodeURIComponent(match[2]),
      adminScope: "branch",
    });
  }

  match = pathname.match(/^\/api\/t\/([^/]+)\/admin(?:\/(.*))?$/);
  if (match) {
    return rewrite(request, `/api/admin${match[2] ? `/${match[2]}` : ""}`, {
      routeKind: "tenant-admin",
      tenantSlug: decodeURIComponent(match[1]),
      adminScope: "consolidated",
    });
  }

  match = pathname.match(/^\/api\/t\/([^/]+)\/auth\/(.+)$/);
  if (match) {
    return rewrite(request, `/api/auth/${match[2]}`, {
      routeKind: "tenant-auth",
      tenantSlug: decodeURIComponent(match[1]),
    });
  }

  match = pathname.match(/^\/api\/t\/([^/]+)\/s\/([^/]+)(?:\/(.*))?$/);
  if (match) {
    return rewrite(request, `/api${match[3] ? `/${match[3]}` : ""}`, {
      routeKind: "tenant-public",
      tenantSlug: decodeURIComponent(match[1]),
      branchSlug: decodeURIComponent(match[2]),
    });
  }

  match = pathname.match(/^\/api\/t\/([^/]+)(?:\/(.*))?$/);
  if (match) {
    return rewrite(request, `/api${match[2] ? `/${match[2]}` : ""}`, {
      routeKind: "tenant-public",
      tenantSlug: decodeURIComponent(match[1]),
    });
  }

  return null;
}

/**
 * Gateway único de routing.
 *
 * Identidad canónica:
 * - público tenant: /t/{tenant}/...
 * - admin tenant: /t/{tenant}/admin/...
 * - admin branch: /t/{tenant}/admin/s/{branch}/...
 * - platform: /platform/...
 *
 * Los rewrites internos mantienen las páginas legacy mientras el navegador ve
 * siempre rutas legibles. Tenant y branch se extraen exclusivamente de la URL.
 */
export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const host = requestHost(request);

  if (pathname.startsWith("/api/")) {
    const canonicalApi = apiRewrite(request);
    if (canonicalApi) return canonicalApi;
    return NextResponse.next();
  }

  // Auth de plataforma usa una URL explícita, pero reutiliza la pantalla interna existente.
  if (pathname === "/platform/login" || pathname === "/platform/recuperar-acceso" || pathname === "/platform/restablecer-acceso") {
    if (host !== baseHost(adminRootUrl())) return redirectTo(request, adminRootUrl(), pathname);
    return rewrite(request, pathname.replace(/^\/platform/, ""), { routeKind: "platform-admin" });
  }

  const canonical = parseCanonicalPath(pathname);

  if (canonical.surface === "platform-admin") {
    if (host !== baseHost(adminRootUrl())) return redirectTo(request, adminRootUrl(), pathname);
    return rewrite(request, canonical.logicalPath, { routeKind: "platform-admin" });
  }

  if (canonical.surface === "tenant-admin" && canonical.tenantSlug) {
    if (host !== baseHost(adminRootUrl())) return redirectTo(request, adminRootUrl(), pathname);
    // Las secciones tenant-level (usuarios, marca, negocio, etc.) no aceptan un
    // branch decorativo en la URL: se normalizan a una única ruta canónica.
    if (canonical.branchSlug && !isBranchAdminLogicalPath(canonical.logicalPath)) {
      return redirectTo(request, adminRootUrl(), tenantAdminPath(canonical.tenantSlug, canonical.logicalPath));
    }
    return rewrite(request, canonical.logicalPath, {
      routeKind: "tenant-admin",
      tenantSlug: canonical.tenantSlug,
      branchSlug: canonical.branchSlug,
      adminScope: canonical.branchSlug ? "branch" : "consolidated",
    });
  }

  if (canonical.surface === "tenant-public" && canonical.tenantSlug) {
    if (TENANT_AUTH_PATHS.has(canonical.logicalPath)) {
      if (host !== baseHost(adminRootUrl())) return redirectTo(request, adminRootUrl(), pathname);
      return rewrite(request, canonical.logicalPath, {
        routeKind: "tenant-auth",
        tenantSlug: canonical.tenantSlug,
      });
    }

    // En producción la superficie pública vive en el host público fijo. Esto
    // evita que una URL de carta/landing se quede accidentalmente en app.*.
    if (host === baseHost(adminRootUrl()) && host !== baseHost(publicRootUrl())) {
      return redirectTo(request, publicRootUrl(), pathname);
    }

    // El árbol físico existente solo tiene páginas branch dedicadas para la
    // landing/carta/reservas. El resto reutiliza la página tenant-level y recibe
    // la sucursal por header. La URL visible sigue siendo siempre explícita.
    let internalPath = canonical.logicalPath;
    if (canonical.branchSlug) {
      const branchPrefix = `/s/${encodeURIComponent(canonical.branchSlug)}`;
      const rest = canonical.logicalPath.startsWith(branchPrefix)
        ? canonical.logicalPath.slice(branchPrefix.length) || "/"
        : canonical.logicalPath;
      const dedicatedBranchPage = rest === "/" || rest === "/carta" || rest.startsWith("/carta/") || rest === "/reservas" || rest.startsWith("/reservas/");
      internalPath = dedicatedBranchPage
        ? `${branchPrefix}${rest === "/" ? "" : rest}`
        : rest;
    }

    return rewrite(request, internalPath, {
      routeKind: "tenant-public",
      tenantSlug: canonical.tenantSlug,
      branchSlug: canonical.branchSlug,
    });
  }

  // Alias explícitos antiguos de Platform.
  if (pathname === "/superadmin" || pathname.startsWith("/superadmin/")) {
    return redirectTo(request, adminRootUrl(), platformAdminPath(pathname));
  }

  // Alias /cliente/{slug} -> /t/{slug}.
  const tenantShortcut = pathname.match(/^\/cliente\/([^/]+)$/);
  if (tenantShortcut) {
    return redirectTo(request, publicRootUrl(), tenantPublicPath(decodeURIComponent(tenantShortcut[1])));
  }

  const classified = classifyHost(host);
  const resolvedHost = await resolveHostKind(host);

  // Subdominios administrativos legacy: tenant.app.dominio -> app.dominio/t/tenant/admin/...
  if (classified.kind === "app" && classified.slug) {
    const branchLegacy = pathname.match(/^\/admin\/s\/([^/]+)(\/.*)?$/);
    if (branchLegacy) {
      return redirectTo(
        request,
        adminRootUrl(),
        tenantBranchAdminPath(classified.slug, decodeURIComponent(branchLegacy[1]), `/admin${branchLegacy[2] || ""}`),
      );
    }
    if (pathname === "/login" || pathname === "/recuperar-acceso" || pathname === "/restablecer-acceso") {
      return redirectTo(request, adminRootUrl(), tenantPublicPath(classified.slug, pathname));
    }
    if (pathname === "/admin" || pathname.startsWith("/admin/")) {
      return redirectTo(request, adminRootUrl(), tenantAdminPath(classified.slug, pathname));
    }
  }

  // Subdominio público legacy -> path canónico. Los dominios personalizados se conservan.
  if (classified.kind === "tenant" && classified.slug && !isLocalDevelopmentHost(host)) {
    const branchLegacy = pathname.match(/^\/s\/([^/]+)(\/.*)?$/);
    const canonicalPath = branchLegacy
      ? tenantBranchPublicPath(classified.slug, decodeURIComponent(branchLegacy[1]), branchLegacy[2] || "")
      : tenantPublicPath(classified.slug, pathname === "/" ? "" : pathname);
    return redirectTo(request, publicRootUrl(), canonicalPath);
  }

  if (classified.kind === "unknown" && resolvedHost.kind === "tenant" && resolvedHost.slug) {
    // Los dominios personalizados son exclusivamente públicos. Cualquier acceso
    // administrativo se normaliza al host fijo app.* con tenant explícito.
    if (pathname === "/login" || pathname === "/recuperar-acceso" || pathname === "/restablecer-acceso") {
      return redirectTo(request, adminRootUrl(), tenantPublicPath(resolvedHost.slug, pathname));
    }
    const customAdminBranch = pathname.match(/^\/admin\/s\/([^/]+)(\/.*)?$/);
    if (customAdminBranch) {
      return redirectTo(
        request,
        adminRootUrl(),
        tenantBranchAdminPath(resolvedHost.slug, decodeURIComponent(customAdminBranch[1]), `/admin${customAdminBranch[2] || ""}`),
      );
    }
    if (pathname === "/admin" || pathname.startsWith("/admin/")) {
      return redirectTo(request, adminRootUrl(), tenantAdminPath(resolvedHost.slug, pathname));
    }

    // Dominio personalizado: la URL del cliente se mantiene. Si la URL incluye una
    // sucursal, usamos la misma regla canónica: landing/carta/reservas tienen página
    // branch propia y el resto reutiliza la página tenant-level con branch explícita.
    const branchMatch = pathname.match(/^\/s\/([^/]+)(\/.*)?$/);
    const branchSlug = branchMatch ? decodeURIComponent(branchMatch[1]) : undefined;
    if (branchSlug) {
      const rest = branchMatch?.[2] || "/";
      const dedicatedBranchPage =
        rest === "/" ||
        rest === "/carta" ||
        rest.startsWith("/carta/") ||
        rest === "/reservas" ||
        rest.startsWith("/reservas/");
      if (!dedicatedBranchPage) {
        return rewrite(request, rest, {
          routeKind: "tenant-public",
          tenantSlug: resolvedHost.slug,
          branchSlug,
        });
      }
    }
    return NextResponse.next({
      request: {
        headers: contextHeaders(request, {
          routeKind: "tenant-public",
          tenantSlug: resolvedHost.slug,
          branchSlug,
        }),
      },
    });
  }

  // Desarrollo: las rutas legacy públicas se redirigen al tenant configurado solo para facilitar transición.
  if (
    process.env.NODE_ENV === "development" &&
    isLocalDevelopmentHost(host) &&
    process.env.DEV_TENANT_SLUG &&
    startsWithAny(pathname, LEGACY_TENANT_PUBLIC_PREFIXES)
  ) {
    const slug = process.env.DEV_TENANT_SLUG.trim().toLocaleLowerCase("es");
    const branchLegacy = pathname.match(/^\/s\/([^/]+)(\/.*)?$/);
    const canonicalPath = branchLegacy
      ? tenantBranchPublicPath(slug, decodeURIComponent(branchLegacy[1]), branchLegacy[2] || "")
      : tenantPublicPath(slug, pathname);
    return redirectTo(request, publicRootUrl(), canonicalPath);
  }

  // Legacy /admin sobre host fijo/local: auth hará el redirect canónico una vez resuelta la membresía.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return NextResponse.next({
      request: { headers: contextHeaders(request, { routeKind: "tenant-admin" }) },
    });
  }

  // Marketing MenuClick: en producción vive únicamente en el host público fijo.
  // /login y recuperación quedan disponibles en el host actual como alias
  // transicional; los accesos canónicos autenticados son /platform/login y
  // /t/:tenant/login.
  const isPlatformMarketing = pathname === "/" || startsWithAny(pathname, PLATFORM_MARKETING_PREFIXES);
  if (isPlatformMarketing && host === baseHost(adminRootUrl()) && host !== baseHost(publicRootUrl())) {
    return redirectTo(request, publicRootUrl(), pathname);
  }

  // El acceso canónico de la plataforma es /platform/login. /login queda solo como
  // alias transicional y siempre se normaliza para que el contexto del acceso no
  // dependa del host ni de la membresía del usuario.
  if (pathname === "/login" || pathname === "/recuperar-acceso" || pathname === "/restablecer-acceso") {
    return redirectTo(request, adminRootUrl(), platformAdminPath(pathname));
  }

  if (isPlatformMarketing) {
    return NextResponse.next({
      request: { headers: contextHeaders(request, { routeKind: "platform-public" }) },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt|sitemap.xml|\\.well-known|/images/|/icons/|/models/|/favicon|.*\\.(?:avif|css|gif|ico|jpe?g|js|json|map|pdf|png|svg|txt|webp|woff2?|mp4|webm|usdz|glb|gltf)(?:\\?.*)?$).*)",
  ],
};
