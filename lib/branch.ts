import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { uniqueCategorySlug } from "@/lib/slug";
import { publicTenantWhere } from "@/lib/subscription-access";
import { CATEGORY_IMAGE_FALLBACK_FILE } from "@/lib/image-fallback";

/**
 * Contexto central de sucursal de MenuClick.
 *
 * Tenant = empresa/cliente. Branch = local operativo.
 * Toda operación branch-scoped se resuelve con tenantId + branchId y estos
 * helpers evitan replicar lógica de licencias y acceso en cada endpoint.
 */

export type BranchEffectiveStatus = "active" | "draft" | "inactive" | "suspended" | "unknown";

export type PublicBranchContext = {
  tenantId: number;
  branchId: number;
  branchSlug: string;
  isPrimary: boolean;
  inheritLanding: boolean;
  status: BranchEffectiveStatus;
  licenseStatus: string | null;
  operative: boolean;
  branch: {
    id: number;
    name: string;
    slug: string;
    active: boolean;
    isPrimary: boolean;
    inheritLanding: boolean;
    inheritBrand: boolean;
    landingContent: unknown;
    brandContent: unknown;
    licenses: Array<{
      status: string;
      currentPeriodEnd: Date | null;
      graceUntil: Date | null;
      planId: number | null;
    }>;
  };
  license: {
    status: string;
    currentPeriodEnd: Date | null;
    graceUntil: Date | null;
    planId: number | null;
  } | null;
};

/** @summary Estados de licencia de sucursal que habilitan operación pública dentro de su período. */
export function operatingLicenseWhere(now = new Date()): Prisma.BranchLicenseWhereInput {
  const activePeriod = [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: now } }];
  return {
    OR: [
      { status: "ACTIVE", OR: activePeriod },
      { status: "PAYMENT_PENDING", OR: activePeriod },
      {
        status: "TRIAL",
        OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: now } }],
      },
      {
        status: "GRACE_PERIOD",
        OR: [{ graceUntil: null }, { graceUntil: { gt: now } }],
      },
    ],
  };
}

type TenantSubscriptionLike = {
  status?: string | null;
  currentPeriodEnd?: Date | null;
  trialEndsAt?: Date | null;
  gracePeriodEndsAt?: Date | null;
};

type LicenseLike = {
  status?: string | null;
  currentPeriodEnd?: Date | null;
  graceUntil?: Date | null;
};

type EffectiveBranchInput = {
  tenantStatus: string;
  tenantSubscription?: TenantSubscriptionLike | null;
  branchActive: boolean;
  license?: LicenseLike | null;
  now?: Date;
};

/** @summary Estado operativo efectivo de una sucursal combinando tenant, branch y licencia. */
export function effectiveBranchStatus(input: EffectiveBranchInput): BranchEffectiveStatus {
  const now = input.now ?? new Date();

  if (input.tenantStatus !== "active") return "suspended";

  const sub = input.tenantSubscription;
  if (
    sub?.status &&
    sub.status !== "ACTIVE" &&
    sub.status !== "PAYMENT_PENDING" &&
    sub.status !== "TRIAL" &&
    sub.status !== "GRACE_PERIOD"
  ) {
    return "suspended";
  }
  if (sub?.status === "ACTIVE" && sub.currentPeriodEnd && sub.currentPeriodEnd.getTime() <= now.getTime())
    return "suspended";
  if (
    sub?.status === "PAYMENT_PENDING" &&
    sub.currentPeriodEnd &&
    sub.currentPeriodEnd.getTime() <= now.getTime()
  )
    return "suspended";
  if (sub?.status === "TRIAL" && sub.trialEndsAt && sub.trialEndsAt.getTime() <= now.getTime())
    return "suspended";
  if (
    sub?.status === "GRACE_PERIOD" &&
    sub.gracePeriodEndsAt &&
    sub.gracePeriodEndsAt.getTime() <= now.getTime()
  )
    return "suspended";

  if (!input.branchActive) return "inactive";

  const license = input.license;
  if (!license || !license.status || license.status === "DRAFT") return "draft";
  if (license.status === "CANCELLED" || license.status === "SUSPENDED") return "suspended";
  if (license.status === "GRACE_PERIOD") {
    return license.graceUntil && license.graceUntil.getTime() <= now.getTime() ? "suspended" : "active";
  }
  if (["ACTIVE", "TRIAL", "PAYMENT_PENDING"].includes(license.status)) {
    if (license.currentPeriodEnd && license.currentPeriodEnd.getTime() <= now.getTime()) return "suspended";
    return "active";
  }
  return "unknown";
}

/** @summary Filtrar sucursales activas con licencia operativa vigente para el sitio público. */
export function publicBranchWhere(tenantId: number, now = new Date()): Prisma.BranchWhereInput {
  return {
    tenantId,
    active: true,
    OR: [{ licenses: { some: operatingLicenseWhere(now) } }],
  };
}

