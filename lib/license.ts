import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { operatingLicenseWhere } from "@/lib/branch";

/**
 * Motor de licencias por sucursal y capacidad de usuarios de MenuClick.
 *
 * Modelo comercial (sin cobros todavía):
 * - El PLAN define la oferta comercial: precios, funcionalidades y una capacidad
 *   de usuarios de referencia (`plan.capacity.users`).
 * - La LICENCIA (BranchLicense) es el entitlement operativo de una sucursal.
 *   Una sucursal puede tener VARIAS licencias (p. ej. una base activa y una de
 *   refuerzo con cupos adicionales). Solo las licencias operativas y vigentes
 *   aportan cupos.
 * - La capacidad de usuarios PERMITIDOS de una sucursal es la suma de los cupos
 *   de sus licencias operativas: `usersAllowed` de la licencia, o la capacidad
 *   del plan como referencia cuando la licencia no define cupos propios.
 * - Los usuarios UTILIZADOS son los miembros activos distintos con acceso a la
 *   sucursal (allBranches o BranchMembership explícita). El rol `owner` NO
 *   consume licencia: es el titular que administra la cuenta, no un empleado
 *   operativo. Los usuarios de Platform no participan del tenant.
 * - Al asignar un usuario no-owner a una sucursal se valida que quede dentro de
 *   los cupos. El owner nunca se bloquea y el superadmin nunca se bloquea.
 *   La sucursal sin licencia operativa queda visible en Platform pero no permite
 *   asignar nuevos usuarios no-owner ("SIN CUPOS").
 */

export type Db = Prisma.TransactionClient | typeof prisma;

/** @summary Tipo mínimo de licencia aceptado por los helpers de capacidad. */
export type LicenseLike = {
  usersAllowed?: number | null;
  plan?: { capacity?: Prisma.JsonValue | null } | null;
};

