"use client";

import { useState } from "react";
import Swal from "sweetalert2";
import { PageHeader, StatusBadge, KpiCard } from "@/components/admin/ui";
import { scopedFetch } from "@/lib/client-routing";

export type LoyaltyRewardData = {
  id: number;
  name: string;
  pointsNeeded: number;
  description: string | null;
  benefitType: string;
  value: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: string;
};

const benefitLabels: Record<string, string> = {
  discount: "Descuento",
  product: "Producto",
  free: "Gratis",
  other: "Otro beneficio",
};

const benefitOptions = [
  { value: "discount", label: "Descuento" },
  { value: "product", label: "Producto" },
  { value: "free", label: "Gratis" },
  { value: "other", label: "Otro beneficio" },
];

const benefitColors: Record<string, string> = {
  discount: "bg-sky-500/15 text-sky-300",
  product: "bg-amber-500/15 text-amber-300",
  free: "bg-emerald-500/15 text-emerald-300",
  other: "bg-violet-500/15 text-violet-300",
};

/** @summary Gestiona las recompensas canjeables por puntos que ven los clientes frecuentes. */
export function RewardsManager({
  initialRewards,
  initialCustomerCount,
}: {
  initialRewards: LoyaltyRewardData[];
  initialCustomerCount: number;
}) {
  const [rewards, setRewards] = useState(initialRewards);
  const [editing, setEditing] = useState<LoyaltyRewardData | null>(null);
  const [creating, setCreating] = useState(false);

  const activeCount = rewards.filter((reward) => reward.active).length;
  const cheapest = rewards.length ? Math.min(...rewards.map((reward) => reward.pointsNeeded)) : 0;

  /** @summary Guarda una recompensa nueva o editada según corresponda. */
  async function save(form: HTMLFormElement) {
    const data = new FormData(form);
    const payload = {
      name: data.get("name"),
      pointsNeeded: data.get("pointsNeeded"),
      benefitType: data.get("benefitType"),
      value: data.get("value"),
      description: data.get("description"),
      active: data.get("active") === "on",
      sortOrder: data.get("sortOrder"),
    };
    const url = editing ? `/api/admin/loyalty-rewards/${editing.id}` : "/api/admin/loyalty-rewards";
    const response = await scopedFetch(url, {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await response.json().catch(() => ({}))) as {
      reward?: LoyaltyRewardData;
      error?: string;
    };
    if (!response.ok || !body.reward) {
      await Swal.fire({
        title: "No se pudo guardar",
        text: body.error ?? "Intentá nuevamente.",
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
      return;
    }
    setRewards((current) =>
      editing
        ? current.map((item) => (item.id === body.reward!.id ? body.reward! : item))
        : [...current, body.reward!],
    );
    setEditing(null);
    setCreating(false);
    await Swal.fire({
      title: "Recompensa guardada",
      icon: "success",
      timer: 1200,
      showConfirmButton: false,
      background: "#18181b",
      color: "#fafafa",
    });
  }

  /** @summary Solicita confirmación y elimina la recompensa. */
  async function remove(reward: LoyaltyRewardData) {
    const confirmation = await Swal.fire({
      title: `¿Eliminar "${reward.name}"?`,
      text: "Los clientes dejarán de ver esta recompensa en su progreso.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ef4444",
      background: "#18181b",
      color: "#fafafa",
    });
    if (!confirmation.isConfirmed) return;
    const response = await scopedFetch(`/api/admin/loyalty-rewards/${reward.id}`, { method: "DELETE" });
    if (!response.ok) {
      await Swal.fire({
        title: "No se pudo eliminar",
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
      return;
    }
    setRewards((current) => current.filter((item) => item.id !== reward.id));
    if (editing?.id === reward.id) setEditing(null);
  }

  /** @summary Alterna la visibilidad de la recompensa sin perder su configuración. */
  async function toggleActive(reward: LoyaltyRewardData) {
    const response = await scopedFetch(`/api/admin/loyalty-rewards/${reward.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: reward.name,
        pointsNeeded: reward.pointsNeeded,
        benefitType: reward.benefitType,
        value: reward.value ?? "",
        description: reward.description ?? "",
        active: !reward.active,
        sortOrder: reward.sortOrder,
      }),
    });
    const body = (await response.json().catch(() => ({}))) as {
      reward?: LoyaltyRewardData;
      error?: string;
    };
    if (!response.ok || !body.reward) return;
    setRewards((current) => current.map((item) => (item.id === reward.id ? body.reward! : item)));
  }

  const kpis = [
    { label: "Recompensas activas", value: activeCount, color: "text-pink-300" },
    { label: "Total recompensas", value: rewards.length, color: "text-sky-300" },
    { label: "Clientes frecuentes", value: initialCustomerCount, color: "text-zinc-100" },
    { label: "Recompensa más accesible", value: cheapest ? `${cheapest} pts` : "—", color: "text-amber-300" },
  ];

  return (
    <section>
      <PageHeader
        eyebrow="Fidelización"
        title="Recompensas"
        description="Definí qué beneficios canjean tus clientes frecuentes y desde cuántos puntos."
        section="fidelizacion"
      >
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button className="btn" onClick={() => setCreating(true)} type="button">
            Nueva recompensa
          </button>
        </div>
      </PageHeader>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            tone={kpi.color}
          />
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rewards.map((reward) => (
          <article className={`card p-5 ${reward.active ? "" : "opacity-60"}`} key={reward.id}>
            <div className="flex items-start justify-between gap-3">
              <p
                className={`rounded-full px-2.5 py-1 text-xs font-black ${benefitColors[reward.benefitType] ?? benefitColors.other}`}
              >
                <StatusBadge status={benefitLabels[reward.benefitType] ?? reward.benefitType} tone={
                  reward.benefitType === "discount" ? "info" :
                  reward.benefitType === "product" ? "warning" :
                  reward.benefitType === "free" ? "success" : "default"
                } />
              </p>
              <span className="text-xs text-zinc-600">#{reward.sortOrder}</span>
            </div>
            <h2 className="mt-3 text-xl font-black">{reward.name}</h2>
            {reward.description && <p className="mt-1 text-sm text-zinc-400">{reward.description}</p>}
            <div className="mt-4 flex items-end justify-between gap-3">
              <div>
                <p className="text-3xl font-black tabular-nums text-pink-300">{reward.pointsNeeded}</p>
                <p className="text-xs text-zinc-500">puntos para canjear</p>
              </div>
              {reward.value && (
                <p className="rounded-xl bg-white/5 px-3 py-1.5 text-sm font-black">{reward.value}</p>
              )}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                className="btn btn-secondary flex-1 py-2 text-sm"
                onClick={() => setEditing(reward)}
                type="button"
              >
                Editar
              </button>
              <button
                className={`flex-1 rounded-xl py-2 text-sm font-bold transition ${
                  reward.active
                    ? "bg-white/5 text-zinc-400 hover:bg-white/10"
                    : "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                }`}
                onClick={() => void toggleActive(reward)}
                type="button"
              >
                {reward.active ? "Pausar" : "Activar"}
              </button>
              <button
                className="rounded-xl bg-red-500/10 px-3 py-2 text-sm font-bold text-red-300 hover:bg-red-500/20"
                onClick={() => void remove(reward)}
                type="button"
                aria-label="Eliminar recompensa"
              >
                ×
              </button>
            </div>
          </article>
        ))}
        {!rewards.length && (
          <p className="card col-span-full p-10 text-center text-zinc-500">
            Todavía no configuraste recompensas. Creá la primera para que tus clientes puedan canjear puntos.
          </p>
        )}
      </div>

      {(creating || editing) && (
        <div
          className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/85 p-4"
          onClick={() => {
            setCreating(false);
            setEditing(null);
          }}
        >
          <form
            className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-zinc-950 p-6 sm:p-8"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              void save(event.currentTarget);
            }}
          >
            <p className="section-eyebrow">{editing ? "Editar recompensa" : "Nueva recompensa"}</p>
            <h2 className="mt-1 text-3xl font-black">{editing?.name ?? "Beneficio canjeable"}</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="label">Nombre</span>
                <input
                  className="input"
                  name="name"
                  required
                  minLength={2}
                  maxLength={140}
                  defaultValue={editing?.name}
                  placeholder="Ej. Café gratis"
                />
              </label>
              <label>
                <span className="label">Puntos necesarios</span>
                <input
                  className="input"
                  name="pointsNeeded"
                  type="number"
                  min={1}
                  required
                  defaultValue={editing?.pointsNeeded}
                  placeholder="Ej. 1500"
                />
              </label>
              <label>
                <span className="label">Tipo de beneficio</span>
                <select
                  className="input"
                  name="benefitType"
                  defaultValue={editing?.benefitType ?? "discount"}
                >
                  {benefitOptions.map((option) => (
                    <option value={option.value} key={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="label">Valor visible</span>
                <input
                  className="input"
                  name="value"
                  maxLength={120}
                  defaultValue={editing?.value ?? ""}
                  placeholder="Ej. 1 café o 15% off"
                />
              </label>
              <label>
                <span className="label">Orden</span>
                <input
                  className="input"
                  name="sortOrder"
                  type="number"
                  min={0}
                  max={10000}
                  defaultValue={editing?.sortOrder ?? 0}
                />
              </label>
              <label className="sm:col-span-2">
                <span className="label">Descripción</span>
                <textarea
                  className="input min-h-20"
                  name="description"
                  maxLength={500}
                  defaultValue={editing?.description ?? ""}
                  placeholder="Explicá en qué consiste el beneficio."
                />
              </label>
              <label className="flex items-center gap-2 text-sm font-bold">
                <input type="checkbox" name="active" defaultChecked={editing?.active ?? true} /> Visible para
                los clientes
              </label>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button className="btn flex-1" type="submit">
                {editing ? "Guardar cambios" : "Crear recompensa"}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setCreating(false);
                  setEditing(null);
                }}
                type="button"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
