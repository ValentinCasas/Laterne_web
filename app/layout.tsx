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
import { getDefaultTenant } from "@/lib/tenant";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "Laterne", template: "%s · Laterne" },
  description: "Cerveza artesanal, cocina y encuentros en La Punta.",
  icons: { icon: "/images/banners/logo.ico" },
  openGraph: {
    title: "Laterne",
    description: "Cerveza artesanal, cocina y encuentros en La Punta.",
    type: "website",
    locale: "es_AR",
    images: ["/images/banners/new_banner2_750.jpg"],
  },
  twitter: { card: "summary_large_image" },
  manifest: "/manifest.webmanifest",
};

/** @summary Define la estructura global, los estilos compartidos y la navegación del sitio. */
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const tenant = await getDefaultTenant();
  const brand = await prisma.brandSettings.findUnique({ where: { tenantId: tenant.id } });
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
  return (
    <html lang="es" data-scroll-behavior="smooth">
      <body style={style}>
        <SiteHeader brandName={tenant.name} logoUrl={brand?.logoUrl} />
        <AnalyticsTracker />
        <PwaRegister />
        <CookieBanner />
        {children}
        <SiteFooter businessName={tenant.name} />
      </body>
    </html>
  );
}
