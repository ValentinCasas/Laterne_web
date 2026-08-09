import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import "maplibre-gl/dist/maplibre-gl.css";
import "sweetalert2/dist/sweetalert2.min.css";
import "./globals.css";

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
};

/** @summary Define la estructura global, los estilos compartidos y la navegación del sitio. */
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" data-scroll-behavior="smooth">
      <body>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
