import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession } from "@/lib/auth";
import { classifyHost, tenantAdminUrl } from "@/lib/domains";
import { prisma } from "@/lib/prisma";

const credentials = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(190)
    .transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(200),
  tenantId: z.coerce.number().int().positive().optional(),
  tenantSlug: z.string().trim().min(1).max(120).optional(),
  branchId: z.coerce.number().int().nonnegative().optional(),
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

  if (process.env.NODE_ENV !== "development" && failedAttempts >= maximumFailedAttempts) {
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
        include: {
          role: true,
          tenant: true,
          branchAccess: { include: { branch: true }, orderBy: { branchId: "asc" } },
        },
        orderBy: { id: "asc" },
      },
    },
  });
  const passwordMatches = await bcrypt.compare(parsed.data.password, user?.password ?? invalidPasswordHash);

  if (!user || !passwordMatches) {
    await recordAttempt(emailHash, ipHash, false);
    return NextResponse.json({ error: "Email o contraseña incorrectos" }, { status: 401 });
  }

  await recordAttempt(emailHash, ipHash, true);
  const isPlatformStaff = Boolean(
    user.isSuperAdmin ||
    (user.platformRole && ["superadmin", "admin", "support", "sales"].includes(user.platformRole)),
  );
  const host = (request.headers.get("x-forwarded-host") || request.headers.get("host") || "")
    .split(",")[0]
    .trim()
    .split(":")[0];
  const hostContext = classifyHost(host);
  const platformContext = hostContext.kind === "platform";
  let membership = platformContext ? undefined : user.memberships[0];
  const requestedTenantSlug = hostContext.kind === "app" && hostContext.slug ? hostContext.slug : parsed.data.tenantSlug;
  if (!platformContext && (parsed.data.tenantId || requestedTenantSlug)) {
    membership = parsed.data.tenantId
      ? user.memberships.find((item) => item.tenantId === parsed.data.tenantId && (!requestedTenantSlug || item.tenant.slug === requestedTenantSlug))
      : user.memberships.find((item) => item.tenant.slug === requestedTenantSlug);
    if (!membership)
      return NextResponse.json({ error: "El negocio seleccionado no está disponible" }, { status: 403 });
  }
  if (!platformContext && user.memberships.length > 1 && !parsed.data.tenantId && !requestedTenantSlug) {
    return NextResponse.json(
      {
        error: "Seleccioná el negocio al que querés ingresar",
        requiresTenantSelection: true,
        tenants: user.memberships.map((item) => ({
          id: item.tenantId,
          name: item.tenant.name,
          slug: item.tenant.slug,
        })),
      },
      { status: 409 },
    );
  }
  if ((platformContext && !isPlatformStaff) || (!platformContext && !membership))
    return NextResponse.json({ error: "Tu usuario no tiene un negocio activo" }, { status: 403 });

  let branchId: number | undefined;
  let branchSlug: string | undefined;
  if (!platformContext && membership) {
    const access = membership.branchAccess.filter((item) => item.branch?.active);
    const picked = access.find((item) => item.branchId === parsed.data.branchId);
    if (parsed.data.branchId !== undefined && parsed.data.branchId !== 0 && !picked) {
      return NextResponse.json({ error: "La sucursal elegida no está disponible" }, { status: 403 });
    }
    const selected = picked ?? (access.length === 1 ? access[0] : null);
    if (parsed.data.branchId === 0 && membership.allBranches) {
      branchId = 0;
    } else if (parsed.data.branchId === 0 && !membership.allBranches) {
      return NextResponse.json({ error: "No tenés acceso consolidado a varias sucursales" }, { status: 403 });
    } else if (selected) {
      branchId = selected.branchId;
      branchSlug = selected.branch?.slug ?? undefined;
    }
    if (access.length > 1 && branchId === undefined) {
      return NextResponse.json(
        {
          error: "Seleccioná la sucursal",
          requiresBranchSelection: true,
          consolidatedAvailable: membership.allBranches === true,
          branches: access.map((item) => ({
            id: item.branchId,
            name: item.branch.name,
            slug: item.branch.slug,
            isPrimary: item.branch.isPrimary,
          })),
        },
        { status: 409 },
      );
    }
  }

  if (!platformContext && hostContext.kind === "app" && !hostContext.slug && membership) {
    const rawHandoff = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(rawHandoff).digest("hex");
    await prisma.authHandoff.create({ data: { tokenHash, userId: user.id, membershipId: membership.id, branchId: branchId ?? null, expiresAt: new Date(Date.now() + 5 * 60 * 1000) } });
    return NextResponse.json({ ok: true, handoffUrl: tenantAdminUrl(membership.tenant.slug, `/login?handoff=${encodeURIComponent(rawHandoff)}`) });
  }

  const adminPath = branchSlug ? `/admin/s/${encodeURIComponent(branchSlug)}` : "/admin";
  const response = NextResponse.json({ ok: true, adminUrl: membership ? tenantAdminUrl(membership.tenant.slug, adminPath) : undefined });
  response.cookies.set(
    "laterne_session",
    await createSession({
      userId: user.id,
      role: user.role,
      ...(platformContext
        ? {}
        : membership
          ? {
              tenantId: membership.tenantId,
              membershipId: membership.id,
              roleKey: membership.role.key,
              branchId,
              branchSlug,
            }
          : {}),
      context: platformContext ? "platform" : "tenant",
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
