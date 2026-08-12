import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, authorize, createSession } from "@/lib/auth";

/** @summary Cambia la sucursal activa de la sesión actual (0 = vista consolidada). */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.context !== "tenant" || !session.membershipId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const branchId = Number(body?.branchId);
  if (!Number.isInteger(branchId) || branchId < 0) {
    return NextResponse.json({ error: "Sucursal inválida" }, { status: 400 });
  }

  const context = await authorize();
  if (!context) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  if (branchId === 0) {
    if (!context.allBranches) {
      return NextResponse.json({ error: "No tenés acceso consolidado a varias sucursales" }, { status: 403 });
    }
  } else {
    const branch = context.branches.find((item) => item.id === branchId && item.active);
    if (!branch) {
      return NextResponse.json({ error: "No tenés acceso a esta sucursal" }, { status: 403 });
    }
  }

  const token = await createSession({
    userId: session.userId,
    role: session.role,
    tenantId: session.tenantId,
    membershipId: session.membershipId,
    roleKey: session.roleKey,
    context: "tenant",
    branchId,
    branchSlug:
      branchId === 0 ? undefined : context.branches.find((item) => item.id === branchId)?.slug,
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.set("laterne_session", token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 8,
    path: "/",
  });

  if (session.sessionId) {
    await prisma.authSession.updateMany({
      where: { id: session.sessionId, userId: session.userId, revokedAt: null },
      data: { branchId },
    });
  }
  return response;
}