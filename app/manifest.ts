import type { MetadataRoute } from "next";

/** @summary Define la instalación de MenuClick como aplicación web y sus accesos rápidos. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MenuClick",
    short_name: "MenuClick",
    description: "Carta, pedidos, reservas y administración gastronómica.",
    start_url: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#ec4899",
    lang: "es-AR",
    orientation: "portrait-primary",
    icons: [
      { src: "/images/banners/brand.png", sizes: "any", type: "image/png", purpose: "any" },
      { src: "/images/banners/brand.png", sizes: "any", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Abrir carta",
        short_name: "Carta",
        url: "/carta",
        icons: [{ src: "/images/banners/brand.png", sizes: "any" }],
      },
      {
        name: "Ver pedido",
        short_name: "Pedido",
        url: "/pedido",
        icons: [{ src: "/images/banners/brand.png", sizes: "any" }],
      },
      {
        name: "Panel",
        short_name: "Admin",
        url: "/admin",
        icons: [{ src: "/images/banners/brand.png", sizes: "any" }],
      },
    ],
  };
}
