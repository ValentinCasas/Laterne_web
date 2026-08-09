import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const statStyles = [
  "from-pink-500/25 to-pink-950/10 text-pink-300",
  "from-amber-500/25 to-amber-950/10 text-amber-300",
  "from-violet-500/25 to-violet-950/10 text-violet-300",
  "from-emerald-500/25 to-emerald-950/10 text-emerald-300",
] as const;

/** @summary Muestra indicadores, accesos rápidos y actividad reciente del negocio. */
export default async function Dashboard() {
  const [products, categories, events, pendingTestimonials, recentEvents, recentTestimonials] =
    await Promise.all([
      prisma.product.count(),
      prisma.category.count(),
      prisma.event.count(),
      prisma.testimonial.count({ where: { moderationStatus: "pending" } }),
      prisma.event.findMany({ orderBy: [{ date: "desc" }, { id: "desc" }], take: 3 }),
      prisma.testimonial.findMany({ orderBy: { id: "desc" }, take: 3 }),
    ]);

  const stats = [
    { label: "Productos publicados", value: products, href: "/admin/productos" },
    { label: "Categorías activas", value: categories, href: "/admin/categorias" },
    { label: "Eventos cargados", value: events, href: "/admin/eventos" },
    { label: "Opiniones pendientes", value: pendingTestimonials, href: "/admin/testimonios" },
  ] as const;

  return (
    <section className="space-y-6">
      <header className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-pink-600/25 via-zinc-950 to-zinc-950 p-6 shadow-2xl shadow-black/30 sm:p-9">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-pink-500/20 blur-3xl" />
        <div className="relative max-w-2xl">
          <p className="text-xs font-black uppercase tracking-[.28em] text-pink-300">Centro de control</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">
            Tu negocio, en un solo lugar.
          </h1>
          <p className="mt-4 max-w-xl leading-relaxed text-zinc-400">
            Actualizá la carta, publicá eventos y moderá opiniones sin tocar código.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link className="btn" href="/admin/productos">
              Agregar producto
            </Link>
            <Link className="btn btn-secondary" href="/admin/eventos">
              Nuevo evento
            </Link>
          </div>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat, index) => (
          <Link
            className={`group rounded-3xl border border-white/10 bg-gradient-to-br p-5 transition hover:-translate-y-1 hover:border-white/20 ${statStyles[index]}`}
            href={stat.href}
            key={stat.label}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="max-w-32 text-sm font-bold text-zinc-300">{stat.label}</p>
              <span className="text-lg transition group-hover:translate-x-1">→</span>
            </div>
            <strong className="mt-8 block text-5xl font-black text-white">{stat.value}</strong>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-3xl border border-white/10 bg-zinc-950/70 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-violet-300">Agenda</p>
              <h2 className="mt-1 text-2xl font-black">Eventos recientes</h2>
            </div>
            <Link className="text-sm font-bold text-pink-300 hover:text-pink-200" href="/admin/eventos">
              Ver todos
            </Link>
          </div>
          <div className="mt-5 space-y-3">
            {recentEvents.map((event) => (
              <article className="flex items-center gap-4 rounded-2xl bg-white/[.04] p-4" key={event.id}>
                <time className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet-500/15 text-xs font-black text-violet-300">
                  {event.date?.toLocaleDateString("es-AR", { day: "2-digit", month: "short" }) ?? "S/F"}
                </time>
                <div className="min-w-0">
                  <h3 className="truncate font-black">{event.name}</h3>
                  <p className="truncate text-sm text-zinc-500">{event.location}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-zinc-950/70 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-emerald-300">Comunidad</p>
              <h2 className="mt-1 text-2xl font-black">Últimas opiniones</h2>
            </div>
            <Link className="text-sm font-bold text-pink-300 hover:text-pink-200" href="/admin/testimonios">
              Moderar
            </Link>
          </div>
          <div className="mt-5 space-y-3">
            {recentTestimonials.map((testimonial) => (
              <article className="rounded-2xl bg-white/[.04] p-4" key={testimonial.id}>
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
                      testimonial.moderationStatus === "approved"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : testimonial.moderationStatus === "rejected"
                          ? "bg-red-500/15 text-red-300"
                          : "bg-amber-500/15 text-amber-300"
                    }`}
                  >
                    {testimonial.moderationStatus === "approved"
                      ? "Publicada"
                      : testimonial.moderationStatus === "rejected"
                        ? "Rechazada"
                        : "Pendiente"}
                  </span>
                  <time className="text-xs text-zinc-600">
                    {testimonial.date.toLocaleDateString("es-AR")}
                  </time>
                </div>
                <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-zinc-300">
                  “{testimonial.description}”
                </p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
