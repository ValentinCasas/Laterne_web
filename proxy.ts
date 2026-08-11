import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveHostKind } from "@/lib/host-gate";

/** @summary Rutas exclusivas de la experiencia de plataforma (Panel MenuClick). */
const PLATFORM_PREFIXES = ["/superadmin", "/planes", "/para-negocios", "/solicitar-demo", "/legal"];
const PLATFORM_PATHS = new Set(["/login", "/recuperar-acceso", "/restablecer-acceso", "/403", "/404"]);

/** @summary Rutas exclusivas de la experiencia de administración de los negocios. */
const APP_PREFIXES = ["/admin"];
const APP_PATHS = new Set(["/login", "/recuperar-acceso", "/restablecer-acceso", "/403", "/404"]);

/** @summary Rutas de la plataforma que no deben servirse dentro del sitio público de un negocio. */
const TENANT_BLOCKED_PREFIXES = ["/admin", "/superadmin", "/planes", "/para-negocios"];

function startsWithAny(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** @summary Indica si la ruta pertenece a la experiencia de plataforma. */
function isPlatformRoute(pathname: string) {
  return PLATFORM_PATHS.has(pathname) || startsWithAny(pathname, PLATFORM_PREFIXES);
}

/** @summary Indica si la ruta pertenece a la experiencia de administración. */
function isAppRoute(pathname: string) {
  return APP_PATHS.has(pathname) || startsWithAny(pathname, APP_PREFIXES);
}

/** @summary Separa las tres experiencias del producto según el host y protege los hosts desconocidos. */
export async function proxy(request: NextRequest) {
  const rawHost = request.headers.get("x-forwarded-host") ?? request.nextUrl.hostname;
  const host = rawHost.split(",")[0]?.trim()?.split(":")[0]?.toLocaleLowerCase("es") ?? "";
  const { kind } = await resolveHostKind(host);
  const pathname = request.nextUrl.pathname;

  if (kind === "platform") {
    if (pathname === "/") return NextResponse.rewrite(new URL("/login", request.url));
    if (!isPlatformRoute(pathname)) return NextResponse.rewrite(new URL("/404", request.url));
    return NextResponse.next();
  }

  if (kind === "app") {
    if (pathname === "/") return NextResponse.rewrite(new URL("/admin", request.url));
    if (!isAppRoute(pathname)) return NextResponse.rewrite(new URL("/404", request.url));
    return NextResponse.next();
  }

  if (kind === "tenant") {
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
