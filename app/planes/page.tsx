import Link from "next/link";
import { PricingCatalog, type CommercialPlan } from "@/components/commercial/pricing-catalog";
import { prisma } from "@/lib/prisma";
import { managedPageMetadata } from "@/lib/seo";
import { MarketingShell } from "@/components/commercial/marketing-shell";

/** @summary Recupera la configuración SEO administrable de planes comerciales. */
export function generateMetadata() {
  return managedPageMetadata(
    "/planes",
    "Planes y precios",
    "Planes MenuClick para cartas digitales, gestión gastronómica, reservas, pedidos y experiencias 3D.",
  );
}

/** @summary Consulta el catálogo comercial administrable y presenta planes, comparación y preguntas frecuentes. */
export default async function PlansPage() {
  const [records, faqs] = await Promise.all([
    prisma.plan.findMany({
      where: { active: true },
      include: {
        prices: { where: { active: true }, orderBy: { validFrom: "desc" }, take: 1 },
        features: {
          where: { included: true, feature: { active: true } },
          include: { feature: true },
          orderBy: { displayOrder: "asc" },
        },
      },
      orderBy: [{ type: "asc" }, { displayOrder: "asc" }],
    }),
    prisma.commercialFaq.findMany({
      where: { audience: "plans", active: true },
      orderBy: { displayOrder: "asc" },
    }),
  ]);
  const plans: CommercialPlan[] = records.map((plan) => ({
    id: plan.id,
    slug: plan.slug,
    name: plan.name,
    summary: plan.summary,
    audience: plan.audience,
    type: plan.type,
    billingMode: plan.billingMode,
    badge: plan.badge,
    highlighted: plan.highlighted,
    price: plan.prices[0]
      ? {
          currency: plan.prices[0].currency,
          amount: plan.prices[0].amount ? Number(plan.prices[0].amount) : null,
          billingPeriod: plan.prices[0].billingPeriod,
        }
      : null,
    features: plan.features.map((item) => ({
      key: item.feature.key,
      name: item.feature.name,
      category: item.feature.category,
      included: item.included,
      detail: item.detail,
    })),
  }));

  return (
    <MarketingShell>
      <main>
        <section className="relative overflow-hidden py-20 sm:py-28">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(236,72,153,.25),transparent_45%)]" />
          <div className="shell relative text-center">
            <p className="section-eyebrow">Inversión clara · crecimiento progresivo</p>
            <h1 className="mx-auto mt-3 max-w-5xl text-5xl font-black tracking-[-.06em] sm:text-8xl">
              Un plan para cada etapa del negocio.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400">
              Los valores son orientativos y se administran desde la plataforma. El presupuesto final depende
              del alcance, contenido, dominio, hosting e integraciones.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link className="btn" href="/solicitar-demo">
                Solicitar demostración
              </Link>
              <Link className="btn btn-secondary" href="/para-negocios">
                Conocer la solución
              </Link>
            </div>
          </div>
        </section>
        <section className="shell pb-24">
          <PricingCatalog plans={plans} />
        </section>
        <section className="border-y border-white/10 bg-zinc-950 py-20">
          <div className="shell grid gap-10 lg:grid-cols-[.8fr_1.2fr]">
            <div>
              <p className="section-eyebrow">Proceso de contratación</p>
              <h2 className="mt-2 text-4xl font-black">De la consulta a la publicación.</h2>
            </div>
            <ol className="grid gap-4 sm:grid-cols-2">
              {[
                "Relevamiento del negocio",
                "Definición de alcance",
                "Diseño y configuración",
                "Carga y validación",
                "Publicación",
                "Acompañamiento inicial",
              ].map((step, index) => (
                <li className="flex gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-4" key={step}>
                  <span className="font-black text-pink-400">{String(index + 1).padStart(2, "0")}</span>
                  <span className="font-bold">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>
        <section className="shell py-24">
          <p className="section-eyebrow">Preguntas frecuentes</p>
          <h2 className="mt-2 text-4xl font-black sm:text-6xl">Antes de empezar.</h2>
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {faqs.map((faq) => (
              <details
                className="group rounded-2xl border border-white/10 bg-white/[.03] p-5 open:border-pink-500/30"
                key={faq.id}
              >
                <summary className="cursor-pointer list-none pr-8 font-black">{faq.question}</summary>
                <p className="mt-4 leading-relaxed text-zinc-400">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
    </MarketingShell>
  );
}
