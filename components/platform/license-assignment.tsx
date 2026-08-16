"use client";

import { useState } from "react";

type Plan = { id: number; name: string };

/** @summary Permite asignar o cambiar la licencia de un cliente sin editar flags manualmente. */
export function LicenseAssignment({
  tenantId,
  plans,
  currentPlanId,
  currentStatus,
  currentEndsAt,
}: {
  tenantId: number;
  plans: Plan[];
  currentPlanId: number | null;
  currentStatus: string;
  currentEndsAt: string | null;
}) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  /**
   * @summary Valida y envía el formulario de la asignación de licencias.
   */
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const endsAt = String(form.get("endsAt") ?? "");
    const response = await fetch(`/api/platform/tenants/${tenantId}/license`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        planId: form.get("planId"),
        status: form.get("status"),
        endsAt: endsAt ? new Date(endsAt).toISOString() : null,
      }),
    });
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    setSaving(false);
    setMessage(
      response.ok
        ? "Licencia actualizada correctamente."
        : (result.error ?? "No se pudo asignar la licencia."),
    );
    if (response.ok) window.location.reload();
  }
  return (
    <section className="mx-auto mt-6 w-full max-w-[1440px] rounded-2xl border border-amber-300/20 bg-[#151a24] p-5 sm:p-6">
      <p className="text-xs font-black uppercase tracking-[.2em] text-amber-300">Licencia comercial</p>
      <h2 className="mt-2 text-2xl font-black">Asignar plan y acceso</h2>
      <p className="mt-2 text-sm text-slate-400">
        El plan determina límites y funcionalidades incluidas. Los overrides se administran por separado.
      </p>
      <form className="mt-5 grid gap-4 md:grid-cols-[1.4fr_1fr_1.2fr_auto] md:items-end" onSubmit={submit}>
        <label>
          <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">Plan</span>
          <select className="platform-input" name="planId" defaultValue={currentPlanId ?? ""} required>
            <option value="" disabled>
              Seleccionar plan
            </option>
            {plans.map((plan) => (
              <option value={plan.id} key={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
            Estado
          </span>
          <select className="platform-input" name="status" defaultValue={currentStatus || "ACTIVE"}>
            <option value="TRIAL">Trial</option>
            <option value="ACTIVE">Activa</option>
            <option value="PAYMENT_PENDING">Pago pendiente</option>
            <option value="GRACE_PERIOD">Período de gracia</option>
            <option value="SUSPENDED">Suspendida</option>
            <option value="CANCELLED">Cancelada</option>
          </select>
        </label>
        <label>
          <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
            Vencimiento
          </span>
          <input
            className="platform-input"
            name="endsAt"
            type="datetime-local"
            defaultValue={currentEndsAt?.slice(0, 16) ?? ""}
          />
        </label>
        <button
          className="rounded-xl bg-amber-400 px-5 py-3 font-black text-slate-950 disabled:opacity-50"
          disabled={saving}
        >
          {saving ? "Guardando…" : "Asignar licencia"}
        </button>
      </form>
      {message && (
        <p
          className={`mt-4 text-sm ${message.includes("correctamente") ? "text-emerald-300" : "text-rose-300"}`}
        >
          {message}
        </p>
      )}
    </section>
  );
}
