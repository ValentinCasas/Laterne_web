import { NextResponse } from "next/server";
import { revokeCurrentSession } from "@/lib/auth";

/** @summary Cierra la sesión eliminando la cookie y redirige a la pantalla de acceso. */
export async function POST(request: Request) {
  await revokeCurrentSession();
  const response = NextResponse.redirect(new URL("/login", request.url), { status: 303 });
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
