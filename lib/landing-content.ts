import type { PublicEvent } from "@/components/home/event-grid";

/**
 * Constantes, defaults y tipos compartidos del contenido de landing.
 * Este módulo NO importa node:fs, node:path ni prisma: puede importarse
 * desde componentes del cliente (vista previa del editor) y del servidor (páginas públicas).
 */
/** @summary Cervezas por defecto del carrusel (imágenes reales existentes en `public/images/banners`). */
export const LANDING_BEER_DEFAULTS = [
  "/images/banners/apa.png",
  "/images/banners/birra.png",
  "/images/banners/doble-ipa.png",
];

export const LANDING_STORY_DEFAULTS = [
  { title: "Bienvenidos", subtitle: "Un lugar para volver", image: "/images/banners/new_banner2_750.jpg" },
  {
    title: "Hecho para disfrutar",
    subtitle: "Productos, eventos y comunidad.",
    image: "/images/banners/new_banner2_750.jpg",
  },
];

export const LANDING_HERO_SUBTITLE_DEFAULT =
  "Amistad, momentos compartidos, cocina y cerveza artesanal. Una casa simple para disfrutar con quienes elegimos.";

export const LANDING_IMAGE_PATH_RE = /\/images\/.+\.(?:jpe?g|png|webp|avif)$/i;

export type LandingStory = { title: string; subtitle: string; image: string };

export type LandingTestimonialSlide = { id: number; description: string; date: string; avatar: string };

export type LandingHeroButtonConfig = { label: string; href: string; visible: boolean };

export type LandingHeroConfig = {
  eyebrow: string;
  title: string;
  highlight: string;
  description: string;
  imageUrl: string | null;
  primaryButton: LandingHeroButtonConfig;
  secondaryButton: LandingHeroButtonConfig;
};

export const LANDING_HERO_DEFAULTS: LandingHeroConfig = {
  eyebrow: "",
  title: "",
  highlight: "birra.",
  description: LANDING_HERO_SUBTITLE_DEFAULT,
  imageUrl: null,
  primaryButton: { label: "Explorar la carta", href: "/carta", visible: true },
  secondaryButton: { label: "Ver eventos", href: "#eventos", visible: true },
};

/** @summary Normaliza la configuración guardada del hero combinándola con fallbacks y valores heredados. */
export function resolveLandingHeroConfig(
  raw: unknown,
  fallbacks: {
    tenantName: string;
    legacyTitle: string;
    legacySubtitle: string;
    legacyImageUrl: string | null;
  },
): LandingHeroConfig {
  const source =
    raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");
  const button = (value: unknown, fallback: LandingHeroButtonConfig): LandingHeroButtonConfig => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const entry = value as Record<string, unknown>;
      return {
        label: text(entry.label, 60) || fallback.label,
        href:
          typeof entry.href === "string" && entry.href.trim()
            ? entry.href.trim().slice(0, 300)
            : fallback.href,
        visible: typeof entry.visible === "boolean" ? entry.visible : fallback.visible,
      };
    }
    return fallback;
  };
  return {
    eyebrow: text(source.eyebrow, 120) || fallbacks.tenantName,
    title: text(source.title, 220) || fallbacks.legacyTitle,
    highlight:
      typeof source.highlight === "string" ? text(source.highlight, 80) : LANDING_HERO_DEFAULTS.highlight,
    description: text(source.description, 500) || fallbacks.legacySubtitle,
    imageUrl:
      typeof source.imageUrl === "string" && source.imageUrl.trim()
        ? source.imageUrl.trim().slice(0, 500)
        : fallbacks.legacyImageUrl,
    primaryButton: button(source.primaryButton, LANDING_HERO_DEFAULTS.primaryButton),
    secondaryButton: button(source.secondaryButton, LANDING_HERO_DEFAULTS.secondaryButton),
  };
}

export type OpeningHourGroup = {
  days: string[];
  morningStartTime: Date | null;
  morningEndTime: Date | null;
  eveningStartTime: Date | null;
  eveningEndTime: Date | null;
};

export type TenantLandingData = {
  displayName: string;
  hero: LandingHeroConfig;
  heroTitle: string;
  heroSubtitle: string;
  heroImageUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  beers: string[];
  stories: LandingStory[];
  events: PublicEvent[];
  testimonials: LandingTestimonialSlide[];
  openingGroups: OpeningHourGroup[];
  phone: string;
  email: string | null;
  address: string;
  instagramUrl: string | null;
  facebookUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  hasMap: boolean;
};

/** @summary Secciones editables del inicio, compartidas entre el editor y el renderizador público. */
export type LandingSectionKey = "hero" | "events" | "beers" | "stories" | "testimonials" | "map" | "contact";
