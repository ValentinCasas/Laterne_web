import { prisma } from "@/lib/prisma";

/** @summary Convierte un texto en un identificador breve y seguro para utilizarlo dentro de una URL. */
export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
}

/** @summary Genera un slug de producto que no se repita dentro del mismo negocio. */
export async function uniqueProductSlug(tenantId: number, value: string, excludeId?: number) {
  const base = slugify(value) || "producto";
  let candidate = base;
  let suffix = 2;

  while (
    await prisma.product.findFirst({
      where: { tenantId, slug: candidate, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    })
  ) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

/** @summary Genera un slug de categoría único dentro de la carta del negocio. */
export async function uniqueCategorySlug(tenantId: number, value: string, excludeId?: number) {
  const base = slugify(value) || "categoria";
  let candidate = base;
  let suffix = 2;

  while (
    await prisma.category.findFirst({
      where: { tenantId, slug: candidate, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    })
  ) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

/** @summary Genera un slug de promoción único dentro del negocio sin colisionar con registros existentes. */
export async function uniquePromotionSlug(tenantId: number, value: string, excludeId?: number) {
  const base = slugify(value) || "promocion";
  let candidate = base;
  let suffix = 2;

  while (
    await prisma.promotion.findFirst({
      where: { tenantId, slug: candidate, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    })
  ) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}
