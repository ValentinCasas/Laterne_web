import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const revokeInput = z.object({ id: z.coerce.number().int().positive() });

/** @summary Lista únicamente las sesiones vigentes pertenecientes al usuario autenticado. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const sessions = await prisma.authSession.findMany({
    where: { userId: session.userId, revokedAt: null, expiresAt: { gt: new Date() } },
    select: {
      id: true,
      createdAt: true,
      expiresAt: true,
      membership: { select: { tenant: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ sessions: serialize(sessions), currentId: session.sessionId });
}

/** @summary Revoca una sesión elegida siempre que pertenezca al mismo usuario. */
export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = revokeInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  await prisma.authSession.updateMany({
    where: { id: parsed.data.id, userId: session.userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
