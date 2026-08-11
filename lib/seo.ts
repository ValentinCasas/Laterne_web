import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getDefaultTenant, UnknownHostError } from "@/lib/tenant";

/** @summary Combina valores SEO administrados por ruta con textos seguros definidos como respaldo. */
export async function managedPageMetadata(
  path: string,
  fallbackTitle: string,
  fallbackDescription: string,
): Promise<Metadata> {
  let tenant;
  try {
    tenant = await getDefaultTenant();
  } catch (error) {
    if (!(error instanceof UnknownHostError)) throw error;
    return { title: fallbackTitle, description: fallbackDescription };
  }
  const page = await prisma.seoPage.findUnique({ where: { tenantId_path: { tenantId: tenant.id, path } } });
  const title = page?.title || fallbackTitle;
  const description = page?.description || fallbackDescription;
  return {
    title,
    description,
    alternates: page?.canonical ? { canonical: page.canonical } : undefined,
    robots: page?.noIndex ? { index: false, follow: false } : undefined,
    openGraph: { title, description, images: page?.ogImageUrl ? [page.ogImageUrl] : undefined },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: page?.ogImageUrl ? [page.ogImageUrl] : undefined,
    },
  };
}
