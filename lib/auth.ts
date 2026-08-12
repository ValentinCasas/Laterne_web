import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isLocalDevelopmentHost } from "@/lib/domains";
import { resolveHostKind } from "@/lib/host-gate";
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
  tenant: { id: number; name: string; slug: string; timeZone: string; customDomain?: string | null; adminTheme: string; adminAccent: string; palette: PaletteColors | null };
  membership: { id: number; role: { key: string; name: string } };
  permissions: string[];
  branches: Array<{ id: number; name: string; slug: string; active: boolean; isPrimary: boolean; licenseStatus: string | null; status: BranchEffectiveStatus }>;
  allBranches: boolean;
  activeBranchId?: number;
};

/** @summary Genera la clave binaria utilizada para firmar y validar las sesiones. */
const key = () => {
  const secret = process.env.AUTH_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
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
  const token = (await cookies()).get("laterne_session")?.value;
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

/** @summary Resuelve la membresía vigente y comprueba opcionalmente un permiso administrativo. */
export async function authorize(permission?: string): Promise<AuthorizationContext | null> {
  const session = await getSession();
  if (!session || session.context !== "tenant" || !session.membershipId) return null;
  if (permission && ["plan.manage", "lead.manage"].includes(permission)) return null;

  const requestHeaders = await headers();
  const host = (requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "")
    .split(",")[0]
    .trim()
    .split(":")[0]
    .toLocaleLowerCase("es");
  const hostContext = await resolveHostKind(host);
  if (hostContext.kind !== "app" && !(isLocalDevelopmentHost(host) && process.env.NODE_ENV === "development"))
    return null;

  const membership = await prisma.tenantMembership.findFirst({
    where: {
      id: session.membershipId,
      userId: session.userId,
      status: "active",
      tenant: {
        ...publicTenantWhere(),
        ...(hostContext.kind === "app" && hostContext.slug ? { slug: hostContext.slug } : {}),
      },
    },
    include: {
      tenant: {
        select: {
          id: true,
          name: true,
          slug: true,
           status: true,
           subscription: { select: { status: true, currentPeriodEnd: true, trialEndsAt: true, gracePeriodEndsAt: true } },
          timeZone: true,
           brandSettings: { select: { customDomain: true, adminTheme: true, adminAccent: true, primaryColor: true, secondaryColor: true, backgroundColor: true } },
           activePalette: { select: { primary: true, secondary: true, accent: true, background: true, surface: true, surfaceElevated: true, text: true, textMuted: true, border: true, success: true, warning: true, danger: true, baseMode: true } },
        },
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
               licenses: { select: { status: true, currentPeriodEnd: true, graceUntil: true }, orderBy: { id: "asc" }, take: 1 },
            },
          },
        },
        orderBy: { branchId: "asc" },
      },
    },
    orderBy: { id: "asc" },
  });
  if (!membership) return null;

  const permissions = membership.role.permissions
    .map((item) => item.permission.key)
    .filter((permissionKey) => !["plan.manage", "lead.manage"].includes(permissionKey));
  if (permission && !permissions.includes(permission)) return null;

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

  const allBranches =
    membership.allBranches === true;

  const branchHeader = requestHeaders.get("x-menuclick-branch-slug")?.trim().toLocaleLowerCase("es");
  if (branchHeader && !branches.some((branch) => branch.slug === branchHeader && branch.active && branch.status === "active")) return null;
  const requestedBranch = branchHeader
    ? branches.find((branch) => branch.slug === branchHeader)?.id
    : session.branchId;
  const wantsConsolidated = requestedBranch === 0 && allBranches;
  const canUseActive =
    requestedBranch !== undefined &&
    requestedBranch !== null &&
    requestedBranch > 0 &&
    branches.some((branch) => branch.id === requestedBranch && branch.active && branch.status === "active");
  const activeBranchId = wantsConsolidated
    ? 0
    : canUseActive
      ? requestedBranch
      : branches.find((branch) => branch.active)?.id;

  return {
    session,
    tenant: {
      ...membership.tenant,
      customDomain: membership.tenant.brandSettings?.customDomain,
      adminTheme: membership.tenant.brandSettings?.adminTheme ?? "menuclick-dark",
      adminAccent: membership.tenant.brandSettings?.adminAccent ?? "#ec4899",
      palette: membership.tenant.activePalette
        ? { ...membership.tenant.activePalette, baseMode: membership.tenant.activePalette.baseMode === "light" ? "light" : "dark" }
        : membership.tenant.brandSettings
          ? paletteFromLegacy(membership.tenant.brandSettings.primaryColor, membership.tenant.brandSettings.secondaryColor, membership.tenant.brandSettings.backgroundColor)
          : null,
    },
    membership: { id: membership.id, role: { key: membership.role.key, name: membership.role.name } },
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
  if (branchId === undefined || branchId === null) redirect("/admin");
  const context = permission ? await requirePermission(permission) : await requirePermission("admin.access");
  const branch = context.branches.find((item) => item.id === branchId && item.active && item.status === "active");
  if (!branch) redirect("/admin");
  return { ...context, branch };
}

/** @summary Comprueba en servidor que la membresía pueda operar sobre la sucursal solicitada. */
export function canAccessBranch(context: AuthorizationContext, branchId: number) {
  return context.branches.some((branch) => branch.id === branchId && branch.active && branch.status === "active");
}

/** @summary Exige una sesión válida y, opcionalmente, permisos de administración. */
export async function requireSession(admin = false) {
  if (admin) return requirePermission("admin.access");
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** @summary Exige una membresía activa que posea el permiso solicitado. */
export async function requirePermission(permission: string) {
  const context = await authorize(permission);
  if (!context) {
    const requestHeaders = await headers();
    const returnTo = requestHeaders.get("x-menuclick-original-path");
    redirect(returnTo?.startsWith("/admin/") ? `/login?returnTo=${encodeURIComponent(returnTo)}` : "/login");
  }

  const requestHeaders = await headers();
  const isBranchRequest = Boolean(requestHeaders.get("x-menuclick-branch-slug"));
  // La URL es la fuente real del contexto de sucursal: las rutas planas /admin/...
  // se reescriben a su variante canónica /admin/s/{branchSlug}/... salvo que se
  // esté operando en vista consolidada (0) o el path ya incluya la sucursal.
  if (!isBranchRequest && context.activeBranchId && context.activeBranchId > 0) {
    const activeBranch = context.branches.find((branch) => branch.id === context.activeBranchId);
    if (activeBranch?.slug) {
      const originalPath = requestHeaders.get("x-menuclick-original-path") ?? "";
      const remainder =
        originalPath === "/admin" || originalPath === "/" || originalPath === ""
          ? ""
          : originalPath.startsWith("/admin")
            ? originalPath.slice("/admin".length)
            : "";
      redirect(`/admin/s/${activeBranch.slug}${remainder}`);
    }
  }

  return context;
}

/** @summary Comprueba si la sesión pertenece a personal de la plataforma MenuClick. */
export async function authorizeSuperAdmin() {
  const session = await getSession();
  if (!session || session.context !== "platform" || session.membershipId) return null;
  const requestHeaders = await headers();
  const host = (requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "")
    .split(",")[0]
    .trim()
    .split(":")[0]
    .toLocaleLowerCase("es");
  const hostContext = await resolveHostKind(host);
  if (hostContext.kind !== "platform") return null;
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
