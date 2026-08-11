import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requestOrigin } from "@/lib/domains";
import { getDefaultTenant, UnknownHostError } from "@/lib/tenant";

/** @summary Genera el índice de páginas públicas y fichas de producto actualmente publicadas. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = requestOrigin(await headers()) ?? "";
  let tenant;
  try {
    tenant = await getDefaultTenant();
  } catch (error) {
    if (!(error instanceof UnknownHostError)) throw error;
    tenant = null;
  }
  const products = tenant
    ? await prisma.product.findMany({
        where: { tenantId: tenant.id, status: "published" },
        select: { slug: true, updatedAt: true },
      })
    : [];
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/carta`, changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/para-negocios`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/funcionalidades`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/multi-sucursal`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/clientes`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/planes`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/solicitar-demo`, changeFrequency: "monthly", priority: 0.7 },
  ];
  return [
    ...(tenant
       ? staticPages.filter((page) => !["/para-negocios", "/funcionalidades", "/multi-sucursal", "/clientes", "/planes", "/solicitar-demo"].some((path) => page.url.endsWith(path)))
      : staticPages),
    ...products.map((product) => ({
      url: `${baseUrl}/productos/${product.slug}`,
      lastModified: product.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
