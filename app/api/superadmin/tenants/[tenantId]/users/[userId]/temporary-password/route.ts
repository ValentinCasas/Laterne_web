import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { authorizeSuperAdmin } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

/** @summary Asigna una contraseña efímera solo en desarrollo, sin revelar ni recuperar el hash anterior. */
export async function POST(request: Request, context: { params: Promise<{ tenantId: string; userId: string }> }) {
  const superAdmin = await authorizeSuperAdmin();
  if (!superAdmin?.user.isSuperAdmin || process.env.NODE_ENV !== "development") return NextResponse.json({ error: "Esta acción solo está disponible para superadmin en desarrollo" }, { status: 403 });
  const params = await context.params;
  const tenantId = Number(params.tenantId); const userId = Number(params.userId);
  if (!Number.isInteger(tenantId) || !Number.isInteger(userId)) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  const membership = await prisma.tenantMembership.findFirst({ where: { tenantId, userId }, include: { user: { select: { id: true, name: true, email: true } } } });
  if (!membership) return NextResponse.json({ error: "Usuario no encontrado en este cliente" }, { status: 404 });
  const temporaryPassword = `MC-${randomBytes(6).toString("base64url")}`;
  await prisma.$transaction([prisma.user.update({ where: { id: userId }, data: { password: await bcrypt.hash(temporaryPassword, 12) } }), prisma.authSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } })]);
  await recordAudit({ context: { session: superAdmin.session, tenant: { id: tenantId } }, action: "temporary-password", entityType: "user", entityId: userId, newValues: { developmentOnly: true, sessionsRevoked: true }, request });
  return NextResponse.json({ temporaryPassword, user: membership.user });
}
