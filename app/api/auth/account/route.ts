import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const passwordInput = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(10).max(100).regex(/[a-z]/).regex(/[A-Z]/).regex(/\d/),
});

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
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || !(await bcrypt.compare(parsed.data.currentPassword, user.password)))
    return NextResponse.json({ error: "La contraseña actual no es correcta" }, { status: 400 });
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { password: await bcrypt.hash(parsed.data.newPassword, 12) },
    }),
    prisma.authSession.updateMany({
      where: { userId: user.id, id: { not: session.sessionId }, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
  return NextResponse.json({ ok: true });
}
