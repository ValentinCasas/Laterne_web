import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

/**
 * Identidad pública de los negocios (GUID) de MenuClick.
 *
 * El slug es legible y cambiable; el GUID es la identidad inmutable que se usa
 * en las URLs administrativas (`/t/{guid}/{slug}/admin`, `/platform/clientes/{guid}/{slug}`).
 * La autorización siempre resuelve por GUID; el slug es solo la parte legible y
 * se valida contra el slug canónico del negocio (si cambió, se redirige).
 *
 * Las búsquedas se cachean brevemente (60 s) para no golpear la base en cada
 * request del proxy. Es el mismo patrón que usa host-gate para dominios.
 */

export type TenantIdentity = { id: number; slug: string; publicGuid: string };

const guidCache = new Map<string, { identity: TenantIdentity | null; expiresAt: number }>();
const slugCache = new Map<string, { guid: string | null; expiresAt: number }>();
const cacheTtlMilliseconds = 60_000;

/** @summary Genera un nuevo GUID público para un negocio. */
export function generatePublicGuid(): string {
  return randomUUID();
}

/** @summary Resuelve un negocio por su GUID público, con caché breve. */
export async function resolveTenantByGuid(guid: string): Promise<TenantIdentity | null> {
  const key = guid.trim().toLocaleLowerCase("es");
  if (!key) return null;
  const cached = guidCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.identity;

  let identity: TenantIdentity | null = null;
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { publicGuid: key },
      select: { id: true, slug: true, publicGuid: true },
    });
    identity = tenant ? { id: tenant.id, slug: tenant.slug, publicGuid: tenant.publicGuid } : null;
  } catch {
    identity = null;
  }

  guidCache.set(key, { identity, expiresAt: Date.now() + cacheTtlMilliseconds });
  return identity;
}

/** @summary Resuelve el GUID público de un negocio por su slug actual, con caché breve. */
export async function resolveGuidBySlug(slug: string): Promise<string | null> {
  const key = slug.trim().toLocaleLowerCase("es");
  if (!key) return null;
  const cached = slugCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.guid;

  let guid: string | null = null;
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: key },
      select: { publicGuid: true },
    });
    guid = tenant?.publicGuid ?? null;
  } catch {
    guid = null;
  }

  slugCache.set(key, { guid, expiresAt: Date.now() + cacheTtlMilliseconds });
  return guid;
}

/** @summary Invalida la caché de identidad de un negocio (slug o GUID cambiaron). */
export function invalidateTenantIdentity(slug?: string, guid?: string) {
  if (slug) slugCache.delete(slug.trim().toLocaleLowerCase("es"));
  if (guid) guidCache.delete(guid.trim().toLocaleLowerCase("es"));
}