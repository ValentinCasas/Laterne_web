import { cache } from "react";
import { prisma } from "@/lib/prisma";

/** @summary Obtiene el negocio principal que conserva todos los datos históricos de Laterne. */
export const getDefaultTenant = cache(async () => {
  const tenant =
    (await prisma.tenant.findUnique({ where: { slug: "laterne" } })) ??
    (await prisma.tenant.findFirst({ where: { status: "active" }, orderBy: { id: "asc" } }));

  if (!tenant) throw new Error("No existe un negocio activo configurado");
  return tenant;
});

/** @summary Busca un negocio activo mediante su identificador público legible. */
export const getTenantBySlug = cache(async (slug: string) => {
  return prisma.tenant.findFirst({ where: { slug, status: "active" } });
});
