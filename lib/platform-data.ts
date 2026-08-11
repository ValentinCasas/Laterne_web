import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/format";
import { publicTenantUrl } from "@/lib/domains";

/** @summary Centraliza la consulta multi-tenant utilizada por las vistas de supervisión de MenuClick. */
export async function platformTenants() {
  const [tenants, storage] = await Promise.all([
    prisma.tenant.findMany({ include: { subscription: { include: { plan: { select: { id: true, name: true } } } }, brandSettings: { select: { customDomain: true } }, activePalette: { select: { id: true, name: true, presetKey: true, baseMode: true } }, branches: { select: { id: true, name: true, active: true, isPrimary: true, address: true, _count: { select: { orders: true, membershipAccess: true, inventoryStocks: true } } }, orderBy: [{ isPrimary: "desc" }, { name: "asc" }] }, platformPayments: { select: { amount: true, currency: true, paidAt: true, method: true, reference: true }, orderBy: { paidAt: "desc" }, take: 3 }, _count: { select: { products: true, memberships: true, customerOrders: true, reservations: true, mediaAssets: true, errorLogs: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.mediaAsset.groupBy({ by: ["tenantId"], _sum: { sizeBytes: true } }),
  ]);
  const storageByTenant = new Map(storage.map((item) => [item.tenantId, item._sum.sizeBytes ?? 0]));
  return tenants.map((tenant) => ({ ...serialize(tenant), publicUrl: publicTenantUrl(tenant.slug, tenant.brandSettings?.customDomain), storageBytes: Number(storageByTenant.get(tenant.id) ?? 0) }));
}
