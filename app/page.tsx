import Image from "next/image";
import Link from "next/link";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { BeerCarousel } from "@/components/home/beer-carousel";
import { BusinessMap } from "@/components/home/business-map";
import { Carousel } from "@/components/home/carousel";
import { EventGrid, type PublicEvent } from "@/components/home/event-grid";
import { TestimonialCarousel } from "@/components/home/testimonial-carousel";
import { TestimonialForm } from "@/components/testimonial-form";
import { prisma } from "@/lib/prisma";
import { time } from "@/lib/format";

export const dynamic = "force-dynamic";

const beers = ["neipa-tapa.png", "amber-tapa.png", "apa-tapa.png", "american-amber-tapa.png"].map(
  (image) => `/images/banners/${image}`,
);
const stories = [
  {
    image: "/images/banners/laterne2.jpg",
    imageAlt: "Interior de Laterne",
    eyebrow: "Nuestra historia",
    title: "Laterne",
    text: "Hace muchos años que Laterne es sinónimo de birra, amistad, momentos compartidos y buena cerveza artesanal.",
  },
  {
    image: "/images/banners/banner-section-beer.png",
    imageAlt: "Canillas de cerveza artesanal",
    eyebrow: "Donde nos encontramos",
    title: "Nuestra casa",
    text: "Un espacio para compartir algo rico y disfrutar una cerveza artesanal con identidad propia.",
  },
  {
    image: "/images/banners/banner-eventos2.png",
    imageAlt: "Evento en Laterne",
    eyebrow: "Lo que importa",
    title: "Momentos",
    text: "Birra, música, amigos, familia y esas noches que se vuelven parte de una historia compartida.",
  },
];

/** @summary Selecciona un avatar estable para representar una opinión anónima. */
function pickAvatar(avatarFiles: string[], testimonialId: number) {
  if (!avatarFiles.length) return "hombre.png";
  const stableIndex = Math.abs(Math.imul(testimonialId, 2654435761)) % avatarFiles.length;
  return avatarFiles[stableIndex];
}

/** @summary Combina los turnos disponibles en una descripción horaria fácil de leer. */
function formatOpeningHours(group: {
  morningStartTime: Date | null;
  morningEndTime: Date | null;
  eveningStartTime: Date | null;
  eveningEndTime: Date | null;
}) {
  const ranges: string[] = [];
  if (group.morningStartTime)
    ranges.push(
      `de ${time(group.morningStartTime)} a ${group.morningEndTime ? time(group.morningEndTime) : "cierre"}`,
    );
  if (group.eveningStartTime)
    ranges.push(
      `de ${time(group.eveningStartTime)} a ${group.eveningEndTime ? time(group.eveningEndTime) : "cierre"}`,
    );
  return ranges.join(" y ").replace(/^d/, "D");
}

/** @summary Construye la página pública con los datos actuales almacenados en MySQL. */
export default async function LandingPage() {
  const [business, events, hours, testimonials, avatarFiles, eventImageFiles] = await Promise.all([
    prisma.businessInfo.findFirst(),
    prisma.event.findMany({ orderBy: [{ date: "desc" }, { id: "desc" }] }),
    prisma.openingHour.findMany({ orderBy: { id: "asc" } }),
    prisma.testimonial.findMany({ where: { state: true }, orderBy: { date: "desc" }, take: 12 }),
    readdir(path.join(process.cwd(), "public", "images", "avatars_defect")),
    readdir(path.join(process.cwd(), "public", "images", "images_event")),
  ]);
  const phone = business?.phoneNumber?.toString() ?? "";
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
      .filter(Boolean))
      if (!group.days.includes(day)) group.days.push(day);
    groupedHours.set(key, group);
  }
  const lat = Number(business?.latitude);
  const lng = Number(business?.longitude);
  const hasMap = Number.isFinite(lat) && Number.isFinite(lng);

  return (
    <main className="overflow-hidden">
      <section className="relative min-h-[calc(100vh-4rem)]">
        <Image
          src="/images/banners/new_banner2_750.jpg"
          alt="Cervezas Laterne"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/65 to-black/10" />
        <div className="shell relative flex min-h-[calc(100vh-4rem)] flex-col justify-center py-24">
          <p className="font-bold uppercase tracking-[.3em] text-pink-400">La Punta · San Luis</p>
          <h1 className="mt-4 max-w-5xl text-6xl font-black leading-[.92] tracking-tight sm:text-8xl lg:text-9xl">
            Laterne es
            <br />
            <span className="hero-word">birra.</span>
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-relaxed text-zinc-200">
            Amistad, momentos compartidos, cocina y cerveza artesanal. Una casa simple para disfrutar con
            quienes elegimos.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link className="btn" href="/carta">
              Explorar la carta
            </Link>
            <a className="btn btn-secondary" href="#eventos">
              Ver eventos
            </a>
          </div>
        </div>
      </section>

      <section id="eventos" className="shell scroll-mt-24 py-24">
        <p className="section-eyebrow">Agenda Laterne</p>
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
        <Carousel slides={stories} label="Conocé Laterne" interval={6500} />
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

      {hasMap && (
        <section className="bg-white px-4 py-16">
          <div className="shell overflow-hidden rounded-[2rem] shadow-2xl">
            <BusinessMap latitude={lat} longitude={lng} address={business?.address ?? "Laterne"} />
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
              Laterne<span className="text-white">&.</span>
            </h2>
            <p className="mt-3 text-zinc-500">Cerveza artesanal y cocina.</p>
          </div>
          <div>
            <h3 className="font-bold">Encontranos</h3>
            <p className="mt-3 text-sm text-zinc-400">{business?.address}</p>
          </div>
          <div>
            <h3 className="font-bold">Contacto</h3>
            <a
              className="mt-3 block text-sm text-zinc-400 hover:text-pink-400"
              href={`mailto:${business?.email}`}
            >
              {business?.email}
            </a>
            {phone && (
              <a
                className="mt-2 block text-sm text-zinc-400 hover:text-pink-400"
                href={`https://wa.me/${phone}`}
              >
                {phone}
              </a>
            )}
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
          © {new Date().getFullYear()} Laterne · Valen Casas & Gino Paoletti
        </p>
      </footer>
    </main>
  );
}
