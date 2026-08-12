import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { classifyHost } from "@/lib/domains";
import { createSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** @summary Canjea una transferencia de login de un host general al host administrativo del tenant. */
export async function POST(request: Request) {
  const host = (request.headers.get("x-forwarded-host") || request.headers.get("host") || "").split(",")[0].trim().split(":")[0].toLocaleLowerCase("es");
  const hostContext = classifyHost(host);
  if (hostContext.kind !== "app" || !hostContext.slug) return NextResponse.json({ error: "Host administrativo inválido" }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { token?: string } | null;
  if (!body?.token) return NextResponse.json({ error: "Transferencia inválida" }, { status: 400 });
  const tokenHash = createHash("sha256").update(body.token).digest("hex");
  const handoff = await prisma.authHandoff.findFirst({ where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() }, membership: { tenant: { slug: hostContext.slug, status: "active" } } }, include: { user: { select: { role: true } }, membership: { include: { role: true } } } });
  if (!handoff) return NextResponse.json({ error: "La transferencia expiró o no corresponde a este tenant" }, { status: 401 });
  const consumed = await prisma.authHandoff.updateMany({ where: { id: handoff.id, usedAt: null }, data: { usedAt: new Date() } });
  if (consumed.count !== 1) return NextResponse.json({ error: "La transferencia ya fue utilizada" }, { status: 409 });
  let branchSlug: string | undefined;
  if (handoff.branchId && handoff.branchId > 0) {
    branchSlug = (
      await prisma.branch.findUnique({ where: { id: handoff.branchId }, select: { slug: true } })
    )?.slug ?? undefined;
  }
  const token = await createSession({ userId: handoff.userId, role: handoff.user.role, tenantId: handoff.membership.tenantId, membershipId: handoff.membership.id, roleKey: handoff.membership.role.key, branchId: handoff.branchId ?? undefined, branchSlug, context: "tenant" });
  const redirectPath = branchSlug ? `/admin/s/${encodeURIComponent(branchSlug)}` : "/admin";
  const response = NextResponse.json({ ok: true, redirect: redirectPath });
  response.cookies.set("laterne_session", token, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 8, path: "/" });
  return response;
}
