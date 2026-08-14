import { readdir } from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";
import { EventGrid, type PublicEvent } from "@/components/home/event-grid";
import { LandingHero } from "@/components/home/landing-hero";
import { TestimonialCarousel } from "@/components/home/testimonial-carousel";
import { TestimonialForm } from "@/components/testimonial-form";
import { Carousel } from "@/components/home/carousel";
import { BeerCarousel } from "@/components/home/beer-carousel";
import { prisma } from "@/lib/prisma";
import { time } from "@/lib/format";
import { getDefaultTenant } from "@/lib/tenant";
import { resolvePublicBranch } from "@/lib/branch";
import { managedPageMetadata } from "@/lib/seo";
import { publicHrefForVisiblePath } from "@/lib/routes";
import { requestRouteContext } from "@/lib/request-route-context";

export const dynamic = "force-dynamic";

const pickAvatar = (avatars: string[], seed: number) =>
  avatars[(seed * 37) % avatars.length] ?? "avatar_profile_default.png";

const formatOpeningHours = (group: { morningStartTime: Date | null; morningEndTime: Date | null; eveningStartTime: Date | null; eveningEndTime: Date | null }) => {
  const parts: string[] = [];
  const morning = time(group.morningStartTime);
  const morningEnd = time(group.morningEndTime);
  const evening = time(group.eveningStartTime);
  const eveningEnd = time(group.eveningEndTime);
  if (morning || morningEnd) parts.push(`${morning || "—"} a ${morningEnd || "—"}`);
  if (evening || eveningEnd) parts.push(`${evening || "—"} a ${eveningEnd || "—"}`);
  return parts.join(" · ") || "Consultar horarios";
};

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
  const phone = branch.inheritLanding
    ? business?.phoneNumber?.toString() ?? ""
    : branchInfo?.phone ?? business?.phoneNumber?.toString() ?? "";
  const address = branch.inheritLanding
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
  const beers = (
    sectionsBeerImages.length > 0
      ? sectionsBeerImages
      : [
          "/images/products/cerveza-artesanal.jpg",
          "/images/products/cerveza-lager.jpg",
          "/images/products/cerveza-ipa.jpg",
        ]
  ).filter((source) => source && /\/images\/.+\.(?:jpe?g|png|webp|avif)$/i.test(source));

  return (
    <main className="overflow-hidden">
      <LandingHero
        eyebrow={displayName}
        title={heroTitle}
        subtitle={heroSubtitle}
        imageUrl={heroImage}
        primaryColor={brand?.primaryColor ?? "#ec4899"}
        secondaryColor={brand?.secondaryColor ?? "#f5c542"}
        backgroundColor={brand?.backgroundColor ?? "#09090b"}
        ctaHref={publicHrefForVisiblePath(route.originalPath, tenant.slug, "/carta", branch.branchSlug)}
        eventsHref="#eventos"
      />

      <section id="eventos" className="shell scroll-mt-24 py-24">
        <p className="section-eyebrow">Agenda {tenant.name}</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <h2 className="section-title">Próximos eventos</h2>
          <p className="max-w-md text-zinc-400">Música, encuentros y noches para compartir.</p>
        </div>
        <EventGrid events={publicEvents} />
      </section>

      <section className="beer-section py-24">
        <div className="shell">
          <p className="section-eyebrow text-center">Hechas en casa</p>
          <h2 className="section-title mt-2 text-center">Nuestras cervezas</h2>
          <div className="mt-10">
            <BeerCarousel images={beers} />
          </div>
        </div>
      </section>

      <section className="shell py-24">
        <Carousel slides={stories} label={`Conocé ${displayName}`} interval={6500} />
      </section>

      <section className="bg-[radial-gradient(circle_at_20%_20%,rgba(236,72,153,.16),transparent_32%),linear-gradient(#09090b,#050505)] py-24">
        <div className="shell">
          <p className="section-eyebrow text-center">Comunidad</p>
          <h2 className="section-title mt-2 text-center">Lo que dice la gente</h2>
          <div className="mt-10">
            <TestimonialCarousel testimonials={testimonialSlides} />
          </div>
          <TestimonialForm />
        </div>
      </section>

      {address && (
        <section className="bg-white px-4 py-16">
          <div className="shell overflow-hidden rounded-[2rem] shadow-2xl">
            <div className="h-64 w-full" />
            <div className="p-6">
              <h3 className="text-lg font-black text-zinc-900">{displayName}</h3>
              <p className="mt-2 text-sm text-zinc-500">{address}</p>
            </div>
          </div>
        </section>
      )}

      <section
        id="horarios"
        className="relative scroll-mt-24 overflow-hidden bg-[linear-gradient(rgba(0,0,0,.82),rgba(0,0,0,.92)),url('/images/banners/new_banner2_750.jpg')] bg-cover bg-center py-24"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(236,72,153,.2),transparent_35%)]" />
        <div className="shell relative text-center">
          <p className="section-eyebrow">Cuándo venir</p>
          <h2 className="section-title mt-2">Horarios</h2>
          <div className="mx-auto mt-12 max-w-4xl space-y-10">
            {[...groupedHours.values()]
              .filter(
                (group) =>
                  group.morningStartTime ||
                  group.morningEndTime ||
                  group.eveningStartTime ||
                  group.eveningEndTime,
              )
              .map((group) => (
                <article key={group.days.join("-")}>
                  <h3 className="text-3xl font-black uppercase tracking-tight sm:text-5xl">
                    {group.days.join(", ")}
                  </h3>
                  <p className="mt-3 text-xl font-bold text-pink-400">{formatOpeningHours(group)}</p>
                </article>
              ))}
          </div>
        </div>
      </section>

      <footer id="redes" className="border-t border-white/10 bg-black py-14">
        <div className="shell grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <h2 className="text-3xl font-black text-pink-500">
              {tenant.name}<span className="text-white">&.</span>
            </h2>
            <p className="mt-3 text-zinc-500">Cerveza artesanal y cocina.</p>
          </div>
          <div>
            <h3 className="font-bold">Encontranos</h3>
            <p className="mt-3 text-sm text-zinc-400">{address}</p>
          </div>
          <div>
            <h3 className="font-bold">Contacto</h3>
            {phone && (
              <a className="mt-2 block text-sm text-zinc-400 hover:text-pink-400" href={`https://wa.me/${phone}`}>
                {phone}
              </a>
            )}
            <a className="mt-3 block text-sm text-zinc-400 hover:text-pink-400" href={`mailto:${business?.email}`}>
              {business?.email}
            </a>
          </div>
          <div>
            <h3 className="font-bold">Seguinos</h3>
            <div className="mt-3 flex gap-4 text-sm text-pink-400">
              <a href={business?.instagramUrl ?? "#"}>Instagram</a>
              <a href={business?.facebookUrl ?? "#"}>Facebook</a>
            </div>
          </div>
        </div>
        <p className="shell mt-12 text-xs text-zinc-600">
          © {new Date().getFullYear()} {tenant.name}
        </p>
      </footer>
    </main>
  );
}
