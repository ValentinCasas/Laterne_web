import { NextResponse } from "next/server";

/** @summary Cierra la sesión eliminando la cookie y redirige a la pantalla de acceso. */
export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.set("laterne_session", "", { expires: new Date(0), path: "/" });
  return response;
}