/** @summary Capacidad de usuarios que define un plan (`capacity.users`). */
export function planUserCapacity(capacity: Prisma.JsonValue | null): number {
  const value = capacity as { users?: unknown } | null;
  const parsed = typeof value?.users === "number" ? value.users : Number(value?.users);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

/** @summary Cupos de usuarios que aporta una licencia (su propio cupo o la referencia del plan). */
export function licenseUserSlots(license: LicenseLike): number {
  if (typeof license.usersAllowed === "number" && license.usersAllowed > 0) return license.usersAllowed;
  return planUserCapacity(license.plan?.capacity ?? null);
}

/** @summary Suma de cupos de las licencias operativas de una sucursal. */
export function sumBranchAllowedUsers(licenses: LicenseLike[]): number {
  return licenses.reduce((total, license) => total + Math.max(0, licenseUserSlots(license)), 0);
}

/** @summary Estado efectivo de una licencia: activa, suspendida, vencida o borrador. */
export function effectiveLicenseStatus(
  license: { status?: string | null; currentPeriodEnd?: Date | null; graceUntil?: Date | null },
  now = new Date(),
): "ACTIVE" | "SUSPENDED" | "EXPIRED" | "DRAFT" {
  const status = license?.status ?? "";
  if (status === "DRAFT") return "DRAFT";
  if (status === "SUSPENDED" || status === "CANCELLED") return "SUSPENDED";
  if (status === "GRACE_PERIOD") {
    return license.graceUntil && license.graceUntil.getTime() <= now.getTime() ? "SUSPENDED" : "ACTIVE";
  }
  if (["ACTIVE", "TRIAL", "PAYMENT_PENDING"].includes(status)) {
    return license.currentPeriodEnd && license.currentPeriodEnd.getTime() <= now.getTime()
      ? "EXPIRED"
      : "ACTIVE";
  }
  return "DRAFT";
}

/** @summary Usuarios utilizados: miembros activos no-owner con acceso a la sucursal. */
export async function countBranchUsers(
  db: Db,
  tenantId: number,
  branchId: number,
  excludeUserId?: number,
): Promise<number> {
  return db.tenantMembership.count({
    where: {
      tenantId,
      status: "active",
      role: { key: { not: "owner" } },
      ...(excludeUserId ? { userId: { not: excludeUserId } } : {}),
      OR: [{ allBranches: true }, { branchAccess: { some: { branchId } } }],
    },
  });
}

/** @summary Cupos permitidos y usuarios utilizados de una sucursal. */
export async function branchUserUsage(
  tenantId: number,
  branchId: number,
  now = new Date(),
): Promise<{ allowed: number; used: number }> {
  const [licenses, used] = await Promise.all([
    prisma.branchLicense.findMany({
      where: { tenantId, branchId, ...operatingLicenseWhere(now) },
      select: { usersAllowed: true, plan: { select: { capacity: true } } },
    }),
    countBranchUsers(prisma, tenantId, branchId),
  ]);
  return { allowed: sumBranchAllowedUsers(licenses), used };
}

/** @summary Acceso actual a sucursales de un miembro (allBranches o lista explícita). */
export async function memberBranchAccess(
  db: Db,
  tenantId: number,
  userId: number,
): Promise<{ allBranches: boolean; branchIds: number[] }> {
  const membership = await db.tenantMembership.findFirst({
    where: { tenantId, userId },
    select: { allBranches: true, branchAccess: { select: { branchId: true } } },
  });
  if (!membership) return { allBranches: false, branchIds: [] };
  if (membership.allBranches) {
    const branches = await db.branch.findMany({ where: { tenantId, active: true }, select: { id: true } });
    return { allBranches: true, branchIds: branches.map((branch) => branch.id) };
  }
  return { allBranches: false, branchIds: membership.branchAccess.map((access) => access.branchId) };
}

/**
 * @summary Valida que otorgar acceso a las sucursales indicadas no supere los cupos.
 *
 * Solo aplica a usuarios no-owner. `excludeUserId` permite recalcular sin contar
 * al propio usuario al editar sus sucursales. Lanza un Error con mensaje claro.
 */
export async function assertMemberBranchCapacity(args: {
  db: Db;
  tenantId: number;
  roleKey?: string | null;
  allBranches: boolean;
  branchIds: number[];
  excludeUserId?: number;
}): Promise<void> {
  if (args.roleKey === "owner") return;
  const now = new Date();

  const targetIds = args.allBranches
    ? (await args.db.branch.findMany({ where: { tenantId: args.tenantId, active: true }, select: { id: true } }))
        .map((branch) => branch.id)
    : args.branchIds;
  if (!targetIds.length) return;

  const current = args.excludeUserId
    ? await memberBranchAccess(args.db, args.tenantId, args.excludeUserId)
    : { allBranches: false, branchIds: [] as number[] };
  const alreadyAccessible = new Set(current.branchIds);

  const branches = await args.db.branch.findMany({
    where: { tenantId: args.tenantId, id: { in: targetIds }, active: true },
    select: {
      id: true,
      name: true,
      licenses: {
        where: operatingLicenseWhere(now),
        select: { usersAllowed: true, plan: { select: { capacity: true } } },
      },
    },
  });

  for (const branch of branches) {
    if (alreadyAccessible.has(branch.id)) continue;
    const allowed = sumBranchAllowedUsers(branch.licenses);
    const used = await countBranchUsers(args.db, args.tenantId, branch.id, args.excludeUserId);
    if (used + 1 > allowed) {
      const reason =
        allowed <= 0
          ? `La sucursal "${branch.name}" no tiene una licencia activa con cupos disponibles (SIN CUPOS).`
          : `La sucursal "${branch.name}" llegó al límite de usuarios (${allowed}/${allowed}). Asignale una licencia con más cupos desde MenuClick Platform.`;
      throw new Error(reason);
    }
  }
}

/** @summary Lock MySQL por tenant para evitar condiciones de carrera al asignar usuarios. */
export async function acquireTenantUserLock(db: Db, tenantId: number): Promise<void> {
  await db.$executeRawUnsafe(`SELECT GET_LOCK(${JSON.stringify(`menuclick:tenant:${tenantId}:users`)}, 5)`);
}

/** @summary Libera el lock MySQL adquirido con {@link acquireTenantUserLock}. */
export async function releaseTenantUserLock(db: Db, tenantId: number): Promise<void> {
  await db.$executeRawUnsafe(`SELECT RELEASE_LOCK(${JSON.stringify(`menuclick:tenant:${tenantId}:users`)})`);
}