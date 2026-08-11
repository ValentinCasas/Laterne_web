import type { Metadata } from "next";
import type { CSSProperties } from "react";
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

/** @summary Construye metadatos globales administrables para el tenant resuelto por dominio. */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const tenant = await getDefaultTenant();
    const [brand, seo] = await Promise.all([
      prisma.brandSettings.findUnique({ where: { tenantId: tenant.id } }),
      prisma.seoPage.findUnique({ where: { tenantId_path: { tenantId: tenant.id, path: "/" } } }),
    ]);
    const title = seo?.title || tenant.name;
    const description = seo?.description || "Carta digital, pedidos, reservas y experiencias gastronómicas.";
    const image = seo?.ogImageUrl || "/images/banners/new_banner2_750.jpg";
    return {
      metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
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
  } catch (error) {
    if (error instanceof UnknownHostError) {
      return {
        metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
        title: { default: "Laterne", template: "%s · Laterne" },
        description: "Carta digital, pedidos, reservas y administración gastronómica.",
        manifest: "/manifest.webmanifest",
      };
    }
    throw error;
  }
}

/** @summary Define la estructura global, los estilos compartidos y la navegación del sitio. */
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  let tenant: Awaited<ReturnType<typeof getDefaultTenant>> | null = null;
  let brand: Awaited<ReturnType<typeof prisma.brandSettings.findUnique>> | null = null;
  try {
    tenant = await getDefaultTenant();
    brand = await prisma.brandSettings.findUnique({ where: { tenantId: tenant.id } });
  } catch (error) {
    if (!(error instanceof UnknownHostError)) throw error;
  }
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
  const name = tenant?.name ?? "Laterne";
  return (
    <html lang={tenant?.locale.split("-")[0] ?? "es"} data-scroll-behavior="smooth">
      <body style={style}>
        <SiteHeader brandName={name} logoUrl={brand?.logoUrl} />
        <AnalyticsTracker analyticsId={brand?.analyticsId} metaPixelId={brand?.metaPixelId} />
        <PwaRegister />
        <CookieBanner />
        {children}
        <SiteFooter businessName={name} />
      </body>
    </html>
  );
}
