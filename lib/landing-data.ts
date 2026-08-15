import { readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { time } from "@/lib/format";
import {
  LANDING_BEER_DEFAULTS,
  LANDING_HERO_SUBTITLE_DEFAULT,
  LANDING_IMAGE_PATH_RE,
  LANDING_STORY_DEFAULTS,
  type LandingStory,
  type LandingTestimonialSlide,
  type OpeningHourGroup,
  type TenantLandingData,
  resolveLandingHeroConfig,
} from "@/lib/landing-content";
import { prisma } from "@/lib/prisma";

export type { LandingStory, LandingTestimonialSlide, TenantLandingData } from "@/lib/landing-content";

/**
 * @summary Verifica que una URL pública de imagen exista en `public/`.
 * Solo acepta rutas `/images/...` con extensión de imagen y rechaza segmentos `..`
 * para evitar path traversal. Se usa para no emitir `<img>` rotos en la landing.
 */
export function publicImageExists(url: string): boolean {
  if (!LANDING_IMAGE_PATH_RE.test(url) || url.includes("..")) return false;
  return existsSync(path.join(process.cwd(), "public", url.replace(/^\/+/, "")));
}

/** @summary Deduplica y descarta URLs de imagen inexistentes, usando defaults reales si queda vacío. */
export function resolveLandingBeers(source: string[]): string[] {
  const available = [...new Set(source)].filter(publicImageExists);
  if (available.length > 0) return available;
  return [...new Set(LANDING_BEER_DEFAULTS)].filter(publicImageExists);
}

/** @summary Combina los turnos de un grupo horario en una descripción legible. */
export function formatOpeningHours(group: OpeningHourGroup) {
  const parts: string[] = [];
  const morning = time(group.morningStartTime);
  const morningEnd = time(group.morningEndTime);
  const evening = time(group.eveningStartTime);
  const eveningEnd = time(group.eveningEndTime);
  if (morning || morningEnd) parts.push(`${morning || "—"} a ${morningEnd || "—"}`);
  if (evening || eveningEnd) parts.push(`${evening || "—"} a ${eveningEnd || "—"}`);
  return parts.join(" · ") || "Consultar horarios";
}

const pickAvatar = (avatars: string[], seed: number) =>
  avatars[(seed * 37) % avatars.length] ?? "avatar_profile_default.png";

/**
 * @summary Fuente única de verdad del contenido de la landing pública del negocio.
 * Todo lo que edita el Editor de landing (BrandSettings) se resuelve acá y tanto
 * la página pública como la vista previa del editor consumen exactamente los
 * mismos valores y defaults.
 */
export async function loadTenantLandingData(tenant: {
  id: number;
  name: string;
}): Promise<TenantLandingData> {
  const now = new Date();
  const primaryBranch = await prisma.branch.findFirst({
    where: { tenantId: tenant.id, active: true },
    orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
    select: { id: true },
  });
  const branchId = primaryBranch?.id;
  const branchWhere = branchId ? { branchId } : {};

  const [business, brand, events, testimonials, avatarFiles, eventImageFiles, hours] =
    await Promise.all([
      prisma.businessInfo.findUnique({ where: { tenantId: tenant.id } }),
      prisma.brandSettings.findUnique({ where: { tenantId: tenant.id } }),
      prisma.event.findMany({
        where: {
          tenantId: tenant.id,
          ...branchWhere,
          OR: [{ status: "published" }, { status: "scheduled", publishAt: { lte: now } }],
        },
        orderBy: [{ date: "desc" }, { id: "desc" }],
      }),
      prisma.testimonial.findMany({
        where: {
          tenantId: tenant.id,
          ...branchWhere,
          state: true,
          moderationStatus: "approved",
        },
        orderBy: { date: "desc" },
        take: 12,
      }),
      readdir(path.join(process.cwd(), "public", "images", "avatars_defect")),
      readdir(path.join(process.cwd(), "public", "images", "images_event")),
      prisma.openingHour.findMany({
        where: { tenantId: tenant.id, ...branchWhere },
        orderBy: { id: "asc" },
      }),
    ]);

  const stored =
    brand?.landingSections &&
    typeof brand.landingSections === "object" &&
    !Array.isArray(brand.landingSections)
      ? (brand.landingSections as { beerImages?: unknown; stories?: unknown; hero?: unknown })
      : {};
  const sectionsBeerImages = Array.isArray(stored.beerImages)
    ? stored.beerImages.filter((source): source is string => typeof source === "string" && !!source.trim())
    : [];
  const sectionsStories = Array.isArray(stored.stories)
    ? stored.stories.filter((slide): slide is LandingStory => !!slide && typeof slide === "object")
    : [];

  const heroTitle =
    typeof brand?.heroTitle === "string" && brand.heroTitle.trim()
      ? brand.heroTitle
      : `${tenant.name} es`;
  const heroSubtitle =
    typeof brand?.heroSubtitle === "string" && brand.heroSubtitle.trim()
      ? brand.heroSubtitle
      : LANDING_HERO_SUBTITLE_DEFAULT;
  const heroImageUrl = brand?.heroImageUrl || null;
  const beers = resolveLandingBeers(sectionsBeerImages.length ? sectionsBeerImages : LANDING_BEER_DEFAULTS);
  const stories = (sectionsStories.length ? sectionsStories : LANDING_STORY_DEFAULTS).map(
    (slide): LandingStory => ({
      title: typeof slide.title === "string" && slide.title.trim() ? slide.title : tenant.name,
      subtitle:
        typeof slide.subtitle === "string" && slide.subtitle.trim()
          ? slide.subtitle
          : "Hecho para disfrutar.",
      image:
        typeof slide.image === "string" && slide.image.trim()
          ? slide.image
          : LANDING_STORY_DEFAULTS[0].image,
    }),
  );

  const eventImages = new Set(eventImageFiles);
  const uniqueEvents = new Map<string, (typeof events)[number]>();
  for (const event of events) {
    const key = [
      event.name.trim().toLocaleLowerCase("es"),
      event.description.trim().toLocaleLowerCase("es"),
      event.location.trim().toLocaleLowerCase("es"),
      event.date?.toISOString().slice(0, 10) ?? "",
      time(event.time),
    ].join("|");
    if (!uniqueEvents.has(key)) uniqueEvents.set(key, event);
  }
  const publicEvents = [...uniqueEvents.values()].map((event) => ({
    id: event.id,
    name: event.name,
    description: event.description,
    location: event.location,
    date: event.date?.toISOString() ?? null,
    time: time(event.time),
    imageUrl: event.imageUrl && eventImages.has(event.imageUrl) ? event.imageUrl : null,
  }));

  const availableAvatars = avatarFiles
    .filter((file) => /\.(?:avif|jpe?g|png|webp)$/i.test(file))
    .sort();
  const testimonialSlides: LandingTestimonialSlide[] = testimonials.map((item) => ({
    id: item.id,
    description: item.description,
    date: item.date.toLocaleDateString("es-AR"),
    avatar: pickAvatar(availableAvatars, item.id),
  }));

  const groupedHours = new Map<string, OpeningHourGroup>();
  for (const item of hours) {
    const key = [
      time(item.morningStartTime),
      time(item.morningEndTime),
      time(item.eveningStartTime),
      time(item.eveningEndTime),
    ].join("|");
    const group = groupedHours.get(key) ?? {
      days: [],
      morningStartTime: item.morningStartTime,
      morningEndTime: item.morningEndTime,
      eveningStartTime: item.eveningStartTime,
      eveningEndTime: item.eveningEndTime,
    };
    for (const day of item.dayOfWeek
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)) {
      if (!group.days.includes(day)) group.days.push(day);
    }
    groupedHours.set(key, group);
  }

  const lat = Number(business?.latitude);
  const lng = Number(business?.longitude);

  return {
    displayName: tenant.name,
    hero: resolveLandingHeroConfig(stored.hero, {
      tenantName: tenant.name,
      legacyTitle: heroTitle,
      legacySubtitle: heroSubtitle,
      legacyImageUrl: heroImageUrl,
    }),
    heroTitle,
    heroSubtitle,
    heroImageUrl,
    primaryColor: brand?.primaryColor ?? "#ec4899",
    secondaryColor: brand?.secondaryColor ?? "#f5c542",
    backgroundColor: brand?.backgroundColor ?? "#09090b",
    beers,
    stories,
    events: publicEvents,
    testimonials: testimonialSlides,
    openingGroups: [...groupedHours.values()],
    phone: business?.phoneNumber?.toString() ?? "",
    email: business?.email ?? null,
    address: business?.address ?? "",
    instagramUrl: business?.instagramUrl ?? null,
    facebookUrl: business?.facebookUrl ?? null,
    latitude: Number.isFinite(lat) ? lat : null,
    longitude: Number.isFinite(lng) ? lng : null,
    hasMap: Number.isFinite(lat) && Number.isFinite(lng),
  };
}
