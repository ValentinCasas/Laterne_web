"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type CommercialPlan = {
  id: number;
  slug: string;
  name: string;
  summary: string;
  audience: string | null;
  type: string;
  billingMode: string;
  badge: string | null;
  highlighted: boolean;
  price: { currency: string; amount: number | null; billingPeriod: string } | null;
  features: Array<{ key: string; name: string; category: string; included: boolean; detail: string | null }>;
};

/** @summary Presenta planes administrables, alterna modalidades y recomienda una opción según necesidades. */
export function PricingCatalog({ plans }: { plans: CommercialPlan[] }) {
  const [type, setType] = useState<"implementation" | "maintenance">("implementation");
  const [needsGrowth, setNeedsGrowth] = useState(false);
  const [needs3d, setNeeds3d] = useState(false);
  const visiblePlans = plans.filter((plan) => plan.type === type);
  const recommendedSlug = needs3d ? "experiencia-3d" : needsGrowth ? "profesional" : "esencial";
  const recommended = plans.find((plan) => plan.slug === recommendedSlug);
  const comparisonFeatures = useMemo(() => {
    const features = new Map<string, { key: string; name: string; category: string }>();
    plans
      .filter((plan) => plan.type === "implementation")
      .flatMap((plan) => plan.features)
      .forEach((feature) => features.set(feature.key, feature));
    return [...features.values()];
  }, [plans]);
  const implementationPlans = plans.filter((plan) => plan.type === "implementation");

  /** @summary Convierte el importe almacenado en una etiqueta comercial localizada. */
  function priceLabel(plan: CommercialPlan) {
    if (!plan.price?.amount || plan.billingMode === "quote") return "A cotizar";
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: plan.price.currency,
      maximumFractionDigits: 0,
    }).format(plan.price.amount);
  }

  return (
    <>
      <div
        className="mx-auto flex w-fit rounded-2xl border border-white/10 bg-zinc-950 p-1"
        role="group"
        aria-label="Modalidad de contratación"
      >
        <button
          className={`rounded-xl px-5 py-3 text-sm font-black ${type === "implementation" ? "bg-pink-500 text-white" : "text-zinc-400"}`}
          onClick={() => setType("implementation")}
          type="button"
          aria-pressed={type === "implementation"}
        >
          Implementación
        </button>
        <button
          className={`rounded-xl px-5 py-3 text-sm font-black ${type === "maintenance" ? "bg-pink-500 text-white" : "text-zinc-400"}`}
          onClick={() => setType("maintenance")}
          type="button"
          aria-pressed={type === "maintenance"}
        >
          Servicio mensual
        </button>
      </div>

      <div
        className={`mt-9 grid gap-5 ${type === "implementation" ? "lg:grid-cols-2 xl:grid-cols-4" : "lg:grid-cols-3"}`}
      >
        {visiblePlans.map((plan) => (
          <article
            className={`relative flex min-w-0 flex-col rounded-[2rem] border p-6 ${
              plan.highlighted
                ? "border-pink-400 bg-gradient-to-b from-pink-500/20 to-zinc-950 shadow-2xl shadow-pink-950/40"
                : "border-white/10 bg-zinc-950"
            }`}
            key={plan.id}
          >
            {plan.badge && (
              <span className="mb-5 w-fit rounded-full bg-pink-500 px-3 py-1 text-[11px] font-black uppercase tracking-wider">
                {plan.badge}
              </span>
            )}
            <h2 className="text-2xl font-black">{plan.name}</h2>
            <p className="mt-3 min-h-20 text-sm leading-relaxed text-zinc-400">{plan.summary}</p>
            <div className="mt-6">
              <strong className="block text-3xl font-black tracking-tight">{priceLabel(plan)}</strong>
              <span className="mt-1 block text-xs text-zinc-500">
                {plan.billingMode === "monthly"
                  ? "por mes"
                  : plan.billingMode === "quote"
                    ? "según alcance"
                    : "pago inicial orientativo"}
              </span>
            </div>
            <ul className="mt-6 flex-1 space-y-3 border-t border-white/10 pt-5">
              {plan.features.map((feature) => (
                <li className="flex gap-2 text-sm leading-relaxed text-zinc-300" key={feature.key}>
                  <span className="text-pink-400" aria-hidden="true">
                    ✓
                  </span>
                  <span>{feature.detail || feature.name}</span>
                </li>
              ))}
            </ul>
            <Link
              className={`mt-7 ${plan.highlighted ? "btn" : "btn btn-secondary"}`}
              href={`/solicitar-demo?plan=${plan.slug}`}
            >
              {plan.billingMode === "quote" ? "Solicitar presupuesto" : "Solicitar demostración"}
            </Link>
          </article>
        ))}
      </div>

      <section className="mt-20 rounded-[2rem] border border-white/10 bg-white/[.04] p-6 sm:p-9">
        <div className="grid gap-8 lg:grid-cols-[1fr_.8fr] lg:items-center">
          <div>
            <p className="section-eyebrow">Recomendador</p>
            <h2 className="mt-2 text-3xl font-black sm:text-5xl">¿No sabés qué plan elegir?</h2>
            <p className="mt-3 max-w-xl text-zinc-400">
              Marcá las capacidades centrales y te mostramos un punto de partida. La recomendación no
              reemplaza el relevamiento.
            </p>
            <div className="mt-6 grid gap-3">
              <label className="flex items-center gap-3 rounded-xl border border-white/10 p-4">
                <input
                  className="h-5 w-5 accent-pink-500"
                  checked={needsGrowth}
                  onChange={(event) => setNeedsGrowth(event.target.checked)}
                  type="checkbox"
                />
                Necesito promociones, reservas, testimonios o estadísticas.
              </label>
              <label className="flex items-center gap-3 rounded-xl border border-white/10 p-4">
                <input
                  className="h-5 w-5 accent-pink-500"
                  checked={needs3d}
                  onChange={(event) => setNeeds3d(event.target.checked)}
                  type="checkbox"
                />
                Quiero productos 3D y realidad aumentada.
              </label>
            </div>
          </div>
          {recommended && (
            <div
              className="rounded-3xl border border-pink-500/30 bg-pink-500/10 p-6"
              role="status"
              aria-live="polite"
            >
              <p className="text-xs font-black uppercase tracking-widest text-pink-300">
                Punto de partida recomendado
              </p>
              <h3 className="mt-2 text-3xl font-black">{recommended.name}</h3>
              <p className="mt-3 text-sm leading-relaxed text-zinc-300">{recommended.summary}</p>
              <Link className="btn mt-6 w-full" href={`/solicitar-demo?plan=${recommended.slug}`}>
                Consultar este plan
              </Link>
            </div>
          )}
        </div>
      </section>

      <section className="mt-20">
        <div>
          <p className="section-eyebrow">Comparación completa</p>
          <h2 className="mt-2 text-3xl font-black sm:text-5xl">Qué incluye cada implementación</h2>
        </div>
        <div className="mt-7 overflow-x-auto rounded-3xl border border-white/10">
          <table className="w-full min-w-[850px] border-collapse text-left text-sm">
            <thead className="bg-zinc-950">
              <tr>
                <th className="p-4">Funcionalidad</th>
                {implementationPlans.map((plan) => (
                  <th className="p-4 text-center" key={plan.id}>
                    {plan.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparisonFeatures.map((feature) => (
                <tr className="border-t border-white/10" key={feature.key}>
                  <th className="p-4 font-medium text-zinc-300">{feature.name}</th>
                  {implementationPlans.map((plan) => {
                    const included = plan.features.some((item) => item.key === feature.key && item.included);
                    return (
                      <td className="p-4 text-center" key={plan.id}>
                        <span
                          className={included ? "text-emerald-300" : "text-zinc-700"}
                          aria-label={included ? "Incluido" : "No incluido"}
                        >
                          {included ? "✓" : "—"}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
