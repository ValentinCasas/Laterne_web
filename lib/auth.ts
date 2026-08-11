import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export type Session = {
  userId: number;
  role: number;
  tenantId?: number;
  membershipId?: number;
  roleKey?: string;
  sessionId?: number;
};

export type AuthorizationContext = {
  session: Session;
  tenant: { id: number; name: string; slug: string; timeZone: string };
  membership: { id: number; role: { key: string; name: string } };
  permissions: string[];
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
export async function createSession(session: Omit<Session, "sessionId"> & { membershipId: number }) {
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const storedSession = await prisma.authSession.create({
    data: { userId: session.userId, membershipId: session.membershipId, expiresAt },
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
    };

    if (session.sessionId) {
      const activeSession = await prisma.authSession.findFirst({
        where: {
          id: session.sessionId,
          userId: session.userId,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        select: { id: true, lastSeenAt: true },
      });
      if (!activeSession) return null;
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
  if (!session) return null;

  const membership = await prisma.tenantMembership.findFirst({
    where: {
      ...(session.membershipId ? { id: session.membershipId } : { userId: session.userId }),
      userId: session.userId,
      status: "active",
      tenant: { status: "active" },
    },
    include: {
      tenant: { select: { id: true, name: true, slug: true, timeZone: true } },
      role: {
        select: {
          key: true,
          name: true,
          permissions: { select: { permission: { select: { key: true } } } },
        },
      },
    },
    orderBy: { id: "asc" },
  });
  if (!membership) return null;

  const permissions = membership.role.permissions.map((item) => item.permission.key);
  if (permission && !permissions.includes(permission)) return null;

  return {
    session,
    tenant: membership.tenant,
    membership: { id: membership.id, role: { key: membership.role.key, name: membership.role.name } },
    permissions,
  };
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
  if (!context) redirect("/login");
  return context;
}

/** @summary Comprueba si la sesión pertenece al propietario global de la plataforma. */
export async function authorizeSuperAdmin() {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findFirst({
    where: { id: session.userId, isSuperAdmin: true },
    select: { id: true, name: true, email: true },
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
