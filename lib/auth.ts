import { SignJWT, jwtVerify } from "jose";
import type { Route } from "next";
import { cookies } from "next/headers";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isLocalDevelopmentHost } from "@/lib/domains";
import {
  adminHrefForContext,
  isBranchAdminLogicalPath,
  tenantBranchAdminGuidPath,
  tenantPublicPath,
} from "@/lib/routes";
import { resolveHostKind } from "@/lib/host-gate";
import { effectiveHost } from "@/lib/trusted-headers";
import { getConfig } from "@/lib/config";
import { publicTenantWhere } from "@/lib/subscription-access";
import { paletteFromLegacy, type PaletteColors } from "@/lib/theme-palettes";
import { effectiveBranchStatus, type BranchEffectiveStatus } from "@/lib/branch";

export type Session = {
  userId: number;
  role: number;
  tenantId?: number;
  membershipId?: number;
  roleKey?: string;
  sessionId?: number;
  context?: "platform" | "tenant";
  branchId?: number;
  branchSlug?: string;
};

export type AuthorizationContext = {
  session: Session;
  tenant: {
    id: number;
    name: string;
    slug: string;
    /** Identidad pública inmutable usada en URLs administrativas. */
    publicGuid: string;
    timeZone: string;
    customDomain?: string | null;
    adminTheme: string;
    adminAccent: string;
    palette: PaletteColors | null;
  };
  membership: { id: number; role: { key: string; name: string } };
  /** Datos del usuario autenticado para identidad y avatar en el panel. */
  user: { id: number; name: string; email: string; imageUrl: string };
  permissions: string[];
  branches: Array<{
    id: number;
    name: string;
    slug: string;
    active: boolean;
    isPrimary: boolean;
    licenseStatus: string | null;
    status: BranchEffectiveStatus;
  }>;
  allBranches: boolean;
  activeBranchId?: number;
};

export const PLATFORM_SESSION_COOKIE = "menuclick_platform_session";

/** @summary Atributos de la cookie de sesión (HttpOnly, SameSite=Strict, Secure en producción). */
export function sessionCookieAttributes(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: getConfig().sessionCookieSecure,
    maxAge: maxAgeSeconds,
    path: "/",
  };
}

/** @summary Nombre de cookie aislado por tenant para permitir sesiones simultáneas en un único host admin. */
export function tenantSessionCookieName(tenantSlug: string) {
  const safe = tenantSlug
    .trim()
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9_-]/g, "-");
  return `menuclick_t_${safe}`;
}

/** @summary Cookie correspondiente a la ruta visible. Conserva `laterne_session` solo como alternativa heredada. */
async function sessionCookieToken() {
  const requestHeaders = await headers();
  const routeKind = requestHeaders.get("x-menuclick-route-kind") ?? "";
  const tenantSlug = requestHeaders.get("x-menuclick-tenant-slug")?.trim().toLocaleLowerCase("es");
  const store = await cookies();
  if (routeKind.startsWith("platform")) return store.get(PLATFORM_SESSION_COOKIE)?.value;
  if (tenantSlug) return store.get(tenantSessionCookieName(tenantSlug))?.value;
  return store.get("laterne_session")?.value;
}

/** @summary Genera la clave binaria utilizada para firmar y validar las sesiones. */
const key = () => {
  const secret = getConfig().authSecret;
  if (!secret && getConfig().isProduction) {
    throw new Error("AUTH_SECRET es obligatorio en producción");
  }
  return new TextEncoder().encode(secret ?? "development-only-change-me");
};

/** @summary Crea un token de sesión firmado con una vigencia máxima de ocho horas. */
export async function createSession(
  session: Omit<Session, "sessionId" | "context"> & {
    membershipId?: number;
    context?: "platform" | "tenant";
  },
) {
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const storedSession = await prisma.authSession.create({
    data: {
      userId: session.userId,
      membershipId: session.membershipId ?? null,
      branchId: session.branchId || null,
      context: session.context ?? (session.membershipId ? "tenant" : "platform"),
      expiresAt,
    },
  });

  return new SignJWT({ ...session, sessionId: storedSession.id })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(key());
}

