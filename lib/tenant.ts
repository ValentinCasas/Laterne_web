import { cache } from "react";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

/** @summary Obtiene el negocio principal que conserva todos los datos históricos de Laterne. */
export const getDefaultTenant = cache(async () => {
  const requestHeaders = await headers();
  const requestHost = (requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "")
    .split(",")[0]
    .trim()
    .split(":")[0]
    .toLocaleLowerCase("es");
  if (requestHost && !["localhost", "127.0.0.1"].includes(requestHost)) {
    const customDomain = await prisma.brandSettings.findFirst({
      where: { customDomain: requestHost, tenant: { status: "active" } },
      select: { tenant: true },
    });
    if (customDomain) return customDomain.tenant;

    const rootDomain = process.env.ROOT_DOMAIN?.toLocaleLowerCase("es");
    if (rootDomain && requestHost.endsWith(`.${rootDomain}`)) {
      const slug = requestHost
        .slice(0, -(rootDomain.length + 1))
        .split(".")
        .at(-1);
      if (slug) {
        const tenant = await prisma.tenant.findFirst({ where: { slug, status: "active" } });
        if (tenant) return tenant;
      }
    }
  }
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
