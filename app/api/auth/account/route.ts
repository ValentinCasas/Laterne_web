import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { passwordResetHash } from "@/lib/password-reset";

/**
 * @summary Valida la entrada relacionada con la autenticación.
 */
const passwordInput = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(10).max(100).regex(/[a-z]/).regex(/[A-Z]/).regex(/\d/),
});

/**
 * @summary Obtiene una representación estable de la dirección de origen de la solicitud.
 */
function requestAddress(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/** @summary Cambia la contraseña tras validar la actual y revoca todas las demás sesiones. */
export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = passwordInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "La nueva contraseña debe tener 10 caracteres, mayúscula, minúscula y número" },
      { status: 400 },
    );

  // Rate limiting por IP para cambios de contraseña fallidos (5 intentos / 15 min)
  const ipAddress = requestAddress(request);
  const ipHash = passwordResetHash("ip", ipAddress);
  const attemptWindow = new Date(Date.now() - 15 * 60 * 1000);
  const failedByIp = await prisma.passwordResetRequest.count({
    where: { requestedIp: ipHash, status: "failed", createdAt: { gte: attemptWindow } },
  });
  if (failedByIp >= 5) {
    return NextResponse.json(
      { error: "Demasiados intentos fallidos. Esperá unos minutos." },
      { status: 429, headers: { "Retry-After": "900" } },
    );
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || !(await bcrypt.compare(parsed.data.currentPassword, user.password))) {
    const emailHash = passwordResetHash("email", user?.email ?? "unknown");
    await prisma.passwordResetRequest.create({
      data: { userId: user?.id ?? null, emailHash, requestedIp: ipHash, status: "failed" },
    });
    return NextResponse.json({ error: "La contraseña actual no es correcta" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { password: await bcrypt.hash(parsed.data.newPassword, 12) },
    }),
    prisma.authSession.updateMany({
      where: { userId: user.id, id: { not: session.sessionId }, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.passwordResetRequest.create({
      data: {
        userId: user.id,
        emailHash: passwordResetHash("email", user.email),
        requestedIp: ipHash,
        status: "success",
      },
    }),
  ]);
  return NextResponse.json({ ok: true });
}
