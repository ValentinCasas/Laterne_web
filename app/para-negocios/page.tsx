import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { managedPageMetadata } from "@/lib/seo";
import { MarketingShell } from "@/components/commercial/marketing-shell";

/** @summary Recupera la configuración SEO administrable de la propuesta para negocios. */
export function generateMetadata() {
  return managedPageMetadata(
    "/para-negocios",
    "MenuClick para negocios gastronómicos",
    "Carta digital, pedidos, reservas, promociones, administración y experiencias 3D.",
  );
}

const businessCases = [
  "Bares",
  "Cervecerías",
  "Restaurantes",
  "Cafeterías",
  "Heladerías",
  "Food trucks",
  "Vinotecas",
  "Panaderías",
  "Delivery",
];
const benefits = [
  [
    "Actualización inmediata",
    "Cambiá precios, disponibilidad y contenido sin volver a diseñar ni compartir un PDF.",
  ],
  [
    "Experiencia realmente móvil",
    "La carta se adapta al dispositivo, permite buscar y ayuda a decidir más rápido.",
  ],
  [
    "Pedidos organizados",
    "El cliente prepara un pedido claro y lo envía por WhatsApp con cantidades y total.",
  ],
  [
    "Menos consultas repetitivas",
    "Horarios, ubicación, alérgenos y disponibilidad están visibles donde se necesitan.",
  ],
  [
    "Promociones con mayor exposición",
    "Destacá productos, eventos y beneficios sin depender de una publicación social.",
  ],
  ["Administración propia", "El equipo actualiza el negocio desde un panel protegido sin tocar código."],
];

/** @summary Explica la propuesta comercial de MenuClick para distintos modelos gastronómicos. */
export default async function BusinessPage() {
  const [plans, faqs] = await Promise.all([
    prisma.plan.findMany({
      where: { active: true, type: "implementation" },
      orderBy: { displayOrder: "asc" },
      take: 4,
    }),
    prisma.commercialFaq.findMany({
      where: { audience: "business", active: true },
      orderBy: { displayOrder: "asc" },
    }),
  ]);

  return (
    <MarketingShell>
    <main>
      <section className="relative min-h-[calc(100vh-4rem)] overflow-hidden py-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(236,72,153,.3),transparent_32%),radial-gradient(circle_at_85%_70%,rgba(99,102,241,.18),transparent_32%)]" />
        <div className="shell relative grid min-h-[70vh] items-center gap-12 lg:grid-cols-[1.15fr_.85fr]">
          <div>
            <p className="section-eyebrow">Tecnología gastronómica que sí se usa</p>
            <h1 className="mt-4 text-6xl font-black leading-[.9] tracking-[-.07em] sm:text-8xl">
              Tu carta deja de ser un archivo.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-relaxed text-zinc-300">
              Se convierte en una experiencia rápida, actualizable y preparada para vender, gestionar
              reservas, comunicar promociones y medir decisiones.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link className="btn" href="/solicitar-demo">
                Solicitar demostración
              </Link>
              <Link className="btn btn-secondary" href="/planes">
                Ver planes
              </Link>
            </div>
          </div>
          <div className="rounded-[2rem] border border-white/10 bg-zinc-950/80 p-5 shadow-2xl shadow-black/50">
            <div className="rounded-3xl border border-white/10 bg-black p-6">
              <p className="text-xs font-black uppercase tracking-widest text-pink-400">
                Una sola plataforma
              </p>
              <ul className="mt-5 space-y-4">
                {[
                  "Landing institucional",
                  "Carta digital y pedidos",
                  "Panel autoadministrable",
                  "Eventos, testimonios y reservas",
                  "Estadísticas y experiencias 3D",
                ].map((item) => (
                  <li className="flex items-center gap-3 font-bold" key={item}>
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-pink-500/15 text-pink-300">
                      ✓
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="shell py-24">
        <p className="section-eyebrow">El problema del PDF</p>
        <h2 className="mt-2 max-w-4xl text-4xl font-black sm:text-6xl">
          Una carta difícil de leer también es una venta que cuesta más.
        </h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map(([title, description]) => (
            <article className="rounded-3xl border border-white/10 bg-white/[.03] p-6" key={title}>
              <h3 className="text-xl font-black">{title}</h3>
              <p className="mt-3 leading-relaxed text-zinc-500">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-white/10 bg-zinc-950 py-24">
        <div className="shell">
          <p className="section-eyebrow">Diseñado para gastronomía</p>
          <h2 className="mt-2 text-4xl font-black sm:text-6xl">Distintos negocios, una base adaptable.</h2>
          <div className="mt-8 flex flex-wrap gap-3">
            {businessCases.map((business) => (
              <span
                className="rounded-full border border-white/10 bg-white/[.04] px-5 py-3 font-bold"
                key={business}
              >
                {business}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="shell py-24">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <p className="section-eyebrow">Diferencial premium</p>
            <h2 className="mt-2 text-4xl font-black sm:text-6xl">
              Del menú a la mesa con realidad aumentada.
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-zinc-400">
              Los planes superiores preparan productos 3D para que el cliente pueda explorarlos y, en
              dispositivos compatibles, colocarlos virtualmente sobre una superficie real.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {["Vista previa 3D", "Escala aproximada", "AR real compatible", "Fallback interactivo"].map(
              (item) => (
                <div
                  className="grid min-h-36 place-items-center rounded-3xl border border-pink-500/20 bg-pink-500/10 p-5 text-center text-lg font-black"
                  key={item}
                >
                  {item}
                </div>
              ),
            )}
          </div>
        </div>
      </section>

      <section className="shell pb-24">
        <div className="rounded-[2.5rem] border border-white/10 bg-gradient-to-br from-pink-600/25 to-zinc-950 p-7 sm:p-12">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="section-eyebrow">Planes disponibles</p>
              <h2 className="mt-2 text-4xl font-black">Empezá donde tiene sentido.</h2>
            </div>
            <Link className="btn" href="/planes">
              Comparar funcionalidades
            </Link>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan) => (
              <article className="rounded-2xl border border-white/10 bg-black/30 p-5" key={plan.id}>
                <h3 className="font-black">{plan.name}</h3>
                <p className="mt-2 line-clamp-3 text-sm text-zinc-400">{plan.summary}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {faqs.length > 0 && (
        <section className="shell pb-24">
          <p className="section-eyebrow">Preguntas frecuentes</p>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {faqs.map((faq) => (
              <details className="rounded-2xl border border-white/10 p-5" key={faq.id}>
                <summary className="cursor-pointer font-black">{faq.question}</summary>
                <p className="mt-4 text-zinc-400">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>
      )}
    </main>
    </MarketingShell>
  );
}
