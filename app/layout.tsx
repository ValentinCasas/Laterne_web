import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Laterne", template: "%s · Laterne" },
  description: "Cerveza artesanal, cocina y encuentros en La Punta.",
  icons: { icon: "/images/banners/logo.ico" },
};

/** @summary Define la estructura global, los estilos compartidos y la navegación del sitio. */
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
