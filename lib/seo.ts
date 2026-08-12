import type { Metadata } from "next";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requestOrigin } from "@/lib/domains";
import { requestRouteContext } from "@/lib/request-route-context";
import { getDefaultTenant, UnknownHostError } from "@/lib/tenant";

/** @summary Combina valores SEO administrados con la URL visible canónica de la solicitud. */
export async function managedPageMetadata(
  path: string,
  fallbackTitle: string,
  fallbackDescription: string,
): Promise<Metadata> {
  const requestHeaders = await headers();
  const origin = requestOrigin(requestHeaders);
  const route = await requestRouteContext();
  const visiblePath = route.originalPath?.split("?")[0] || path;
  let tenant;
  try {
    tenant = await getDefaultTenant();
  } catch (error) {
    if (!(error instanceof UnknownHostError)) throw error;
    return {
      title: fallbackTitle,
      description: fallbackDescription,
      alternates: origin ? { canonical: `${origin}${visiblePath}` } : undefined,
    };
  }
  const page = await prisma.seoPage.findUnique({ where: { tenantId_path: { tenantId: tenant.id, path } } });
  const title = page?.title || fallbackTitle;
  const description = page?.description || fallbackDescription;
  return {
    title,
    description,
    alternates: page?.canonical
      ? { canonical: page.canonical }
      : origin
        ? { canonical: `${origin}${visiblePath}` }
        : undefined,
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
