import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const credentials = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(190)
    .transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(200),
});
const invalidPasswordHash = "$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.";
const maximumFailedAttempts = 8;
const attemptWindowMilliseconds = 15 * 60 * 1000;

/** @summary Recupera la dirección de red más confiable disponible para limitar abusos. */
function requestAddress(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/** @summary Anonimiza un dato sensible antes de utilizarlo para controlar intentos. */
function privateHash(value: string) {
  return createHash("sha256")
    .update(`${process.env.AUTH_SECRET ?? "development-only-change-me"}:${value}`)
    .digest("hex");
}

/** @summary Registra el resultado del acceso y elimina intentos antiguos que ya no son útiles. */
async function recordAttempt(emailHash: string, ipHash: string, successful: boolean) {
  const expiration = new Date(Date.now() - 24 * 60 * 60 * 1000);

  if (successful) {
    await prisma.$transaction([
      prisma.loginAttempt.create({ data: { emailHash, ipHash, successful } }),
      prisma.loginAttempt.deleteMany({ where: { emailHash, successful: false } }),
      prisma.loginAttempt.deleteMany({ where: { createdAt: { lt: expiration } } }),
    ]);
    return;
  }

  await prisma.$transaction([
    prisma.loginAttempt.create({ data: { emailHash, ipHash, successful } }),
    prisma.loginAttempt.deleteMany({ where: { createdAt: { lt: expiration } } }),
  ]);
}

/** @summary Valida las credenciales y crea la cookie segura de sesión del usuario. */
export async function POST(request: Request) {
  const parsed = credentials.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const emailHash = privateHash(parsed.data.email);
  const ipHash = privateHash(requestAddress(request));
  const attemptWindow = new Date(Date.now() - attemptWindowMilliseconds);
  const failedAttempts = await prisma.loginAttempt.count({
    where: {
      successful: false,
      createdAt: { gte: attemptWindow },
      OR: [{ emailHash }, { ipHash }],
    },
  });

  if (failedAttempts >= maximumFailedAttempts) {
    return NextResponse.json(
      { error: "Demasiados intentos. Esperá unos minutos antes de volver a probar." },
      { status: 429, headers: { "Retry-After": "900" } },
    );
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    include: {
      memberships: {
        where: { status: "active", tenant: { status: "active" } },
        include: { role: true, tenant: true },
        orderBy: { id: "asc" },
        take: 1,
      },
    },
  });
  const passwordMatches = await bcrypt.compare(parsed.data.password, user?.password ?? invalidPasswordHash);

  if (!user || !passwordMatches) {
    await recordAttempt(emailHash, ipHash, false);
    return NextResponse.json({ error: "Email o contraseña incorrectos" }, { status: 401 });
  }

  await recordAttempt(emailHash, ipHash, true);
  const membership = user.memberships[0];
  if (!membership)
    return NextResponse.json({ error: "Tu usuario no tiene un negocio activo" }, { status: 403 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    "laterne_session",
    await createSession({
      userId: user.id,
      role: user.role,
      tenantId: membership.tenantId,
      membershipId: membership.id,
      roleKey: membership.role.key,
    }),
    {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 8,
      path: "/",
    },
  );
  return response;
}
