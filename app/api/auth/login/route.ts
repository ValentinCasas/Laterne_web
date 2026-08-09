import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const credentials = z.object({ email: z.string().email(), password: z.string().min(1) });

/** @summary Valida las credenciales y crea la cookie segura de sesión del usuario. */
export async function POST(request: Request) {
  const parsed = credentials.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const user = await prisma.user.findFirst({ where: { email: parsed.data.email } });
  if (!user || !(await bcrypt.compare(parsed.data.password, user.password)))
    return NextResponse.json({ error: "Email o contraseña incorrectos" }, { status: 401 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set("laterne_session", await createSession({ userId: user.id, role: user.role }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 8,
    path: "/",
  });
  return response;
}
