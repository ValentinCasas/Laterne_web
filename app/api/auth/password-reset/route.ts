import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requestOrigin } from "@/lib/domains";
import { passwordResetHash, passwordResetToken } from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";
import { getDefaultTenant } from "@/lib/tenant";

const requestInput = z.object({
  email: z.string().trim().email().max(255),
  website: z.string().max(0).optional(),
});
const resetInput = z.object({
  token: z.string().min(32).max(100),
  password: z.string().min(10).max(128).regex(/[a-z]/).regex(/[A-Z]/).regex(/\d/),
});

/** @summary Obtiene una referencia de red anonimizada para limitar solicitudes abusivas. */
function requestHash(request: Request) {
  const address =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  return passwordResetHash("ip", address);
}

/** @summary Entrega un enlace de recuperación mediante el webhook de email configurado en el servidor. */
async function deliverReset(email: string, resetUrl: string) {
  const endpoint = process.env.EMAIL_WEBHOOK_URL;
  const apiKey = process.env.EMAIL_API_KEY;
  if (!endpoint || !apiKey) return false;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      to: email,
      subject: "Restablecer acceso a MenuClick",
      text: `Usá este enlace durante los próximos 30 minutos: ${resetUrl}`,
    }),
  });
  return response.ok;
}

/** @summary Registra una solicitud sin revelar si el correo pertenece a un usuario del sistema. */
export async function POST(request: Request) {
  const parsed = requestInput.safeParse(await request.json().catch(() => null));
  const generic = { ok: true, message: "Si el correo existe, vas a recibir instrucciones para continuar." };
  if (!parsed.success || parsed.data.website) return NextResponse.json(generic);
  const tenant = await getDefaultTenant();
  const email = parsed.data.email.toLocaleLowerCase("es");
  const emailHash = passwordResetHash("email", email);
  const ipHash = requestHash(request);
  const recent = await prisma.passwordResetRequest.count({
    where: { emailHash, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (recent >= 3) return NextResponse.json(generic);
  const membership = await prisma.tenantMembership.findFirst({
    where: { tenantId: tenant.id, status: "active", user: { email } },
    include: { user: true },
  });
  if (!membership) {
    await prisma.passwordResetRequest.create({
      data: { tenantId: tenant.id, emailHash, requestedIp: ipHash, status: "unknown_user" },
    });
    return NextResponse.json(generic);
  }
  const token = passwordResetToken();
  const entry = await prisma.passwordResetRequest.create({
    data: {
      tenantId: tenant.id,
      userId: membership.userId,
      emailHash,
      tokenHash: passwordResetHash("token", token),
      requestedIp: ipHash,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    },
  });
  const origin = requestOrigin(request.headers) || new URL(request.url).origin;
  const delivered = await deliverReset(
    email,
    `${origin}/restablecer-acceso?token=${encodeURIComponent(token)}`,
  ).catch(() => false);
  await prisma.$transaction([
    prisma.passwordResetRequest.update({
      where: { id: entry.id },
      data: { status: delivered ? "delivered" : "pending_delivery" },
    }),
    prisma.notification.create({
      data: {
        tenantId: tenant.id,
        type: "security.password_reset",
        title: "Solicitud de recuperación",
        message: delivered
          ? "Se envió un enlace de recuperación."
          : "Falta configurar el proveedor de email para entregar el enlace.",
        link: "/admin/integraciones",
      },
    }),
  ]);
  return NextResponse.json(generic);
}

/** @summary Cambia la contraseña con un token vigente, lo invalida y revoca todas las sesiones anteriores. */
export async function PATCH(request: Request) {
  const parsed = resetInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "La clave debe tener 10 caracteres, mayúscula, minúscula y número" },
      { status: 400 },
    );
  const tokenHash = passwordResetHash("token", parsed.data.token);
  const entry = await prisma.passwordResetRequest.findFirst({
    where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() }, userId: { not: null } },
  });
  if (!entry?.userId)
    return NextResponse.json({ error: "El enlace venció o ya fue utilizado" }, { status: 410 });
  await prisma.$transaction([
    prisma.user.update({
      where: { id: entry.userId },
      data: { password: await bcrypt.hash(parsed.data.password, 12) },
    }),
    prisma.authSession.deleteMany({ where: { userId: entry.userId } }),
    prisma.passwordResetRequest.update({
      where: { id: entry.id },
      data: { usedAt: new Date(), status: "used" },
    }),
  ]);
  return NextResponse.json({ ok: true });
}
