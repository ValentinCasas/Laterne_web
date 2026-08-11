import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { requestOrigin } from "@/lib/domains";

/** @summary Indica a los buscadores qué contenido público pueden recorrer y dónde está el sitemap. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const baseUrl = requestOrigin(await headers()) ?? "";
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin/", "/api/", "/login", "/superadmin/"] },
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
