import { prisma } from "@/lib/prisma";

type LimitKind = "products" | "users" | "storageMb" | "branches";

/** @summary Recupera un límite positivo desde la configuración de suscripción o informa que es ilimitado. */
function configuredLimit(value: unknown, kind: LimitKind) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
  const limit = Number((value as Record<string, unknown>)[kind] ?? 0);
  return Number.isFinite(limit) && limit > 0 ? limit : 0;
}

/** @summary Impide superar los límites comerciales configurados antes de crear datos o almacenar archivos. */
export async function ensureTenantCapacity(tenantId: number, kind: LimitKind, increment = 1) {
  const subscription = await prisma.tenantSubscription.findUnique({
    where: { tenantId },
    select: { limits: true },
  });
  const limit = configuredLimit(subscription?.limits, kind);
  if (!limit) return;

  let current = 0;
  if (kind === "products") current = await prisma.product.count({ where: { tenantId } });
  if (kind === "users") current = await prisma.tenantMembership.count({ where: { tenantId } });
  if (kind === "branches") current = await prisma.branch.count({ where: { tenantId } });
  if (kind === "storageMb") {
    const storage = await prisma.mediaAsset.aggregate({
      where: { tenantId },
      _sum: { sizeBytes: true },
    });
    current = Number(storage._sum.sizeBytes ?? 0) / 1_000_000;
    increment /= 1_000_000;
  }

  if (current + increment > limit) {
    const label =
      kind === "products"
        ? "productos"
        : kind === "users"
          ? "usuarios"
          : kind === "branches"
            ? "sucursales"
            : "almacenamiento en MB";
    throw new Error(`Se alcanzó el límite de ${label} del plan actual`);
  }
}