/** @summary Resuelve una sucursal pública junto a su licencia y estado efectivo. */
export async function resolvePublicBranch(
  tenantId: number,
  branchSlug: string,
  now = new Date(),
): Promise<PublicBranchContext | null> {
  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, ...publicTenantWhere(now) },
    select: {
      id: true,
      status: true,
      subscription: {
        select: {
          status: true,
          currentPeriodEnd: true,
          trialEndsAt: true,
          gracePeriodEndsAt: true,
        },
      },
    },
  });
  if (!tenant) return null;

  const branch = await prisma.branch.findFirst({
    where: { tenantId, slug: branchSlug },
    include: { licenses: true },
    orderBy: { id: "asc" },
  });
  if (!branch) return null;

  const license = branch.licenses[0] ?? null;
  const status = effectiveBranchStatus({
    tenantStatus: tenant.status,
    tenantSubscription: tenant.subscription,
    branchActive: branch.active,
    license,
    now,
  });

  return {
    tenantId: tenant.id,
    branchId: branch.id,
    branchSlug: branch.slug,
    isPrimary: branch.isPrimary,
    inheritLanding: branch.inheritLanding,
    status,
    licenseStatus: license?.status ?? null,
    operative: status === "active",
    branch,
    license: license
      ? {
          status: license.status,
          currentPeriodEnd: license.currentPeriodEnd,
          graceUntil: license.graceUntil,
          planId: license.planId,
        }
      : null,
  };
}

/** @summary Determina si una sucursal puede operar públicamente en este momento. */
export async function isBranchOperational(
  tenantId: number,
  branchId: number,
  now = new Date(),
): Promise<boolean> {
  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, ...publicTenantWhere(now) },
    select: {
      status: true,
      subscription: {
        select: {
          status: true,
          currentPeriodEnd: true,
          trialEndsAt: true,
          gracePeriodEndsAt: true,
        },
      },
    },
  });
  if (!tenant) return false;
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, tenantId },
    include: { licenses: { take: 1 } },
  });
  if (!branch || !branch.active) return false;
  return (
    effectiveBranchStatus({
      tenantStatus: tenant.status,
      tenantSubscription: tenant.subscription,
      branchActive: branch.active,
      license: branch.licenses[0] ?? null,
      now,
    }) === "active"
  );
}

