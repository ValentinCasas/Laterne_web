import { readdir } from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";
import { type PublicEvent } from "@/components/home/event-grid";
import { LandingRenderer } from "@/components/landing/landing-renderer";
import { prisma } from "@/lib/prisma";
import { time } from "@/lib/format";
import { getDefaultTenant } from "@/lib/tenant";
import { resolvePublicBranch } from "@/lib/branch";
import { managedPageMetadata } from "@/lib/seo";
import { requestRouteContext } from "@/lib/request-route-context";
import { resolveLandingHeroConfig, LANDING_BEER_DEFAULTS, type TenantLandingData } from "@/lib/landing-content";
import { resolveLandingBeers } from "@/lib/landing-data";

export const dynamic = "force-dynamic";

const pickAvatar = (avatars: string[], seed: number) =>
  avatars[(seed * 37) % avatars.length] ?? "avatar_profile_default.png";

/** @summary Metadatos SEO de la página de sucursal. */
export function generateMetadata() {
  return managedPageMetadata("/", "Bienvenidos", "Carta digital, eventos y todo lo que ofrecemos.");
}

/** @summary Página pública de una sucursal específica del negocio. */
export default async function BranchLandingPage({ params }: { params: Promise<{ branchSlug: string }> }) {
  const { branchSlug } = await params;
  const [tenant, route] = await Promise.all([getDefaultTenant(), requestRouteContext()]);
  const branch = await resolvePublicBranch(tenant.id, branchSlug);
  if (!branch || !branch.operative) notFound();

  const now = new Date();
  // inheritLanding=true → la landing hereda el contenido del negocio (sucursal principal);
  // solo el contenido propio de la sucursal se muestra cuando la landing es específica.
  const contentBranchId = branch.inheritLanding
    ? branch.isPrimary
      ? branch.branchId
      : (
          await prisma.branch.findFirst({
            where: { tenantId: tenant.id, active: true },
            orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
            select: { id: true },
          })
        )?.id
    : branch.branchId;
  const [business, events, hours, testimonials, avatarFiles, eventImageFiles, branchInfo, brand] =
    await Promise.all([
      prisma.businessInfo.findUnique({ where: { tenantId: tenant.id } }),
      prisma.event.findMany({
        where: {
          tenantId: tenant.id,
          branchId: contentBranchId ?? -1,
          OR: [{ status: "published" }, { status: "scheduled", publishAt: { lte: now } }],
        },
        orderBy: [{ date: "desc" }, { id: "desc" }],
      }),
      prisma.openingHour.findMany({
        where: { tenantId: tenant.id, branchId: contentBranchId ?? -1 },
        orderBy: { id: "asc" },
      }),
      prisma.testimonial.findMany({
        where: {
          tenantId: tenant.id,
          branchId: contentBranchId ?? -1,
          state: true,
          moderationStatus: "approved",
        },
        orderBy: { date: "desc" },
        take: 12,
      }),
      readdir(path.join(process.cwd(), "public", "images", "avatars_defect")),
      readdir(path.join(process.cwd(), "public", "images", "images_event")),
      prisma.branch.findFirst({
        where: { id: branch.branchId },
        select: { name: true, address: true, phone: true, latitude: true, longitude: true },
      }),
      prisma.brandSettings.findUnique({ where: { tenantId: tenant.id } }),
    ]);

  const displayName = branch.inheritLanding ? tenant.name : (branchInfo?.name ?? tenant.name);
  const landingSections =
    brand?.landingSections &&
    typeof brand.landingSections === "object" &&
    !Array.isArray(brand.landingSections)
      ? (brand.landingSections as {
          hero?: unknown;
          heroImage?: unknown;
          beerImages?: unknown;
          stories?: unknown;
        })
      : {};
  const sectionsBeerImages = Array.isArray(landingSections.beerImages)
    ? landingSections.beerImages.filter(
        (source): source is string => typeof source === "string" && !!source.trim(),
      )
    : [];
  const sectionsStories = Array.isArray(landingSections.stories)
    ? landingSections.stories.filter(
        (slide): slide is { title: string; subtitle: string; image: string } =>
          !!slide && typeof slide === "object",
      )
    : [];
  const heroImage = brand?.heroImageUrl || null;
  const ownLanding = !branch.inheritLanding && branch.branch.landingContent && typeof branch.branch.landingContent === "object" && !Array.isArray(branch.branch.landingContent)
    ? branch.branch.landingContent as { heroTitle?: unknown; heroSubtitle?: unknown }
    : null;
  const heroTitle = typeof ownLanding?.heroTitle === "string" && ownLanding.heroTitle.trim()
    ? ownLanding.heroTitle
    : typeof brand?.heroTitle === "string" && brand.heroTitle.trim()
      ? brand.heroTitle
      : `${tenant.name} es`;
  const heroSubtitle = typeof ownLanding?.heroSubtitle === "string" && ownLanding.heroSubtitle.trim()
    ? ownLanding.heroSubtitle
    : typeof brand?.heroSubtitle === "string" && brand.heroSubtitle.trim()
      ? brand.heroSubtitle
      : "Amistad, momentos compartidos, cocina y cerveza artesanal. Una casa simple para disfrutar con quienes elegimos.";
  const hero = resolveLandingHeroConfig(landingSections.hero, {
    tenantName: displayName,
    legacyTitle: heroTitle,
    legacySubtitle: heroSubtitle,
    legacyImageUrl: heroImage,
  });
  const phone = branch.inheritLanding
    ? business?.phoneNumber?.toString() ?? ""
    : branchInfo?.phone ?? business?.phoneNumber?.toString() ?? "";  const address = branch.inheritLanding
    ? business?.address ?? ""
    : branchInfo?.address ?? business?.address ?? "";
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
  const publicEvents: PublicEvent[] = [...uniqueEvents.values()].map((event) => ({
    id: event.id,
    name: event.name,
    description: event.description,
    location: event.location,
    date: event.date?.toISOString() ?? null,
    time: time(event.time),
    imageUrl: event.imageUrl && eventImages.has(event.imageUrl) ? event.imageUrl : null,
  }));
  const availableAvatars = avatarFiles.filter((file) => /\.(?:avif|jpe?g|png|webp)$/i.test(file)).sort();
  const testimonialSlides = testimonials.map((item) => ({
    id: item.id,
    description: item.description,
    date: item.date.toLocaleDateString("es-AR"),
    avatar: pickAvatar(availableAvatars, item.id),
  }));
  const groupedHours = new Map<
    string,
    {
      days: string[];
      morningStartTime: Date | null;
      morningEndTime: Date | null;
      eveningStartTime: Date | null;
      eveningEndTime: Date | null;
    }
  >();
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

  const stories =
    sectionsStories.length > 0
      ? sectionsStories.map((slide) => ({
          title: typeof slide.title === "string" && slide.title.trim() ? slide.title : displayName,
          subtitle:
            typeof slide.subtitle === "string" && slide.subtitle.trim()
              ? slide.subtitle
              : "Hecho para disfrutar.",
          image:
            typeof slide.image === "string" && slide.image.trim()
              ? slide.image
              : "/images/banners/new_banner2_750.jpg",
        }))
      : [
          { title: "Bienvenidos", subtitle: displayName, image: "/images/banners/new_banner2_750.jpg" },
          { title: "Hecho para disfrutar", subtitle: "Productos, eventos y comunidad.", image: "/images/banners/new_banner2_750.jpg" },
        ];
  const beers = resolveLandingBeers(
    sectionsBeerImages.length > 0 ? sectionsBeerImages : LANDING_BEER_DEFAULTS,
  );

  const branchLatitude =
    Number.isFinite(Number(branchInfo?.latitude))
      ? Number(branchInfo?.latitude)
      : Number.isFinite(Number(business?.latitude))
        ? Number(business?.latitude)
        : null;
  const branchLongitude =
    Number.isFinite(Number(branchInfo?.longitude))
      ? Number(branchInfo?.longitude)
      : Number.isFinite(Number(business?.longitude))
        ? Number(business?.longitude)
        : null;
  const branchData: TenantLandingData = {
    displayName,
    hero,
    heroTitle,
    heroSubtitle,
    heroImageUrl: heroImage,
    primaryColor: brand?.primaryColor ?? "#ec4899",
    secondaryColor: brand?.secondaryColor ?? "#f5c542",
    backgroundColor: brand?.backgroundColor ?? "#09090b",
    beers,
    stories,
    events: publicEvents,
    testimonials: testimonialSlides,
    openingGroups: [...groupedHours.values()],
    phone,
    email: business?.email ?? null,
    address,
    instagramUrl: business?.instagramUrl ?? null,
    facebookUrl: business?.facebookUrl ?? null,
    latitude: branchLatitude,
    longitude: branchLongitude,
    hasMap: branchLatitude !== null && branchLongitude !== null,
  };

  return (
    <main className="overflow-hidden">
      <LandingRenderer
        data={branchData}
        originalPath={route.originalPath}
        tenantSlug={tenant.slug}
        branchSlug={branch.branchSlug}
      />
    </main>
  );
}
