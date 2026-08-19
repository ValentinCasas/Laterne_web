import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

/**
 * @summary Establece o elimina el PIN de acceso rápido de un usuario.
 *
 * El PIN se almacena como hash bcrypt (6 dígitos). Nunca se guarda en texto
 * plano. El endpoint de login por PIN (futuro) validará con bcrypt.compare.
 *
 * PUT: actualizar PIN (body: { pin: "123456" })
 * DELETE: eliminar PIN
 */
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await authorize("user.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const userId = Number((await context.params).id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = z.object({ pin: z.string().regex(/^\d{6}$/, "El PIN debe ser exactamente 6 dígitos") }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "El PIN debe ser exactamente 6 dígitos numéricos" }, { status: 400 });
  }

  const membership = await prisma.tenantMembership.findFirst({
    where: { tenantId: auth.tenant.id, userId },
    include: { user: { select: { id: true, name: true } } },
  });
  if (!membership) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  // Hash bcrypt del PIN con salt factor 10 (más rápido que 12 porque es un PIN corto)
  const pinHash = await bcrypt.hash(parsed.data.pin, 10);

  await prisma.user.update({ where: { id: userId }, data: { pinHash } });

  await recordAudit({
    context: auth,
    action: "update",
    entityType: "usuarios",
    entityId: userId,
    newValues: toAuditValue({ pinChanged: true }),
    request,
  });

  return NextResponse.json({ ok: true, hasPin: true });
}

/**
 * @summary Elimina el PIN de acceso rápido de un usuario.
 */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await authorize("user.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const userId = Number((await context.params).id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const membership = await prisma.tenantMembership.findFirst({
    where: { tenantId: auth.tenant.id, userId },
  });
  if (!membership) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  await prisma.user.update({ where: { id: userId }, data: { pinHash: null } });

  await recordAudit({
    context: auth,
    action: "update",
    entityType: "usuarios",
    entityId: userId,
    newValues: toAuditValue({ pinRemoved: true }),
    request: _request,
  });

  return new NextResponse(null, { status: 204 });
}
