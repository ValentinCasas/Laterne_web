import { NextResponse } from "next/server";
import {
  PLATFORM_SESSION_COOKIE,
  revokeCurrentSession,
  tenantSessionCookieName,
} from "@/lib/auth";
import { tenantPublicPath } from "@/lib/routes";

/** @summary Cookie de sesión correspondiente a la ruta canónica que solicitó el logout. */
function sessionCookieName(request: Request) {
  const routeKind = request.headers.get("x-menuclick-route-kind") ?? "";
  const tenantSlug = request.headers.get("x-menuclick-tenant-slug")?.trim().toLocaleLowerCase("es");
  if (routeKind.startsWith("platform")) return PLATFORM_SESSION_COOKIE;
  if (tenantSlug) return tenantSessionCookieName(tenantSlug);
  return "laterne_session";
}

/** @summary Marca la respuesta como sin caché y elimina únicamente la cookie de la sesión actual. */
function clearSessionCookie(request: Request, response: NextResponse<unknown>) {
  response.cookies.set(sessionCookieName(request), "", {
    expires: new Date(0),
    maxAge: 0,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return response;
}

/** @summary Cierra una sesión sin afectar sesiones abiertas de otros tenants. */
export async function POST(request: Request) {
  await revokeCurrentSession().catch(() => {
    // La cookie igualmente se elimina aunque la revocación en DB falle.
  });

  const acceptsJson = (request.headers.get("accept") ?? "").toLowerCase().includes("application/json");
  if (acceptsJson) return clearSessionCookie(request, NextResponse.json({ ok: true }));

  const routeKind = request.headers.get("x-menuclick-route-kind") ?? "";
  const tenantSlug = request.headers.get("x-menuclick-tenant-slug")?.trim().toLocaleLowerCase("es");
  const loginPath = routeKind.startsWith("platform")
    ? "/platform/login"
    : tenantSlug
      ? tenantPublicPath(tenantSlug, "/login")
      : "/login";
  return clearSessionCookie(request, NextResponse.redirect(new URL(loginPath, request.url), { status: 303 }));
}
