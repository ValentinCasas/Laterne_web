import type { Metadata, Viewport } from "next";
import type { CSSProperties } from "react";
import { headers } from "next/headers";
import { SiteHeader } from "@/components/site-header";
import { AnalyticsTracker } from "@/components/analytics-tracker";
import { PwaRegister } from "@/components/pwa-register";
import { CookieBanner } from "@/components/cookie-banner";
import { SiteFooter } from "@/components/site-footer";
import "maplibre-gl/dist/maplibre-gl.css";
import "sweetalert2/dist/sweetalert2.min.css";
import "./globals.css";
import { prisma } from "@/lib/prisma";
import { getDefaultTenant, UnknownHostError } from "@/lib/tenant";
import { classifyHost, requestOrigin } from "@/lib/domains";
import {
  defaultPalette,
  paletteCssVariables,
  paletteFromLegacy,
  type PaletteColors,
} from "@/lib/theme-palettes";
import {
  defaultMenuClickTheme,
  menuClickCssVariables,
  menuClickThemeFromRecord,
  type MenuClickTheme,
} from "@/lib/menuclick-theme";
import { MenuClickThemeProvider } from "@/components/platform/menuclick-theme-provider";

/** @summary Extiende el viewport hasta las areas seguras para posicionar correctamente la UI fija en moviles. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/** @summary Resuelve la experiencia y el negocio del host para el render de la solicitud. */
async function resolveRequestContext() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "";
  const routeKind = requestHeaders.get("x-menuclick-route-kind") ?? "";
  const hostKind = classifyHost(host).kind;
  const kind =
    routeKind === "tenant-public" || routeKind === "tenant-driver"
      ? "tenant"
      : routeKind === "tenant-admin" || routeKind === "tenant-auth"
        ? "app"
        : routeKind.startsWith("platform")
          ? "platform"
          : hostKind;

  let tenant: Awaited<ReturnType<typeof getDefaultTenant>> | null = null;
  let brand: Awaited<ReturnType<typeof prisma.brandSettings.findUnique>> | null = null;
  let palette: PaletteColors = defaultPalette;
  let menuTheme: MenuClickTheme = defaultMenuClickTheme;
  let platformSettings:
    | (Awaited<ReturnType<typeof prisma.platformSettings.findUnique>> & {
        activePalette?: Awaited<ReturnType<typeof prisma.platformPalette.findUnique>> | null;
      })
    | null = null;
  if (kind === "platform") {
    platformSettings = await prisma.platformSettings.findUnique({
      where: { id: 1 },
      include: { activePalette: true },
    });
    if (platformSettings?.activePalette) {
      menuTheme = menuClickThemeFromRecord(platformSettings.activePalette);
    }
  }
  if (kind === "tenant") {
    try {
      tenant = await getDefaultTenant();
      if (tenant) {
        brand = await prisma.brandSettings.findUnique({ where: { tenantId: tenant.id } });
        const activePalette = tenant.activePaletteId
          ? await prisma.themePalette.findFirst({
              where: { id: tenant.activePaletteId, tenantId: tenant.id },
            })
          : null;
        palette = activePalette
          ? { ...activePalette, baseMode: activePalette.baseMode === "light" ? "light" : "dark" }
          : brand
            ? paletteFromLegacy(brand.primaryColor, brand.secondaryColor, brand.backgroundColor)
            : defaultPalette;
      }
    } catch (error) {
      if (!(error instanceof UnknownHostError)) throw error;
    }
  }
  const branchSlug =
    requestHeaders.get("x-menuclick-branch-slug")?.trim().toLocaleLowerCase("es") || undefined;
  const originalPath = requestHeaders.get("x-menuclick-original-path") || "/";
  // Admin y Driver ofrecen navegación propia; el chrome público queda reservado
  // exclusivamente para carta, reservas y el resto de la experiencia pública.
  const privateSurface = routeKind === "tenant-admin" || routeKind === "tenant-driver";
  return {
    kind,
    tenant,
    brand,
    palette,
    menuTheme,
    platformSettings,
    branchSlug,
    originalPath,
    privateSurface,
  };
}

/** @summary Construye metadatos globales administrables para la experiencia resuelta por dominio. */
export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const { kind, tenant, brand, platformSettings } = await resolveRequestContext();
  const siteUrl = requestOrigin(requestHeaders);

  if (!tenant) {
    const platform = kind === "platform";
    return {
      metadataBase: siteUrl ? new URL(siteUrl) : undefined,
      title: {
        default: platform ? "MenuClick | Operación gastronómica conectada" : "MenuClick",
        template: `%s · ${platform ? "MenuClick" : "MenuClick"}`,
      },
      description: platform
        ? "Carta digital, pedidos, reservas, stock y sucursales para negocios gastronómicos."
        : "Carta digital, pedidos, reservas y administración gastronómica.",
      manifest: "/manifest.webmanifest",
      icons: { icon: platformSettings?.faviconUrl || "/favicon.ico" },
      alternates: siteUrl ? { canonical: siteUrl } : undefined,
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
  const { kind, tenant, brand, palette, menuTheme, branchSlug, originalPath, privateSurface } =
    await resolveRequestContext();
  const style = {
    ...paletteCssVariables(palette),
    ...(kind === "platform" ? menuClickCssVariables(menuTheme) : {}),
    colorScheme: palette.baseMode,
    "--brand-font": brand?.fontFamily ?? "Inter",
    "--brand-button-radius":
      brand?.buttonStyle === "pill" ? "999px" : brand?.buttonStyle === "square" ? ".25rem" : ".75rem",
    "--brand-card-radius":
      brand?.cardStyle === "flat" ? ".25rem" : brand?.cardStyle === "bordered" ? ".75rem" : "1rem",
  } as CSSProperties;
  const name = tenant?.name ?? "MenuClick";

  return (
    <html lang={tenant?.locale.split("-")[0] ?? "es"} data-scroll-behavior="smooth">
      <body
        className={kind === "platform" ? "menuclick-theme" : tenant ? "tenant-theme" : undefined}
        style={style}
      >
        {tenant && !privateSurface && (
          <SiteHeader
            brandName={name}
            logoUrl={brand?.logoUrl}
            tenantSlug={tenant.slug}
            branchSlug={branchSlug}
          />
        )}
        {tenant && !privateSurface && <AnalyticsTracker analyticsId={brand?.analyticsId} metaPixelId={brand?.metaPixelId} />}
        <PwaRegister />
        {tenant && !privateSurface && <CookieBanner />}
        {kind === "platform" ? (
          <MenuClickThemeProvider initialTheme={menuTheme}>{children}</MenuClickThemeProvider>
        ) : (
          children
        )}
        {tenant && !privateSurface && (
          <SiteFooter
            businessName={name}
            tenantSlug={tenant.slug}
            branchSlug={branchSlug}
            visiblePath={originalPath}
          />
        )}
      </body>
    </html>
  );
}
