import { BeerCarousel } from "@/components/home/beer-carousel";
import { BusinessMap } from "@/components/home/business-map";
import { Carousel } from "@/components/home/carousel";
import { EventGrid } from "@/components/home/event-grid";
import { LandingHero } from "@/components/home/landing-hero";
import { TestimonialCarousel } from "@/components/home/testimonial-carousel";
import { TestimonialForm } from "@/components/testimonial-form";
import { MenuClickHome } from "@/components/commercial/menuclick-home";
import { classifyHost } from "@/lib/domains";
import { formatOpeningHours, loadTenantLandingData } from "@/lib/landing-data";
import { prisma } from "@/lib/prisma";
import { requestRouteContext } from "@/lib/request-route-context";
import { publicHrefForVisiblePath } from "@/lib/routes";
import { getDefaultTenant } from "@/lib/tenant";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

/** @summary Construye la página pública con los datos actuales almacenados en MySQL. */
export default async function LandingPage() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "";
  const routeKind = requestHeaders.get("x-menuclick-route-kind") ?? "";
  if (routeKind.startsWith("platform") || (!routeKind && classifyHost(host).kind === "platform")) {
    const [plans, cases] = await Promise.all([
      prisma.plan.findMany({ where: { active: true }, include: { prices: { where: { active: true }, orderBy: { validFrom: "desc" }, take: 1 } }, orderBy: [{ type: "asc" }, { displayOrder: "asc" }], take: 4 }),
      prisma.successCase.findMany({ where: { isPublicCaseStudy: true, status: "published" }, include: { tenant: { select: { name: true } } }, orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] }),
    ]);
    return <MenuClickHome plans={plans.map((plan) => ({ id: plan.id, slug: plan.slug, name: plan.name, summary: plan.summary, highlighted: plan.highlighted, price: plan.prices[0] ? { amount: plan.prices[0].amount ? Number(plan.prices[0].amount) : null, currency: plan.prices[0].currency, billingPeriod: plan.prices[0].billingPeriod } : null }))} cases={cases.map((item) => ({ id: item.id, slug: item.slug, businessName: item.businessName, businessType: item.businessType, location: item.location, coverUrl: item.coverUrl, results: item.results, tenantName: item.tenant.name }))} />;
  }
  const [tenant, route] = await Promise.all([getDefaultTenant(), requestRouteContext()]);
  const data = await loadTenantLandingData(tenant);
  const storySlides = data.stories.map((slide) => ({
    image: slide.image,
    imageAlt: slide.title,
    eyebrow: data.displayName,
    title: slide.title,
    text: slide.subtitle,
  }));
  const ctaHref = publicHrefForVisiblePath(route.originalPath, tenant.slug, "/carta", route.branchSlug);

  return (
    <main className="overflow-hidden">
      <LandingHero
        eyebrow={data.displayName}
        title={data.heroTitle}
        subtitle={data.heroSubtitle}
        imageUrl={data.heroImageUrl}
        primaryColor={data.primaryColor}
        secondaryColor={data.secondaryColor}
        backgroundColor={data.backgroundColor}
        ctaHref={ctaHref}
        eventsHref="#eventos"
      />

      <section id="eventos" className="shell scroll-mt-24 py-24">
        <p className="section-eyebrow">Agenda {tenant.name}</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <h2 className="section-title">Próximos eventos</h2>
          <p className="max-w-md text-zinc-400">Música, encuentros y noches para compartir.</p>
        </div>
        <EventGrid events={data.events} />
      </section>

      <section className="beer-section py-24">
        <div className="shell">
          <p className="section-eyebrow text-center">Hechas en casa</p>
          <h2 className="section-title mt-2 text-center">Nuestras cervezas</h2>
          <div className="mt-10">
            <BeerCarousel images={data.beers} />
          </div>
        </div>
      </section>

      <section className="shell py-24">
        <Carousel slides={storySlides} label={`Conocé ${data.displayName}`} interval={6500} />
      </section>

      <section className="bg-[radial-gradient(circle_at_20%_20%,rgba(236,72,153,.16),transparent_32%),linear-gradient(#09090b,#050505)] py-24">
        <div className="shell">
          <p className="section-eyebrow text-center">Comunidad</p>
          <h2 className="section-title mt-2 text-center">Lo que dice la gente</h2>
          <div className="mt-10">
            <TestimonialCarousel testimonials={data.testimonials} />
          </div>
          <TestimonialForm />
        </div>
      </section>

      {data.hasMap && data.latitude !== null && data.longitude !== null && (
        <section className="bg-white px-4 py-16">
          <div className="shell overflow-hidden rounded-[2rem] shadow-2xl">
            <BusinessMap
              latitude={data.latitude}
              longitude={data.longitude}
              address={data.address || tenant.name}
            />
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
            {data.openingGroups
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
            <p className="mt-3 text-sm text-zinc-400">{data.address}</p>
          </div>
          <div>
            <h3 className="font-bold">Contacto</h3>
            {data.email && (
              <a
                className="mt-3 block text-sm text-zinc-400 hover:text-pink-400"
                href={`mailto:${data.email}`}
              >
                {data.email}
              </a>
            )}
            {data.phone && (
              <a
                className="mt-2 block text-sm text-zinc-400 hover:text-pink-400"
                href={`https://wa.me/${data.phone}`}
              >
                {data.phone}
              </a>
            )}
          </div>
          <div>
            <h3 className="font-bold">Seguinos</h3>
            <div className="mt-3 flex gap-4 text-sm text-pink-400">
              {data.instagramUrl && <a href={data.instagramUrl}>Instagram</a>}
              {data.facebookUrl && <a href={data.facebookUrl}>Facebook</a>}
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
