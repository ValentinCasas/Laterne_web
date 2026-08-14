import type { PublicEvent } from "@/components/home/event-grid";

/**
 * Constantes, defaults y tipos compartidos del contenido de landing.
 * Este módulo NO importa node:fs, node:path ni prisma: puede importarse
 * desde componentes client (preview del editor) y server (páginas públicas).
 */
export const LANDING_BEER_DEFAULTS = [
  "/images/products/cerveza-artesanal.jpg",
  "/images/products/cerveza-lager.jpg",
  "/images/products/cerveza-ipa.jpg",
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

export type OpeningHourGroup = {
  days: string[];
  morningStartTime: Date | null;
  morningEndTime: Date | null;
  eveningStartTime: Date | null;
  eveningEndTime: Date | null;
};

export type TenantLandingData = {
  displayName: string;
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
