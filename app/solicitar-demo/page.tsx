import Link from "next/link";
import { DemoForm } from "@/components/commercial/demo-form";
import { prisma } from "@/lib/prisma";
import { managedPageMetadata } from "@/lib/seo";
import { MarketingShell } from "@/components/commercial/marketing-shell";

/** @summary Recupera la configuración SEO administrable de la solicitud comercial. */
export function generateMetadata() {
  return managedPageMetadata(
    "/solicitar-demo",
    "Solicitar demostración",
    "Solicitá una demostración preparada para tu negocio gastronómico.",
  );
}

/** @summary Presenta el proceso comercial y recopila la información necesaria para preparar una demostración. */
export default async function DemoPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const selectedSlug = (await searchParams).plan;
  const plans = await prisma.plan.findMany({
    where: { active: true, type: "implementation" },
    select: { id: true, name: true, slug: true },
    orderBy: { displayOrder: "asc" },
  });

  return (
    <MarketingShell>
      <main>
        <section className="shell py-16 sm:py-24">
          <Link className="text-sm font-bold text-pink-300 hover:text-pink-200" href="/para-negocios">
            ← Para negocios
          </Link>
          <div className="mt-8 grid items-end gap-8 lg:grid-cols-[1.1fr_.9fr]">
            <div>
              <p className="section-eyebrow">Demostración personalizada</p>
              <h1 className="mt-3 max-w-4xl text-5xl font-black tracking-[-.05em] sm:text-7xl">
                Veamos cómo funcionaría en tu negocio.
              </h1>
            </div>
            <p className="max-w-xl text-lg leading-relaxed text-zinc-400">
              No es una llamada genérica. Revisamos tu carta, operación y objetivos para mostrarte un
              recorrido relevante y recomendar un alcance realista.
            </p>
          </div>
        </section>
        <section className="shell grid gap-8 pb-24 lg:grid-cols-[minmax(0,1fr)_300px]">
          <DemoForm
            plans={plans}
            initialPlanId={plans.find((plan) => plan.slug === selectedSlug || plan.name === selectedSlug)?.id}
          />
          <aside className="h-fit rounded-[2rem] border border-white/10 bg-white/[.04] p-6 lg:sticky lg:top-24">
            <p className="section-eyebrow">Qué sigue</p>
            <ol className="mt-5 space-y-5">
              {[
                ["1", "Revisamos tu solicitud"],
                ["2", "Coordinamos una conversación breve"],
                ["3", "Preparamos una demo enfocada"],
                ["4", "Entregamos alcance y presupuesto"],
              ].map(([number, label]) => (
                <li className="flex items-center gap-3" key={number}>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-pink-500 font-black">
                    {number}
                  </span>
                  <span className="text-sm font-bold text-zinc-300">{label}</span>
                </li>
              ))}
            </ol>
            <p className="mt-6 border-t border-white/10 pt-5 text-sm leading-relaxed text-zinc-500">
              Tus datos se utilizan únicamente para responder la consulta y coordinar la demostración.
            </p>
          </aside>
        </section>
      </main>
    </MarketingShell>
  );
}
