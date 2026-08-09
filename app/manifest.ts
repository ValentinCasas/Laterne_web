import type { MetadataRoute } from "next";

/** @summary Describe la identidad instalable básica del sitio para navegadores compatibles. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Laterne",
    short_name: "Laterne",
    description: "Carta, eventos, horarios y pedidos de Laterne.",
    start_url: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#ec4899",
    icons: [{ src: "/images/banners/logo.ico", sizes: "any", type: "image/x-icon" }],
  };
}
