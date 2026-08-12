import { NextResponse } from "next/server";
import { revokeCurrentSession } from "@/lib/auth";

/** @summary Recupera el host usado por el navegador para construir URLs del mismo origen. */
function requestHost(request: Request) {
  return (
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host")?.trim() ||
    ""
  );
}

/** @summary Marca la respuesta como sin caché y elimina la cookie de sesión del host. */
function clearSessionCookie(response: NextResponse<unknown>) {
  response.cookies.set("laterne_session", "", {
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

/** @summary Cierra la sesión, revocándola en servidor y borrando la cookie del host solicitado. */
export async function POST(request: Request) {
  await revokeCurrentSession().catch(() => {
    // Aunque falle la revocación, la cookie se limpia y el token deja de ser útil.
  });

  const acceptsJson = (request.headers.get("accept") ?? "").toLowerCase().includes("application/json");
  if (acceptsJson) {
    return clearSessionCookie(NextResponse.json({ ok: true }));
  }

  // Formularios tradicionales (sin JavaScript): redirigir al login del MISMO host
  // para no navegar a un origen distinto (request.url no respeta el Host externo).
  const host = requestHost(request);
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  const loginUrl = host ? `${protocol}://${host}/login` : "http://localhost:3000/login";
  return clearSessionCookie(NextResponse.redirect(loginUrl, { status: 303 }));
}