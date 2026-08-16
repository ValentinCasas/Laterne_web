"use client";

import { BeerCarousel } from "@/components/home/beer-carousel";
import { BusinessMap } from "@/components/home/business-map";
import { Carousel } from "@/components/home/carousel";
import { EventGrid } from "@/components/home/event-grid";
import { LandingHero } from "@/components/home/landing-hero";
import { TestimonialCarousel } from "@/components/home/testimonial-carousel";
import { TestimonialForm } from "@/components/testimonial-form";
import { time } from "@/lib/format";
import type { LandingSectionKey, TenantLandingData } from "@/lib/landing-content";
import { publicHrefForVisiblePath } from "@/lib/routes";

const sectionLabels: Record<LandingSectionKey, string> = {
  hero: "Hero",
  events: "Eventos",
  beers: "Productos",
  stories: "Historia",
  testimonials: "Testimonios",
  map: "Mapa",
  contact: "Contacto",
};

const sectionIds: Record<LandingSectionKey, string> = {
  hero: "landing-sec-hero",
  events: "eventos",
  beers: "landing-sec-beers",
  stories: "landing-sec-stories",
  testimonials: "landing-sec-testimonials",
  map: "landing-sec-map",
  contact: "redes",
};

/**
 * @summary Convierte una fecha persistida en un valor válido para ordenar eventos.
 */
function toDate(value: Date | string | null): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

/**
 * @summary Formatea un valor para mostrarlo en la portada pública del negocio.
 */
function formatOpeningHours(group: {
  days: string[];
  morningStartTime: Date | string | null;
  morningEndTime: Date | string | null;
  eveningStartTime: Date | string | null;
  eveningEndTime: Date | string | null;
}) {
  const morningStart = time(toDate(group.morningStartTime));
  const morningEnd = time(toDate(group.morningEndTime));
  const eveningStart = time(toDate(group.eveningStartTime));
  const eveningEnd = time(toDate(group.eveningEndTime));
  const parts: string[] = [];
  if (morningStart !== "—" || morningEnd !== "—")
    parts.push(`${morningStart === "—" ? "—" : morningStart} a ${morningEnd === "—" ? "—" : morningEnd}`);
  if (eveningStart !== "—" || eveningEnd !== "—")
    parts.push(`${eveningStart === "—" ? "—" : eveningStart} a ${eveningEnd === "—" ? "—" : eveningEnd}`);
  return parts.join(" · ") || "Consultar horarios";
}

/** @summary Sección editable del inicio con identificación, anillo de selección y etiqueta en la vista previa. */
function EditableSection({
  section,
  className,
  preview,
  active,
  onSelect,
  children,
}: {
  section: LandingSectionKey;
  className?: string;
  preview: boolean;
  active: boolean;
  onSelect?: (key: LandingSectionKey) => void;
  children: React.ReactNode;
}) {
  return (
    <section
      id={sectionIds[section]}
      className={`relative scroll-mt-4 ${className ?? ""} ${
        preview ? (active ? "ring-2 ring-pink-500" : "opacity-90 hover:opacity-100") : ""
      }`}
      onClick={preview && onSelect ? () => onSelect(section) : undefined}
    >
      {preview && (
        <span className="absolute left-2 top-2 z-20 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-pink-300">
          {sectionLabels[section]}
        </span>
      )}
      {children}
    </section>
  );
}

