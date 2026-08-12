"use client";

import Link from "next/link";
import { useState } from "react";

type PlanOption = { id: number; name: string };
type DemoResponse = { ok?: boolean; leadId?: number; whatsappUrl?: string | null; error?: string };

const businessTypes = [
  "Bar",
  "Cervecería",
  "Restaurante",
  "Cafetería",
  "Heladería",
  "Food truck",
  "Vinoteca",
  "Panadería",
  "Delivery",
  "Otro negocio gastronómico",
];

const requestedFeatures = [
  "Carta digital",
  "Pedidos por WhatsApp",
  "Reservas",
  "Promociones",
  "Estadísticas",
  "Productos 3D y realidad aumentada",
  "Mesas y códigos QR",
  "Múltiples sucursales",
];

/** @summary Recopila una solicitud comercial, informa su estado y ofrece continuar por WhatsApp. */
export function DemoForm({ plans, initialPlanId }: { plans: PlanOption[]; initialPlanId?: number }) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<DemoResponse | null>(null);

  /** @summary Valida el formulario en el navegador y envía la oportunidad al servidor. */
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setSending(true);
    setResult(null);
    const form = new FormData(formElement);
    const payload = {
      fullName: form.get("fullName"),
      businessName: form.get("businessName"),
      businessType: form.get("businessType"),
      city: form.get("city"),
      province: form.get("province"),
      phone: form.get("phone"),
      email: form.get("email"),
      approximateProducts: form.get("approximateProducts") || undefined,
      branches: form.get("branches") || 1,
      planId: form.get("planId") || undefined,
      requiredFeatures: form.getAll("requiredFeatures"),
      approximateBudget: form.get("approximateBudget") || undefined,
      message: form.get("message") || undefined,
      consent: form.get("consent") === "on",
      source: "solicitar-demo",
      website: form.get("website"),
    };

    try {
      const response = await fetch("/api/demo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as DemoResponse;
      setResult(response.ok ? body : { error: body.error ?? "No pudimos enviar la solicitud." });
      if (response.ok) formElement.reset();
    } catch {
      setResult({ error: "No pudimos conectarnos. Revisá tu conexión e intentá nuevamente." });
    } finally {
      setSending(false);
    }
  }

  if (result?.ok) {
    return (
      <section
        className="rounded-[2rem] border border-emerald-500/30 bg-emerald-500/10 p-7 sm:p-10"
        role="status"
      >
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500 text-2xl">✓</span>
        <h2 className="mt-5 text-3xl font-black">Solicitud recibida</h2>
        <p className="mt-3 max-w-xl leading-relaxed text-zinc-300">
          Registramos la consulta #{result.leadId}. Vamos a revisar la información del negocio para preparar
          una demostración útil y concreta.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {result.whatsappUrl && (
            <a className="btn" href={result.whatsappUrl} target="_blank" rel="noreferrer">
              Continuar por WhatsApp
            </a>
          )}
          <Link className="btn btn-secondary" href="/planes">
            Volver a los planes
          </Link>
        </div>
      </section>
    );
  }

  return (
    <form
      className="grid gap-5 rounded-[2rem] border border-white/10 bg-zinc-950 p-5 sm:grid-cols-2 sm:p-8"
      onSubmit={submit}
    >
      <div className="hidden" aria-hidden="true">
        <label>
          Sitio web
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <label className="text-sm font-bold">
        Nombre y apellido
        <input className="input mt-2" name="fullName" required minLength={3} autoComplete="name" />
      </label>
      <label className="text-sm font-bold">
        Negocio
        <input className="input mt-2" name="businessName" required autoComplete="organization" />
      </label>
      <label className="text-sm font-bold">
        Tipo de negocio
        <select className="input mt-2" name="businessType" required defaultValue="">
          <option value="" disabled>
            Seleccioná una opción
          </option>
          {businessTypes.map((type) => (
            <option key={type}>{type}</option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm font-bold">
          Ciudad
          <input className="input mt-2" name="city" required autoComplete="address-level2" />
        </label>
        <label className="text-sm font-bold">
          Provincia
          <input className="input mt-2" name="province" required autoComplete="address-level1" />
        </label>
      </div>
      <label className="text-sm font-bold">
        Teléfono
        <input className="input mt-2" name="phone" required type="tel" autoComplete="tel" />
      </label>
      <label className="text-sm font-bold">
        Email
        <input className="input mt-2" name="email" required type="email" autoComplete="email" />
      </label>
      <label className="text-sm font-bold">
        Cantidad aproximada de productos
        <input className="input mt-2" name="approximateProducts" min={0} type="number" />
      </label>
      <label className="text-sm font-bold">
        Cantidad de sucursales
        <input className="input mt-2" name="branches" min={1} defaultValue={1} type="number" />
      </label>
      <label className="text-sm font-bold">
        Plan de interés
        <select className="input mt-2" name="planId" defaultValue={initialPlanId?.toString() ?? ""}>
          <option value="">Necesito recomendación</option>
          {plans.map((plan) => (
            <option value={plan.id} key={plan.id}>
              {plan.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-bold">
        Presupuesto aproximado
        <select className="input mt-2" name="approximateBudget" defaultValue="">
          <option value="">Prefiero conversarlo</option>
          <option>Hasta ARS 700.000</option>
          <option>ARS 700.000 a 1.500.000</option>
          <option>ARS 1.500.000 a 3.000.000</option>
          <option>Más de ARS 3.000.000</option>
        </select>
      </label>
      <fieldset className="sm:col-span-2">
        <legend className="text-sm font-bold">Funciones que necesitás</legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {requestedFeatures.map((feature) => (
            <label
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.03] p-3 text-sm"
              key={feature}
            >
              <input
                className="h-4 w-4 accent-pink-500"
                name="requiredFeatures"
                type="checkbox"
                value={feature}
              />
              {feature}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="sm:col-span-2 text-sm font-bold">
        Mensaje adicional
        <textarea className="input mt-2 min-h-32 resize-y" name="message" maxLength={2000} />
      </label>
      <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-4 text-sm leading-relaxed sm:col-span-2">
        <input className="mt-1 h-5 w-5 shrink-0 accent-pink-500" name="consent" required type="checkbox" />
        Acepto que me contacten para responder esta consulta y coordinar una demostración. Los datos no se
        utilizarán para otros fines sin autorización.
      </label>
      {result?.error && (
        <p
          className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200 sm:col-span-2"
          role="alert"
        >
          {result.error}
        </p>
      )}
      <button className="btn min-h-12 sm:col-span-2" disabled={sending}>
        {sending ? "Enviando solicitud…" : "Solicitar demostración"}
      </button>
    </form>
  );
}
