import { prisma } from "@/lib/prisma";
import { classifyHost, type HostKind } from "@/lib/domains";
import { publicTenantWhere } from "@/lib/subscription-access";

const customDomainCache = new Map<string, { slug: string | null; expiresAt: number }>();
const tenantSlugCache = new Map<string, { exists: boolean; expiresAt: number }>();
const cacheTtlMilliseconds = 60_000;

/** @summary Resuelve el negocio de un dominio personalizado con una caché breve para evitar consultas repetidas. */
async function lookupCustomDomain(host: string): Promise<string | null> {
  const cached = customDomainCache.get(host);
  if (cached && cached.expiresAt > Date.now()) return cached.slug;

  let slug: string | null = null;
  try {
    const settings = await prisma.brandSettings.findFirst({
      where: { customDomain: host, tenant: publicTenantWhere() },
      select: { tenant: { select: { slug: true } } },
    });
    slug = settings?.tenant.slug ?? null;
  } catch {
    slug = null;
  }

  customDomainCache.set(host, { slug, expiresAt: Date.now() + cacheTtlMilliseconds });
  return slug;
}

/** @summary Comprueba que exista el negocio de un subdominio del producto para no exponer hosts vacíos. */
async function tenantSlugExists(slug: string): Promise<boolean> {
  const cached = tenantSlugCache.get(slug);
  if (cached && cached.expiresAt > Date.now()) return cached.exists;

  let exists = false;
  try {
    exists = Boolean(
      await prisma.tenant.findFirst({ where: { slug, ...publicTenantWhere() }, select: { id: true } }),
    );
  } catch {
    exists = false;
  }

  tenantSlugCache.set(slug, { exists, expiresAt: Date.now() + cacheTtlMilliseconds });
  return exists;
}

/** @summary Clasifica el host para el enrutamiento de experiencias, incluyendo dominios personalizados. */
export async function resolveHostKind(host: string): Promise<{ kind: HostKind; slug?: string }> {
  const classified = classifyHost(host);

  if (classified.kind === "tenant" && classified.slug) {
    const exists = await tenantSlugExists(classified.slug);
    return exists ? classified : { kind: "unknown" };
  }
  if (classified.kind !== "unknown") return classified;

  const slug = await lookupCustomDomain(host);
  return slug ? { kind: "tenant", slug } : { kind: "unknown" };
}