/** @summary Recupera y valida la sesión almacenada en las cookies de la solicitud. */
export async function getSession(): Promise<Session | null> {
  const token = await sessionCookieToken();
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    const session: Session = {
      userId: Number(payload.userId),
      role: Number(payload.role),
      tenantId: payload.tenantId === undefined ? undefined : Number(payload.tenantId),
      membershipId: payload.membershipId === undefined ? undefined : Number(payload.membershipId),
      roleKey: typeof payload.roleKey === "string" ? payload.roleKey : undefined,
      sessionId: payload.sessionId === undefined ? undefined : Number(payload.sessionId),
      branchId: payload.branchId === undefined ? undefined : Number(payload.branchId),
      branchSlug: typeof payload.branchSlug === "string" ? payload.branchSlug : undefined,
      context:
        payload.context === "platform" ? "platform" : payload.context === "tenant" ? "tenant" : undefined,
    };

    if (session.sessionId) {
      const activeSession = await prisma.authSession.findFirst({
        where: {
          id: session.sessionId,
          userId: session.userId,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        select: { id: true, lastSeenAt: true, membershipId: true, context: true, branchId: true },
      });
      if (!activeSession) return null;
      if (
        (session.membershipId ?? null) !== activeSession.membershipId ||
        (session.context ?? "tenant") !== activeSession.context
      )
        return null;
      if (!session.context) session.context = activeSession.context === "platform" ? "platform" : "tenant";
      if (activeSession.branchId !== null && session.branchId !== activeSession.branchId) {
        session.branchId = activeSession.branchId;
      }
      if (activeSession.lastSeenAt.getTime() < Date.now() - 5 * 60 * 1000) {
        await prisma.authSession.update({
          where: { id: activeSession.id },
          data: { lastSeenAt: new Date() },
        });
      }
    }

    return session;
  } catch {
    return null;
  }
}

