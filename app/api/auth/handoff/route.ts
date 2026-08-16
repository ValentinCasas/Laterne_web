import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createSession, sessionCookieAttributes, tenantSessionCookieName } from "@/lib/auth";
import { classifyHost } from "@/lib/domains";
import { effectiveHost } from "@/lib/trusted-headers";
import { tenantAdminGuidPath, tenantAdminPath, tenantBranchAdminGuidPath, tenantBranchAdminPath } from "@/lib/routes";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";

/** @summary Canjea una transferencia heredada y termina siempre en la ruta canónica del tenant y la sucursal. */
export async function POST(request: Request) {
  const host = effectiveHost(request.headers).split(",")[0].trim().split(":")[0].toLocaleLowerCase("es");
  const hostContext = classifyHost(host);
  const tenantSlug =
    request.headers.get("x-menuclick-tenant-slug")?.trim().toLocaleLowerCase("es") ||
    (hostContext.kind === "app" ? hostContext.slug : undefined);
  if (!tenantSlug) return NextResponse.json({ error: "Tenant administrativo inválido" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { token?: string } | null;
  if (!body?.token) return NextResponse.json({ error: "Transferencia inválida" }, { status: 400 });
  const tokenHash = createHash("sha256").update(body.token).digest("hex");
  const handoff = await prisma.authHandoff.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: { gt: new Date() },
      membership: { tenant: { slug: tenantSlug, status: "active" } },
    },
    include: { user: { select: { role: true } }, membership: { include: { role: true, tenant: true } } },
  });
  if (!handoff)
    return NextResponse.json(
      { error: "La transferencia expiró o no corresponde a este tenant" },
      { status: 401 },
    );

  const consumed = await prisma.authHandoff.updateMany({
    where: { id: handoff.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (consumed.count !== 1)
    return NextResponse.json({ error: "La transferencia ya fue utilizada" }, { status: 409 });

  let branchSlug: string | undefined;
  if (handoff.branchId && handoff.branchId > 0) {
    branchSlug = (
      await prisma.branch.findFirst({
        where: { id: handoff.branchId, tenantId: handoff.membership.tenantId, active: true },
        select: { slug: true },
      })
    )?.slug;
  }

  const token = await createSession({
    userId: handoff.userId,
    role: handoff.user.role,
    tenantId: handoff.membership.tenantId,
    membershipId: handoff.membership.id,
    roleKey: handoff.membership.role.key,
    context: "tenant",
  });

  // Auditoría de handoff
  await recordAudit({
    context: {
      session: {
        userId: handoff.userId,
        role: handoff.user.role,
        tenantId: handoff.membership.tenantId,
        membershipId: handoff.membership.id,
        roleKey: handoff.membership.role.key,
        sessionId: 0,
        context: "tenant",
      },
      tenant: { id: handoff.membership.tenantId },
    },
    action: "auth.handoff",
    entityType: "auth-handoff",
    entityId: handoff.id,
    newValues: {
      tenantId: handoff.membership.tenantId,
      userId: handoff.userId,
      branchId: handoff.branchId ?? null,
    },
    request,
  });

  const tenantGuid = handoff.membership.tenant.publicGuid;
  const redirectPath = branchSlug
    ? tenantGuid
      ? tenantBranchAdminGuidPath(tenantGuid, tenantSlug, branchSlug)
      : tenantBranchAdminPath(tenantSlug, branchSlug)
    : tenantGuid
      ? tenantAdminGuidPath(tenantGuid, tenantSlug)
      : tenantAdminPath(tenantSlug);
  const response = NextResponse.json({ ok: true, redirect: redirectPath });
  response.cookies.set(tenantSessionCookieName(tenantSlug), token, sessionCookieAttributes(60 * 60 * 8));
  return response;
}
