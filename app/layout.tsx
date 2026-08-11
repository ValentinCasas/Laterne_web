import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { headers } from "next/headers";
import { SiteHeader } from "@/components/site-header";
import { AnalyticsTracker } from "@/components/analytics/tracker";
import { PwaRegister } from "@/components/pwa-register";
import { CookieBanner } from "@/components/cookie-banner";
import { SiteFooter } from "@/components/site-footer";
import "maplibre-gl/dist/maplibre-gl.css";
import "sweetalert2/dist/sweetalert2.min.css";
import "./globals.css";
import { prisma } from "@/lib/prisma";
import { getDefaultTenant, UnknownHostError } from "@/lib/tenant";
import { classifyHost, requestOrigin } from "@/lib/domains";

/** @summary Resuelve la experiencia y el negocio del host para el render de la solicitud. */
async function resolveRequestContext() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "";
  const { kind } = classifyHost(host);

  let tenant: Awaited<ReturnType<typeof getDefaultTenant>> | null = null;
  let brand: Awaited<ReturnType<typeof prisma.brandSettings.findUnique>> | null = null;
  if (kind === "tenant") {
    try {
      tenant = await getDefaultTenant();
      if (tenant) brand = await prisma.brandSettings.findUnique({ where: { tenantId: tenant.id } });
    } catch (error) {
      if (!(error instanceof UnknownHostError)) throw error;
    }
  }
  return { kind, tenant, brand };
}

/** @summary Construye metadatos globales administrables para la experiencia resuelta por dominio. */
export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const { kind, tenant, brand } = await resolveRequestContext();
  const siteUrl = requestOrigin(requestHeaders);

  if (!tenant) {
    const platform = kind === "platform";
    return {
      metadataBase: siteUrl ? new URL(siteUrl) : undefined,
      title: {
        default: platform ? "MenuClick" : "Laterne",
        template: `%s · ${platform ? "MenuClick" : "Laterne"}`,
      },
      description: platform
        ? "La plataforma de cartas digitales, pedidos y reservas."
        : "Carta digital, pedidos, reservas y administración gastronómica.",
      manifest: "/manifest.webmanifest",
      robots: kind === "unknown" ? { index: false, follow: false } : undefined,
    };
  }

  const [seo] = await Promise.all([
    prisma.seoPage.findUnique({ where: { tenantId_path: { tenantId: tenant.id, path: "/" } } }),
  ]);
  const title = seo?.title || tenant.name;
  const description = seo?.description || "Carta digital, pedidos, reservas y experiencias gastronómicas.";
  const image = seo?.ogImageUrl || "/images/banners/new_banner2_750.jpg";
  return {
    metadataBase: siteUrl ? new URL(siteUrl) : undefined,
    title: { default: title, template: `%s · ${tenant.name}` },
    description,
    alternates: seo?.canonical ? { canonical: seo.canonical } : undefined,
    robots: seo?.noIndex ? { index: false, follow: false } : undefined,
    icons: { icon: brand?.faviconUrl || "/images/banners/logo.ico" },
    verification: brand?.searchConsoleId ? { google: brand.searchConsoleId } : undefined,
    openGraph: {
      title,
      description,
      type: "website",
      locale: tenant.locale.replace("-", "_"),
      images: [image],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
    manifest: "/manifest.webmanifest",
  };
}

/** @summary Define la estructura global y solo añade la navegación pública cuando existe un negocio. */
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { kind, tenant, brand } = await resolveRequestContext();
  const style = {
    "--brand-primary": brand?.primaryColor ?? "#ec4899",
    "--brand-secondary": brand?.secondaryColor ?? "#f5c542",
    "--brand-background": brand?.backgroundColor ?? "#09090b",
    "--brand-font": brand?.fontFamily ?? "Inter",
    "--brand-button-radius":
      brand?.buttonStyle === "pill" ? "999px" : brand?.buttonStyle === "square" ? ".25rem" : ".75rem",
    "--brand-card-radius":
      brand?.cardStyle === "flat" ? ".25rem" : brand?.cardStyle === "bordered" ? ".75rem" : "1rem",
  } as CSSProperties;
  const name = tenant?.name ?? (kind === "platform" ? "MenuClick" : "Laterne");

  return (
    <html lang={tenant?.locale.split("-")[0] ?? "es"} data-scroll-behavior="smooth">
      <body style={style}>
        {tenant && <SiteHeader brandName={name} logoUrl={brand?.logoUrl} />}
        {tenant && <AnalyticsTracker analyticsId={brand?.analyticsId} metaPixelId={brand?.metaPixelId} />}
        <PwaRegister />
        {tenant && <CookieBanner />}
        {children}
        {tenant && <SiteFooter businessName={name} />}
      </body>
    </html>
  );
}
