import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveHostKind } from "@/lib/host-gate";
import { adminLoginUrl, isLocalDevelopmentHost } from "@/lib/domains";

/** @summary Rutas exclusivas de la experiencia de plataforma (Panel MenuClick). */
const PLATFORM_PREFIXES = ["/superadmin", "/planes", "/para-negocios", "/solicitar-demo", "/legal", "/cliente", "/clientes", "/funcionalidades", "/multi-sucursal"];
const PLATFORM_PATHS = new Set(["/login", "/recuperar-acceso", "/restablecer-acceso", "/403", "/404"]);

/** @summary Rutas exclusivas de la experiencia de administración de los negocios. */
const APP_PREFIXES = ["/admin"];
const APP_PATHS = new Set(["/login", "/recuperar-acceso", "/restablecer-acceso", "/403", "/404"]);

/** @summary Rutas de la plataforma que no deben servirse dentro del sitio público de un negocio. */
const TENANT_BLOCKED_PREFIXES = ["/admin", "/superadmin", "/planes", "/para-negocios", "/clientes", "/solicitar-demo", "/funcionalidades", "/multi-sucursal"];

function startsWithAny(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** @summary Indica si la ruta pertenece a la experiencia de plataforma. */
function isPlatformRoute(pathname: string) {
  return pathname === "/" || PLATFORM_PATHS.has(pathname) || startsWithAny(pathname, PLATFORM_PREFIXES);
}

/** @summary Indica si la ruta pertenece a la experiencia de administración. */
function isAppRoute(pathname: string) {
  return APP_PATHS.has(pathname) || startsWithAny(pathname, APP_PREFIXES);
}

/** @summary Separa las tres experiencias del producto según el host y protege los hosts desconocidos. */
export async function proxy(request: NextRequest) {
  const rawHost = request.headers.get("x-forwarded-host") ?? request.nextUrl.hostname;
  const host = rawHost.split(",")[0]?.trim()?.split(":")[0]?.toLocaleLowerCase("es") ?? "";
  const hostContext = await resolveHostKind(host);
  const { kind } = hostContext;
  const pathname = request.nextUrl.pathname;

  if (kind === "platform") {
    if (!isPlatformRoute(pathname)) return NextResponse.rewrite(new URL("/404", request.url));
    return NextResponse.next();
  }

  if (kind === "app") {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-menuclick-original-path", pathname + request.nextUrl.search);
    if (pathname === "/") {
      return NextResponse.rewrite(new URL("/admin", request.url), { request: { headers: requestHeaders } });
    }
    const branchRoute = pathname.match(/^\/admin\/s\/([^/]+)(?:\/(.*))?$/);
    if (branchRoute) {
      const branchSlug = branchRoute[1];
      const remainder = branchRoute[2] ? `/${branchRoute[2]}` : "";
      const target = new URL(`/admin${remainder}`, request.url);
      requestHeaders.set("x-menuclick-branch-slug", branchSlug);
      return NextResponse.rewrite(target, { request: { headers: requestHeaders } });
    }
    if (!isAppRoute(pathname)) return NextResponse.rewrite(new URL("/404", request.url));
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (kind === "tenant") {
    if (startsWithAny(pathname, ["/admin"]) && hostContext.slug) {
      return NextResponse.redirect(adminLoginUrl(undefined, hostContext.slug));
    }
    // Local development keeps the public commercial routes reachable while the
    // configured DEV_TENANT_SLUG serves the tenant experience on localhost.
    if (isLocalDevelopmentHost(host) && startsWithAny(pathname, ["/planes", "/para-negocios", "/solicitar-demo", "/legal", "/clientes", "/funcionalidades", "/multi-sucursal"])) {
      return NextResponse.next();
    }
    if (startsWithAny(pathname, TENANT_BLOCKED_PREFIXES))
      return NextResponse.rewrite(new URL("/404", request.url));
    return NextResponse.next();
  }

  return NextResponse.rewrite(new URL("/404", request.url));
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt|sitemap.xml|\\.well-known|.*\\.(?:avif|css|gif|ico|jpe?g|js|json|png|svg|txt|webp|woff2?)$).*)",
  ],
};
