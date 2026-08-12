import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { classifyHost } from "@/lib/domains";
import { getDefaultTenant, UnknownHostError } from "@/lib/tenant";
import { defaultMenuClickTheme } from "@/lib/menuclick-theme";
import { defaultPalette } from "@/lib/theme-palettes";

/** @summary Define la instalación de MenuClick como aplicación web y sus accesos rápidos. */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "";
  const kind = classifyHost(host).kind;
  let name = "MenuClick";
  let primary = defaultMenuClickTheme.primary;
  let background = defaultMenuClickTheme.background;
  let icon = "/favicon.ico";
  if (kind === "platform") {
    const settings = await prisma.platformSettings.findUnique({ where: { id: 1 }, include: { activePalette: true } });
    name = settings?.name || name;
    primary = settings?.activePalette?.primary || primary;
    background = settings?.activePalette?.background || background;
    icon = settings?.faviconUrl || icon;
  } else if (kind === "tenant") {
    try {
      const tenant = await getDefaultTenant();
      const [brand, palette] = await Promise.all([prisma.brandSettings.findUnique({ where: { tenantId: tenant.id } }), tenant.activePaletteId ? prisma.themePalette.findUnique({ where: { id: tenant.activePaletteId } }) : null]);
      name = tenant.name;
      primary = palette?.primary || brand?.primaryColor || defaultPalette.primary;
      background = palette?.background || brand?.backgroundColor || defaultPalette.background;
      icon = brand?.faviconUrl || icon;
    } catch (error) {
      if (!(error instanceof UnknownHostError)) throw error;
    }
  }
  return {
    name,
    short_name: name,
    description: "Carta, pedidos, reservas y administración gastronómica.",
    start_url: "/",
    display: "standalone",
    background_color: background,
    theme_color: primary,
    lang: "es-AR",
    orientation: "portrait-primary",
    icons: [
      { src: icon, sizes: "any", purpose: "any" },
      { src: icon, sizes: "any", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Conocer MenuClick",
        short_name: "Inicio",
        url: "/",
        icons: [{ src: "/images/banners/brand.png", sizes: "any" }],
      },
      {
        name: "Ver planes",
        short_name: "Planes",
        url: "/planes",
        icons: [{ src: "/images/banners/brand.png", sizes: "any" }],
      },
      {
        name: "Ingresar",
        short_name: "Login",
        url: "/login",
        icons: [{ src: "/images/banners/brand.png", sizes: "any" }],
      },
    ],
  };
}
