import type { MetadataRoute } from "next";

/** @summary Indica a los buscadores qué contenido público pueden recorrer y dónde está el sitemap. */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin/", "/api/", "/login"] },
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