/** @summary Máximo de sucursales operativas permitidas por el plan contratado. */
export function planBranchCapacity(capacity: Prisma.JsonValue | null): number {
  const value = capacity as { branches?: unknown } | null;
  const parsed = typeof value?.branches === "number" ? value.branches : Number(value?.branches);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/** @summary Límite de sucursales efectivo entre el plan y un override del tenant. */
export async function resolveBranchLimit(tenantId: number): Promise<number | null> {
  const subscription = await prisma.tenantSubscription.findUnique({
    where: { tenantId },
    select: { planId: true, limits: true, plan: { select: { capacity: true } } },
  });
  if (!subscription?.planId && !subscription?.plan) return null;

  const overrides = (subscription?.limits as { branches?: unknown } | null) ?? null;
  if (typeof overrides?.branches === "number") return overrides.branches;

  return subscription?.plan ? planBranchCapacity(subscription.plan.capacity) : null;
}

/** @summary Valida que el tenant tenga capacidad de sucursales y devuelve error legible si no. */
export async function assertBranchCapacity(
  tenantId: number,
): Promise<{ ok: true; limit: number | null } | { ok: false; reason: string }> {
  const limit = await resolveBranchLimit(tenantId);
  if (limit === null || limit <= 0) {
    return { ok: false, reason: "No tenés licencias disponibles para nuevas sucursales." };
  }
  const activeCount = await prisma.branch.count({
    where: {
      tenantId,
      active: true,
      licenses: { some: { status: { in: ["ACTIVE", "TRIAL", "PAYMENT_PENDING", "GRACE_PERIOD"] } } },
    },
  });
  if (activeCount >= limit) {
    return { ok: false, reason: "Alcanzaste el límite de sucursales de tu plan. Contactá a MenuClick." };
  }
  return { ok: true, limit };
}

/** @summary ID de la sucursal principal activa (o la primera activa) del tenant. */
export async function resolveOperatingBranchId(tenantId: number): Promise<number | null> {
  const branch = await prisma.branch.findFirst({
    where: { tenantId, active: true },
    orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
    select: { id: true },
  });
  return branch?.id ?? null;
}

/**
 * @summary Devuelve únicamente la sucursal explícita de la URL.
 * Una vista consolidada nunca inventa/fallbackea a Principal para una escritura.
 */
export async function resolveEffectiveBranchId(
  _tenantId: number,
  activeBranchId: number | undefined | null,
): Promise<number | null> {
  return activeBranchId && activeBranchId > 0 ? activeBranchId : null;
}

/** @summary Crea (si falta) la licencia DRAFT inicial de una sucursal recién creada. */
export async function ensureDraftLicense(tenantId: number, branchId: number) {
  await prisma.branchLicense.upsert({
    where: { tenantId_branchId: { tenantId, branchId } },
    create: {
      tenantId,
      branchId,
      status: "DRAFT",
      planId:
        (
          await prisma.tenantSubscription.findUnique({
            where: { tenantId },
            select: { planId: true },
          })
        )?.planId ?? undefined,
    },
    update: {},
  });
}

/** @summary Where branch-scoped para consultas admin: 0 o null = todas las sucursales. */
export function activeBranchWhere<T extends Record<string, unknown>>(
  tenantId: number,
  activeBranchId: number | undefined | null,
  field = "branchId",
): T {
  const base = { tenantId } as Record<string, unknown>;
  if (activeBranchId && activeBranchId > 0) base[field] = activeBranchId;
  return base as T;
}

/**
 * Modelos cuyo contenido pertenece directamente a una sucursal (branchId directo).
 * Distinto de Product, que es catálogo maestro del tenant y se asocia por BranchProduct.
 */
export const BRANCH_DIRECT_MODELS = new Set([
  "category",
  "event",
  "openingHour",
  "testimonial",
  "promotion",
  "reservation",
  "reservationBlock",
  "diningTable",
  "customerOrder",
  "analyticsEvent",
  "mediaAsset",
  "notification",
  "invoiceRecord",
  "authSession",
  "auditLog",
]);

/**
 * @summary Construye el filtro de productos disponible para una sucursal activa.
 *
 * Product es el catálogo maestro del Tenant; la publicación por sucursal se resuelve
 * mediante BranchProduct (branchAssignments). 0 o null devuelve todas las asignaciones
 * (vista consolidada) sin duplicar productos maestros.
 */
export function branchProductWhere(
  tenantId: number,
  activeBranchId: number | undefined | null,
): Prisma.ProductWhereInput {
  const base: Prisma.ProductWhereInput = { tenantId };
  if (activeBranchId && activeBranchId > 0) {
    base.branchAssignments = { some: { branchId: activeBranchId } };
  }
  return base;
}

/** @summary Filtro de publicación por sucursal para usar dentro de relaciones anidadas de Product. */
export function branchAssignmentFilter(
  activeBranchId: number | undefined | null,
): Prisma.BranchProductWhereInput {
  return activeBranchId && activeBranchId > 0 ? { branchId: activeBranchId } : {};
}

/** @summary Construye el filtro de un recurso administrativo según su alcance maestro, de sucursal o de tenant. */
export function resourceScopedWhere(
  model: string,
  tenantId: number,
  activeBranchId: number | undefined | null,
): Record<string, unknown> {
  if (model === "product") return branchProductWhere(tenantId, activeBranchId);
  if (model === "inventoryStock") return activeBranchWhere(tenantId, activeBranchId);
  if (BRANCH_DIRECT_MODELS.has(model)) return activeBranchWhere(tenantId, activeBranchId);
  return { tenantId };
}

/** @summary Asegura la asignación (publicación/configuración) de un producto maestro en una sucursal. */
export async function ensureBranchProduct(tenantId: number, branchId: number, productId: number) {
  return prisma.branchProduct.upsert({
    where: { branchId_productId: { branchId, productId } },
    create: { tenantId, branchId, productId, active: true },
    update: { tenantId },
  });
}

/** @summary Asegura una categoría de la carta de la sucursal, creándola si aún no existe. */
export async function ensureBranchCategory(
  tenantId: number,
  branchId: number,
  name: string,
  description = name,
  imageUrl = CATEGORY_IMAGE_FALLBACK_FILE,
) {
  const slug = await uniqueCategorySlug(tenantId, name);
  return prisma.category.upsert({
    where: { tenantId_slug: { tenantId, slug } },
    create: { tenantId, branchId, name, slug, description, imageUrl, status: "published" },
    update: { tenantId },
  });
}

/** @summary Asegura la fila de stock de una sucursal para el producto maestro indicado. */
export async function ensureBranchStock(tenantId: number, branchId: number, productId: number) {
  return prisma.inventoryStock.upsert({
    where: { branchId_productId: { branchId, productId } },
    create: { tenantId, branchId, productId, tracked: false, current: 0 },
    update: {},
  });
}

/** @summary Valida que un registro exista y pertenezca al tenant + branch activa (0 = todas). */
export async function assertBranchOwned(
  tenantId: number,
  activeBranchId: number | undefined | null,
  record: { tenantId: number; branchId?: number | null } | null,
): Promise<boolean> {
  if (!record || record.tenantId !== tenantId) return false;
  if (activeBranchId && activeBranchId > 0 && record.branchId !== activeBranchId) return false;
  return true;
}