/** @summary Resuelve la membresía vigente usando tenant/branch de la URL como fuente de verdad. */
export async function authorize(permission?: string): Promise<AuthorizationContext | null> {
  const session = await getSession();
  if (!session || session.context !== "tenant" || !session.membershipId) return null;
  if (permission && ["plan.manage", "lead.manage"].includes(permission)) return null;

  const requestHeaders = await headers();
  const routeTenantSlug = requestHeaders.get("x-menuclick-tenant-slug")?.trim().toLocaleLowerCase("es");
  const routeTenantGuid = requestHeaders.get("x-menuclick-tenant-guid")?.trim().toLocaleLowerCase("es");
  const routeKind = requestHeaders.get("x-menuclick-route-kind") ?? "";
  const adminScope = requestHeaders.get("x-menuclick-admin-scope") ?? "";
  const host = effectiveHost(requestHeaders).toLocaleLowerCase("es");
  const hostContext = await resolveHostKind(host);

  // Las rutas canónicas llevan el tenant en la URL. El host solo se usa por compatibilidad heredada.
  if (
    !routeTenantSlug &&
    hostContext.kind !== "app" &&
    !(isLocalDevelopmentHost(host) && process.env.NODE_ENV === "development")
  ) {
    return null;
  }
  if (routeTenantSlug && routeKind !== "tenant-admin" && routeKind !== "tenant-auth" && routeKind !== "tenant-driver")
    return null;

  const expectedTenantSlug = routeTenantSlug || (hostContext.kind === "app" ? hostContext.slug : undefined);
  const tenantFilter = routeTenantGuid
    ? { publicGuid: routeTenantGuid }
    : expectedTenantSlug
      ? { slug: expectedTenantSlug }
      : {};
  const membership = await prisma.tenantMembership.findFirst({
    where: {
      id: session.membershipId,
      userId: session.userId,
      status: "active",
      tenant: {
        ...publicTenantWhere(),
        ...tenantFilter,
      },
    },
    include: {
      tenant: {
        select: {
          id: true,
          name: true,
          slug: true,
          publicGuid: true,
          status: true,
          subscription: {
            select: { status: true, currentPeriodEnd: true, trialEndsAt: true, gracePeriodEndsAt: true },
          },
          timeZone: true,
          brandSettings: {
            select: {
              customDomain: true,
              adminTheme: true,
              adminAccent: true,
              primaryColor: true,
              secondaryColor: true,
              backgroundColor: true,
            },
          },
          activePalette: {
            select: {
              primary: true,
              secondary: true,
              accent: true,
              background: true,
              surface: true,
              surfaceElevated: true,
              text: true,
              textMuted: true,
              border: true,
              success: true,
              warning: true,
              danger: true,
              baseMode: true,
            },
          },
        },
      },
      user: {
        select: { id: true, name: true, email: true, imageUrl: true },
      },
      role: {
        select: {
          key: true,
          name: true,
          permissions: { select: { permission: { select: { key: true } } } },
        },
      },
      branchAccess: {
        include: {
          branch: {
            select: {
              id: true,
              name: true,
              slug: true,
              active: true,
              isPrimary: true,
              licenses: {
                select: { status: true, currentPeriodEnd: true, graceUntil: true },
                orderBy: { id: "asc" },
                take: 1,
              },
            },
          },
        },
        orderBy: { branchId: "asc" },
      },
    },
    orderBy: { id: "asc" },
  });
  if (!membership) return null;
  // La URL lleva el slug como parte legible; si no coincide con el canónico del
  // negocio la solicitud se rechaza (el proxy ya redirige a la URL canónica).
  if (routeTenantSlug && membership.tenant.slug !== routeTenantSlug) return null;

  const permissions = membership.role.permissions
    .map((item) => item.permission.key)
    .filter((permissionKey) => !["plan.manage", "lead.manage"].includes(permissionKey));

  const roleKey = membership.role.key;
  const isPrivilegedFinance = roleKey === "owner" || roleKey === "administrator";

  if (permission && !permissions.includes(permission)) {
    if (isPrivilegedFinance && permission.startsWith("finance.")) {
      permissions.push(permission);
    } else {
      return null;
    }
  }

  const branches = membership.branchAccess.map(({ branch }) => {
    const licenseStatus = branch.licenses[0]?.status ?? null;
    return {
      id: branch.id,
      name: branch.name,
      slug: branch.slug,
      active: branch.active,
      isPrimary: branch.isPrimary,
      licenseStatus,
      status: effectiveBranchStatus({
        tenantStatus: membership.tenant.status,
        tenantSubscription: membership.tenant.subscription,
        branchActive: branch.active,
        license: branch.licenses[0] ?? null,
      }),
    };
  });

  const allBranches = membership.allBranches === true;
  const branchSlug = requestHeaders.get("x-menuclick-branch-slug")?.trim().toLocaleLowerCase("es");
  let activeBranchId: number | undefined;

  if (branchSlug) {
    const branch = branches.find(
      (item) => item.slug === branchSlug && item.active && item.status === "active",
    );
    if (!branch) return null;
    activeBranchId = branch.id;
  } else if (routeTenantSlug) {
    // En rutas canónicas sin /s/{branch}, no se inventa una sucursal.
    // `0` representa una vista consolidada autorizada; undefined = tenant-level.
    activeBranchId = adminScope === "consolidated" && allBranches ? 0 : undefined;
  } else {
    // Compatibilidad heredada mientras desaparecen /admin y los subdominios por tenant.
    const requested = session.branchId;
    if (requested === 0 && allBranches) activeBranchId = 0;
    else if (
      requested &&
      branches.some((item) => item.id === requested && item.active && item.status === "active")
    ) {
      activeBranchId = requested;
    }
  }

  return {
    session,
    tenant: {
      ...membership.tenant,
      customDomain: membership.tenant.brandSettings?.customDomain,
      adminTheme: membership.tenant.brandSettings?.adminTheme ?? "menuclick-dark",
      adminAccent: membership.tenant.brandSettings?.adminAccent ?? "#ec4899",
      palette: membership.tenant.activePalette
        ? {
            ...membership.tenant.activePalette,
            baseMode: membership.tenant.activePalette.baseMode === "light" ? "light" : "dark",
          }
        : membership.tenant.brandSettings
          ? paletteFromLegacy(
              membership.tenant.brandSettings.primaryColor,
              membership.tenant.brandSettings.secondaryColor,
              membership.tenant.brandSettings.backgroundColor,
            )
          : null,
    },
    membership: { id: membership.id, role: { key: membership.role.key, name: membership.role.name } },
    user: {
      id: membership.user.id,
      name: membership.user.name,
      email: membership.user.email,
      imageUrl: membership.user.imageUrl,
    },
    permissions,
    branches,
    allBranches,
    activeBranchId,
  };
}

