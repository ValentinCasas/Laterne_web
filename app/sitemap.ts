import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { getDefaultTenant } from "@/lib/tenant";

/** @summary Genera el índice de páginas públicas y fichas de producto actualmente publicadas. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const tenant = await getDefaultTenant();
  const products = await prisma.product.findMany({
    where: { tenantId: tenant.id, status: "published" },
    select: { slug: true, updatedAt: true },
  });
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/carta`, changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/para-negocios`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/planes`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/solicitar-demo`, changeFrequency: "monthly", priority: 0.7 },
  ];
  return [
    ...staticPages,
    ...products.map((product) => ({
      url: `${baseUrl}/productos/${product.slug}`,
      lastModified: product.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
