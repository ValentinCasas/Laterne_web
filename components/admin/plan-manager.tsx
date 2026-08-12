"use client";

import { useState } from "react";
import Swal from "sweetalert2";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { scopedFetch } from "@/lib/client-routing";

type FeatureOption = { id: number; name: string; category: string };
type PlanData = {
  id: number;
  slug: string;
  name: string;
  summary: string;
  audience: string | null;
  type: string;
  billingMode: string;
  badge: string | null;
  highlighted: boolean;
  active: boolean;
  displayOrder: number;
  prices: Array<{ currency: string; amount: string | number | null; billingPeriod: string }>;
  features: Array<{ featureId: number; feature: FeatureOption }>;
};

/** @summary Administra planes, precios vigentes, modalidades y funcionalidades comerciales. */
export function PlanManager({
  initialPlans,
  featureOptions,
}: {
  initialPlans: PlanData[];
  featureOptions: FeatureOption[];
}) {
  const [plans, setPlans] = useState(initialPlans);
  const [editing, setEditing] = useState<PlanData | null | "new">(null);
  const [saving, setSaving] = useState(false);

  /** @summary Cierra el editor y descarta cualquier borrador todavía no guardado. */
  function closeEditor() {
    setEditing(null);
  }

  /** @summary Envía la configuración completa del plan y actualiza su tarjeta visible. */
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const id = editing !== "new" && editing ? editing.id : null;
    const billingMode = String(form.get("billingMode"));
    const payload = {
      name: form.get("name"),
      slug: form.get("slug"),
      summary: form.get("summary"),
      audience: form.get("audience") || undefined,
      type: form.get("type"),
      billingMode,
      badge: form.get("badge") || undefined,
      highlighted: form.get("highlighted") === "on",
      active: form.get("active") === "on",
      displayOrder: Number(form.get("displayOrder") || 0),
      currency: String(form.get("currency") || "ARS"),
      amount: billingMode === "quote" ? null : Number(form.get("amount") || 0),
      billingPeriod: form.get("billingPeriod"),
      featureIds: form.getAll("featureIds").map(Number),
    };

    try {
      const response = await scopedFetch(id ? `/api/admin/plans/${id}` : "/api/admin/plans", {
        method: id ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as { plan?: PlanData; error?: string };
      if (!response.ok || !body.plan) throw new Error(body.error ?? "No se pudo guardar el plan");
      setPlans((current) =>
        id ? current.map((plan) => (plan.id === id ? body.plan! : plan)) : [...current, body.plan!],
      );
      closeEditor();
      await Swal.fire({
        title: id ? "Plan actualizado" : "Plan creado",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
        background: "#18181b",
        color: "#fafafa",
      });
    } catch (error) {
      await Swal.fire({
        title: "No se pudo guardar",
        text: error instanceof Error ? error.message : "Revisá los datos.",
        icon: "error",
        confirmButtonColor: "#ec4899",
        background: "#18181b",
        color: "#fafafa",
      });
    } finally {
      setSaving(false);
    }
  }

  /** @summary Confirma y archiva un plan para ocultarlo sin perder su historial comercial. */
  async function archive(plan: PlanData) {
    const confirmation = await Swal.fire({
      title: "¿Ocultar este plan?",
      text: "Dejará de aparecer públicamente, pero conservará precios y consultas relacionadas.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Ocultar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ef4444",
      background: "#18181b",
      color: "#fafafa",
    });
    if (!confirmation.isConfirmed) return;
    const response = await scopedFetch(`/api/admin/plans/${plan.id}`, { method: "DELETE" });
    if (response.ok)
      setPlans((current) => current.map((item) => (item.id === plan.id ? { ...item, active: false } : item)));
  }

  const current = editing === "new" ? null : editing;
  const currentPrice = current?.prices[0];
  const selectedFeatures = new Set(current?.features.map((item) => item.featureId) ?? []);
  const groupedFeatures = featureOptions.reduce<Map<string, FeatureOption[]>>((groups, feature) => {
    const current = groups.get(feature.category) ?? [];
    current.push(feature);
    groups.set(feature.category, current);
    return groups;
  }, new Map());

  return (
    <section>
      <AdminPageHeader
        eyebrow="Oferta comercial"
        title="Planes y precios"
        description="Los cambios se reflejan en la página pública sin modificar componentes."
        section="planes"
        actions={
          <button className="btn" onClick={() => setEditing("new")} type="button">
            Crear plan
          </button>
        }
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {plans.map((plan) => {
          const price = plan.prices[0];
          return (
            <article
              className={`rounded-3xl border p-5 ${plan.active ? "border-white/10 bg-zinc-950" : "border-white/5 bg-zinc-950/40 opacity-60"}`}
              key={plan.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase text-pink-300">
                    {plan.type === "maintenance" ? "Mantenimiento" : "Implementación"}
                  </p>
                  <h2 className="mt-1 text-xl font-black">{plan.name}</h2>
                </div>
                {plan.badge && (
                  <span className="rounded-full bg-pink-500/15 px-2 py-1 text-[10px] font-black text-pink-300">
                    {plan.badge}
                  </span>
                )}
              </div>
              <p className="mt-3 line-clamp-3 min-h-16 text-sm leading-relaxed text-zinc-500">
                {plan.summary}
              </p>
              <strong className="mt-5 block text-2xl">
                {price?.amount
                  ? `${price.currency} ${Number(price.amount).toLocaleString("es-AR")}`
                  : "A cotizar"}
              </strong>
              <p className="mt-1 text-xs text-zinc-600">
                {plan.features.length} funcionalidades · {plan.active ? "Visible" : "Oculto"}
              </p>
              <div className="mt-5 flex gap-2 border-t border-white/10 pt-4">
                <button
                  className="flex-1 rounded-xl bg-white/5 px-3 py-2 text-sm font-bold hover:bg-pink-500"
                  onClick={() => setEditing(plan)}
                  type="button"
                >
                  Editar
                </button>
                {plan.active && (
                  <button
                    className="rounded-xl bg-red-500/10 px-3 py-2 text-sm font-bold text-red-300"
                    onClick={() => archive(plan)}
                    type="button"
                  >
                    Ocultar
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {editing && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/85 p-4 backdrop-blur-sm">
          <form
            className="mx-auto my-6 grid w-full max-w-5xl gap-5 rounded-[2rem] border border-white/10 bg-zinc-950 p-5 sm:grid-cols-2 sm:p-8"
            onSubmit={save}
          >
            <div className="flex items-start justify-between gap-4 sm:col-span-2">
              <div>
                <p className="section-eyebrow">Editor comercial</p>
                <h2 className="mt-1 text-3xl font-black">{current ? current.name : "Nuevo plan"}</h2>
              </div>
              <button
                className="grid h-10 w-10 place-items-center rounded-full bg-white/5 text-xl"
                onClick={closeEditor}
                type="button"
                aria-label="Cerrar editor"
              >
                ×
              </button>
            </div>
            <label className="text-sm font-bold">
              Nombre
              <input className="input mt-2" name="name" required defaultValue={current?.name ?? ""} />
            </label>
            <label className="text-sm font-bold">
              Dirección pública
              <input
                className="input mt-2"
                name="slug"
                defaultValue={current?.slug ?? ""}
                placeholder="Se genera desde el nombre"
              />
            </label>
            <label className="text-sm font-bold sm:col-span-2">
              Resumen
              <textarea
                className="input mt-2 min-h-24"
                name="summary"
                required
                defaultValue={current?.summary ?? ""}
              />
            </label>
            <label className="text-sm font-bold sm:col-span-2">
              Cliente ideal
              <input className="input mt-2" name="audience" defaultValue={current?.audience ?? ""} />
            </label>
            <label className="text-sm font-bold">
              Tipo
              <select className="input mt-2" name="type" defaultValue={current?.type ?? "implementation"}>
                <option value="implementation">Implementación</option>
                <option value="maintenance">Mantenimiento</option>
              </select>
            </label>
            <label className="text-sm font-bold">
              Modalidad
              <select
                className="input mt-2"
                name="billingMode"
                defaultValue={current?.billingMode ?? "one_time"}
              >
                <option value="one_time">Pago único</option>
                <option value="monthly">Mensual</option>
                <option value="quote">A cotizar</option>
              </select>
            </label>
            <label className="text-sm font-bold">
              Moneda
              <input
                className="input mt-2 uppercase"
                name="currency"
                maxLength={3}
                defaultValue={currentPrice?.currency ?? "ARS"}
              />
            </label>
            <label className="text-sm font-bold">
              Importe
              <input
                className="input mt-2"
                name="amount"
                min={0}
                type="number"
                defaultValue={currentPrice?.amount ? Number(currentPrice.amount) : ""}
              />
            </label>
            <label className="text-sm font-bold">
              Período
              <select
                className="input mt-2"
                name="billingPeriod"
                defaultValue={currentPrice?.billingPeriod ?? "once"}
              >
                <option value="once">Una vez</option>
                <option value="month">Por mes</option>
              </select>
            </label>
            <label className="text-sm font-bold">
              Etiqueta
              <input
                className="input mt-2"
                name="badge"
                defaultValue={current?.badge ?? ""}
                placeholder="Ej. Más elegido"
              />
            </label>
            <label className="text-sm font-bold">
              Orden
              <input
                className="input mt-2"
                name="displayOrder"
                min={0}
                type="number"
                defaultValue={current?.displayOrder ?? plans.length * 10 + 10}
              />
            </label>
            <div className="flex flex-wrap items-center gap-5 rounded-2xl border border-white/10 p-4">
              <label className="flex items-center gap-2 text-sm font-bold">
                <input
                  className="h-5 w-5 accent-pink-500"
                  name="active"
                  type="checkbox"
                  defaultChecked={current?.active ?? true}
                />
                Visible
              </label>
              <label className="flex items-center gap-2 text-sm font-bold">
                <input
                  className="h-5 w-5 accent-pink-500"
                  name="highlighted"
                  type="checkbox"
                  defaultChecked={current?.highlighted ?? false}
                />
                Destacado
              </label>
            </div>
            <fieldset className="sm:col-span-2">
              <legend className="text-sm font-black">Funcionalidades incluidas</legend>
              <div className="mt-4 space-y-5">
                {[...groupedFeatures.entries()].map(([category, features]) => (
                  <section key={category}>
                    <h3 className="text-xs font-black uppercase tracking-wider text-pink-300">{category}</h3>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {features.map((feature) => (
                        <label
                          className="flex items-center gap-2 rounded-xl border border-white/10 p-3 text-sm"
                          key={feature.id}
                        >
                          <input
                            className="h-4 w-4 accent-pink-500"
                            name="featureIds"
                            type="checkbox"
                            value={feature.id}
                            defaultChecked={selectedFeatures.has(feature.id)}
                          />
                          {feature.name}
                        </label>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </fieldset>
            <div className="flex gap-3 border-t border-white/10 pt-5 sm:col-span-2">
              <button className="btn min-w-40" disabled={saving}>
                {saving ? "Guardando…" : "Guardar plan"}
              </button>
              <button className="btn btn-secondary" onClick={closeEditor} type="button">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
