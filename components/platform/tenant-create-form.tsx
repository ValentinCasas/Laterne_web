"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function TenantCreateForm({ plans }: { plans: Array<{ id: number; name: string }> }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const response = await fetch("/api/platform/tenants", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget).entries())) });
    const result = (await response.json().catch(() => ({}))) as { error?: string; tenantId?: number };
    setSaving(false);
    if (!response.ok) { setError(result.error ?? "No se pudo crear el cliente"); return; }
    router.push(result.tenantId ? `/platform/clientes/${result.tenantId}` : "/platform/clientes");
    router.refresh();
  }
  return <form className="grid gap-5 rounded-2xl border border-white/10 bg-[#151a24] p-6 sm:grid-cols-2" onSubmit={submit}><label><span className="mb-2 block text-sm font-bold text-slate-300">Nombre comercial</span><input className="platform-input" name="name" required placeholder="SODERIA" /></label><label><span className="mb-2 block text-sm font-bold text-slate-300">Slug</span><input className="platform-input" name="slug" placeholder="soderia" /></label><label><span className="mb-2 block text-sm font-bold text-slate-300">Nombre del propietario</span><input className="platform-input" name="ownerName" required /></label><label><span className="mb-2 block text-sm font-bold text-slate-300">Email de acceso</span><input className="platform-input" name="ownerEmail" required type="email" /></label><label><span className="mb-2 block text-sm font-bold text-slate-300">Contraseña inicial</span><input className="platform-input" name="password" minLength={10} required type="password" /></label><label><span className="mb-2 block text-sm font-bold text-slate-300">Plan inicial</span><select className="platform-input" name="planId"><option value="">Sin plan</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></label>{error && <p className="rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-200 sm:col-span-2">{error}</p>}<div className="flex gap-3 sm:col-span-2"><button className="rounded-xl bg-amber-400 px-5 py-3 font-black text-slate-950 disabled:opacity-50" disabled={saving}>{saving ? "Creando…" : "Crear cliente"}</button><button className="rounded-xl border border-white/10 px-5 py-3 font-bold text-slate-300" onClick={() => router.back()} type="button">Cancelar</button></div></form>;
}