/** @summary Exige una membresía activa que pueda operar sobre la sucursal indicada. */
export async function requireBranch(
  permission: string | undefined,
  branchId?: number | null,
): Promise<AuthorizationContext & { branch: AuthorizationContext["branches"][number] }> {
  const context = permission ? await requirePermission(permission) : await requirePermission("admin.access");
  // La URL es la fuente de verdad: si la sucursal explícita no es accesible se
  // rechaza con 403. Nunca se redirige silenciosamente a otra sucursal.
  if (branchId === undefined || branchId === null) redirect("/403");
  const branch = context.branches.find(
    (item) => item.id === branchId && item.active && item.status === "active",
  );
  if (!branch) redirect("/403");
  return { ...context, branch };
}

/** @summary Comprueba en servidor que la membresía pueda operar sobre la sucursal solicitada. */
export function canAccessBranch(context: AuthorizationContext, branchId: number) {
  return context.branches.some(
    (branch) => branch.id === branchId && branch.active && branch.status === "active",
  );
}

/** @summary Exige una sesión válida y, opcionalmente, permisos de administración. */
export async function requireSession(admin = false) {
  if (admin) return requirePermission("admin.access");
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** @summary Exige una membresía activa y normaliza cualquier acceso heredado a la ruta canónica. */
export async function requirePermission(permission: string) {
  const requestHeaders = await headers();
  const originalPath = requestHeaders.get("x-menuclick-original-path") ?? "";
  const routeTenantSlug = requestHeaders.get("x-menuclick-tenant-slug")?.trim().toLocaleLowerCase("es");
  const routeBranchSlug = requestHeaders.get("x-menuclick-branch-slug")?.trim().toLocaleLowerCase("es");
  const adminScope = requestHeaders.get("x-menuclick-admin-scope") ?? "";
  const context = await authorize(permission);

  if (!context) {
    const loginPath = routeTenantSlug ? tenantPublicPath(routeTenantSlug, "/login") : "/login";
    const safeReturnTo = originalPath.startsWith("/t/") ? originalPath : undefined;

    // Solo falta de sesión redirige al acceso. Con sesión válida pero sin acceso
    // nunca volvemos a login (evita el loop login -> returnTo -> login).
    const session = await getSession();
    if (!session || session.context !== "tenant" || !session.membershipId) {
      redirect(
        (safeReturnTo ? `${loginPath}?returnTo=${encodeURIComponent(safeReturnTo)}` : loginPath) as Route,
      );
    }

    // Sucursal explícita de la URL: inexistente en el tenant → 404; existente
    // pero sin acceso/operativa → 403. Nunca se cae silenciosamente a otra sucursal.
    if (routeTenantSlug && routeBranchSlug) {
      const branch = await prisma.branch.findFirst({
        where: { tenant: { slug: routeTenantSlug }, slug: routeBranchSlug },
        select: { id: true },
      });
      if (!branch) notFound();
    }
    redirect("/403");
  }

  const logicalPath = originalPath.startsWith("/t/")
    ? (() => {
        const marker = routeBranchSlug ? `/admin/s/${routeBranchSlug}` : "/admin";
        const index = originalPath.indexOf(marker);
        return index >= 0 ? `/admin${originalPath.slice(index + marker.length).split("?")[0]}` : "/admin";
      })()
    : originalPath.startsWith("/admin")
      ? originalPath.split("?")[0]
      : "/admin";

  // Una vista consolidada solo existe para membresías autorizadas. Si el usuario
  // no puede consolidar, lo llevamos a una sucursal explícita conservando sección.
  if (
    routeTenantSlug &&
    !routeBranchSlug &&
    adminScope === "consolidated" &&
    isBranchAdminLogicalPath(logicalPath) &&
    !context.allBranches
  ) {
    const firstBranch = context.branches.find((branch) => branch.active && branch.status === "active");
    if (firstBranch)
      redirect(
        tenantBranchAdminGuidPath(
          context.tenant.publicGuid,
          context.tenant.slug,
          firstBranch.slug,
          logicalPath,
        ) as Route,
      );
  }

  // Compatibilidad con bookmarks/enlaces antiguos: /admin/... nunca queda como
  // URL visible después de resolver la membresía.
  if (!routeTenantSlug && originalPath.startsWith("/admin")) {
    const branch =
      context.activeBranchId && context.activeBranchId > 0
        ? context.branches.find((item) => item.id === context.activeBranchId)
        : undefined;
    redirect(
      adminHrefForContext(context.tenant.slug, logicalPath, branch?.slug, context.tenant.publicGuid) as Route,
    );
  }

  return context;
}

/**
 * @summary Exige una membresía con el permiso `driver.self` para la vista personal
 * del repartidor. Rechaza con redirección al acceso/403 como el resto del panel.
 */
export async function requireDriver() {
  const requestHeaders = await headers();
  const routeTenantSlug = requestHeaders.get("x-menuclick-tenant-slug")?.trim().toLocaleLowerCase("es");
  const context = await authorize("driver.self");
  if (!context) {
    const loginPath = routeTenantSlug ? tenantPublicPath(routeTenantSlug, "/login") : "/login";
    const session = await getSession();
    if (!session || session.context !== "tenant" || !session.membershipId) {
      redirect(loginPath as Route);
    }
    redirect("/403");
  }
  return context;
}

/** @summary Comprueba si la sesión pertenece a personal de la plataforma MenuClick. */
export async function authorizeSuperAdmin() {
  const session = await getSession();
  if (!session || session.context !== "platform" || session.membershipId) return null;
  const requestHeaders = await headers();
  const host = effectiveHost(requestHeaders).toLocaleLowerCase("es");
  const routeKind = requestHeaders.get("x-menuclick-route-kind") ?? "";
  const hostContext = await resolveHostKind(host);
  if (routeKind !== "platform-admin" && hostContext.kind !== "platform") return null;
  const user = await prisma.user.findFirst({
    where: {
      id: session.userId,
      OR: [{ isSuperAdmin: true }, { platformRole: { in: ["superadmin", "admin", "support", "sales"] } }],
    },
    select: { id: true, name: true, email: true, isSuperAdmin: true, platformRole: true },
  });
  return user ? { session, user } : null;
}

/** @summary Exige privilegios globales antes de abrir herramientas multiempresa. */
export async function requireSuperAdmin() {
  const session = await getSession();
  if (!session) {
    const requestHeaders = await headers();
    const originalPath = requestHeaders.get("x-menuclick-original-path") ?? "";
    const safeReturnTo = originalPath.startsWith("/platform") ? originalPath : undefined;
    redirect(
      safeReturnTo ? `/platform/login?returnTo=${encodeURIComponent(safeReturnTo)}` : "/platform/login",
    );
  }
  const context = await authorizeSuperAdmin();
  if (!context) redirect("/403");
  return context;
}

/** @summary Revoca en el servidor la sesión actual para impedir que el token vuelva a utilizarse. */
export async function revokeCurrentSession() {
  const session = await getSession();
  if (!session?.sessionId) return;
  await prisma.authSession.updateMany({
    where: { id: session.sessionId, userId: session.userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