/** @summary Renderiza el inicio público completo y la vista previa del editor con los mismos componentes y datos. */
export function LandingRenderer({
  data,
  originalPath,
  tenantSlug,
  branchSlug,
  compact = false,
  preview = false,
  activeSection = null,
  onSectionSelect,
}: {
  data: TenantLandingData;
  /** Contexto canónico serializable para resolver hrefs públicos dentro del cliente. */
  originalPath?: string;
  tenantSlug?: string;
  branchSlug?: string;
  compact?: boolean;
  preview?: boolean;
  activeSection?: LandingSectionKey | null;
  onSectionSelect?: (key: LandingSectionKey) => void;
}) {
  const href =
    originalPath && tenantSlug
      ? (value: string) =>
          value.startsWith("#")
            ? value
            : publicHrefForVisiblePath(originalPath, tenantSlug, value, branchSlug)
      : (value: string) => value;
  const storySlides = data.stories.map((slide) => ({
    image: slide.image,
    imageAlt: slide.title,
    eyebrow: data.displayName,
    title: slide.title,
    text: slide.subtitle,
  }));
  const sectionProps = (section: LandingSectionKey) => ({
    section,
    preview,
    active: activeSection === section,
    onSelect: onSectionSelect,
  });

  return (
    <>
      <EditableSection {...sectionProps("hero")}>
        <LandingHero
          hero={data.hero}
          primaryColor={data.primaryColor}
          secondaryColor={data.secondaryColor}
          backgroundColor={data.backgroundColor}
          resolveHref={href}
          compact={compact}
        />
      </EditableSection>

      <EditableSection {...sectionProps("events")} className="shell py-24">
        <p className="section-eyebrow">Agenda {data.displayName}</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <h2 className="section-title">Próximos eventos</h2>
          <p className="max-w-md text-zinc-400">Música, encuentros y noches para compartir.</p>
        </div>
        <EventGrid events={data.events} />
      </EditableSection>

      <EditableSection {...sectionProps("beers")} className="beer-section py-24">
        <div className="shell">
          <p className="section-eyebrow text-center">Hechas en casa</p>
          <h2 className="section-title mt-2 text-center">Nuestros productos</h2>
          <div className="mt-10">
            <BeerCarousel images={data.beers} />
          </div>
        </div>
      </EditableSection>

      <EditableSection {...sectionProps("stories")} className="shell py-24">
        <Carousel slides={storySlides} label={`Conocé ${data.displayName}`} interval={6500} />
      </EditableSection>

      <EditableSection
        {...sectionProps("testimonials")}
        className="bg-[radial-gradient(circle_at_20%_20%,rgba(236,72,153,.16),transparent_32%),linear-gradient(#09090b,#050505)] py-24"
      >
        <div className="shell">
          <p className="section-eyebrow text-center">Comunidad</p>
          <h2 className="section-title mt-2 text-center">Lo que dice la gente</h2>
          <div className="mt-10">
            <TestimonialCarousel testimonials={data.testimonials} />
          </div>
          <TestimonialForm />
        </div>
      </EditableSection>

      {data.hasMap && data.latitude !== null && data.longitude !== null ? (
        <EditableSection {...sectionProps("map")} className="bg-white px-4 py-16">
          <div className="shell overflow-hidden rounded-[2rem] shadow-2xl">
            <BusinessMap
              latitude={data.latitude}
              longitude={data.longitude}
              address={data.address || data.displayName}
            />
          </div>
        </EditableSection>
      ) : preview ? (
        <EditableSection {...sectionProps("map")} className="bg-white px-4 py-16">
          <div className="grid min-h-64 place-items-center text-center text-sm text-zinc-500">
            Mapa sin configurar: cargá la dirección y las coordenadas del negocio para que aparezca acá.
          </div>
        </EditableSection>
      ) : data.address ? (
        <section className="bg-white px-4 py-16">
          <div className="shell overflow-hidden rounded-[2rem] shadow-2xl">
            <div className="p-6">
              <h3 className="text-lg font-black text-zinc-900">{data.displayName}</h3>
              <p className="mt-2 text-sm text-zinc-500">{data.address}</p>
            </div>
          </div>
        </section>
      ) : null}

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

      <EditableSection {...sectionProps("contact")} className="border-t border-white/10 bg-black py-14">
        <div className="shell grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <h2 className="text-3xl font-black text-pink-500">
              {data.displayName}
              <span className="text-white">&.</span>
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
          © {new Date().getFullYear()} {data.displayName}
        </p>
      </EditableSection>
    </>
  );
}
