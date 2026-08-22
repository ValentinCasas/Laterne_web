"use client";

import { useState } from "react";
import Swal from "sweetalert2";
import { scopedFetch } from "@/lib/client-routing";
import { Drawer } from "@/components/admin/ui/drawer";
import { Icon } from "@/components/admin/ui/icons";

type Incident = {
  id: number;
  type: string;
  description: string;
  resolved: boolean;
  reportedAt: string | Date;
  delivery?: { id: number; number: string; customerName: string } | null;
};
type ActiveDelivery = { id: number; number: string; customerName: string };
const TYPES = ["cliente ausente", "dirección incorrecta", "rechazó el pedido", "problema de tránsito", "problema del vehículo", "otro"];

function formatDateTime(value: string | Date) {
  return new Date(value).toLocaleString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function IncidentCard({ incident }: { incident: Incident }) {
  return (
    <article className={`rounded-3xl border p-4 shadow-lg ${incident.resolved ? "border-white/10 bg-zinc-900/65" : "border-orange-400/15 bg-gradient-to-br from-orange-500/[.08] to-zinc-900"}`}>
      <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-2"><span className={`grid h-9 w-9 place-items-center rounded-2xl ${incident.resolved ? "bg-emerald-500/10 text-emerald-300" : "bg-orange-500/10 text-orange-300"}`}><Icon name={incident.resolved ? "check-circle" : "warning"} className="h-4 w-4" /></span><div><span className={`text-[10px] font-black uppercase tracking-wider ${incident.resolved ? "text-emerald-300" : "text-orange-300"}`}>{incident.resolved ? "Resuelta" : "Activa"}</span><h3 className="text-sm font-black capitalize text-white">{incident.type}</h3></div></div><time className="shrink-0 text-[11px] tabular-nums text-zinc-500">{formatDateTime(incident.reportedAt)}</time></div>
      <p className="mt-3 text-sm leading-6 text-zinc-300">{incident.description}</p>
      {incident.delivery && <p className="mt-3 rounded-xl bg-black/15 px-3 py-2 text-xs font-bold text-zinc-400">{incident.delivery.number} · {incident.delivery.customerName}</p>}
    </article>
  );
}

/** @summary Separa incidencias activas e históricas y permite reportar mediante un drawer mobile-first. */
export function DriverIncidentsPanel({ incidents: initialIncidents, activeDeliveries }: { incidents: Incident[]; activeDeliveries: ActiveDelivery[] }) {
  const [incidents, setIncidents] = useState(initialIncidents);
  const [open, setOpen] = useState(false);
  const [deliveryId, setDeliveryId] = useState(activeDeliveries[0]?.id ?? 0);
  const [type, setType] = useState(TYPES[0]!);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const active = incidents.filter((incident) => !incident.resolved);
  const history = incidents.filter((incident) => incident.resolved);

  async function submit() {
    if (!deliveryId || !description.trim()) return;
    setSaving(true);
    try {
      const response = await scopedFetch("/api/driver/incidents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deliveryId, type, description: description.trim() }) });
      const body = (await response.json().catch(() => ({}))) as { incident?: Incident; error?: string };
      if (!response.ok || !body.incident) {
        await Swal.fire({ title: "No se pudo reportar", text: body.error ?? "Intentá de nuevo.", icon: "error", background: "#18181b", color: "#fafafa" });
        return;
      }
      setIncidents((current) => [body.incident!, ...current]);
      setDescription("");
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <header className="mb-5 flex items-end justify-between gap-3 px-1"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-orange-300">Soporte operativo</p><h1 className="mt-1 text-2xl font-black">Incidencias</h1><p className="mt-1 text-sm text-zinc-500">Reportá bloqueos vinculados a una entrega.</p></div><button type="button" className="min-h-11 shrink-0 rounded-2xl bg-orange-600 px-4 text-xs font-black text-white transition hover:bg-orange-500 active:scale-[.98]" onClick={() => setOpen(true)}><Icon name="plus" className="mr-1.5 inline h-4 w-4" />Nueva</button></header>

      {incidents.length === 0 && <div className="rounded-3xl border border-dashed border-white/10 bg-white/[.015] px-6 py-12 text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white/5 text-zinc-500"><Icon name="check-circle" className="h-6 w-6" /></span><h2 className="mt-4 font-black text-white">Todo en orden</h2><p className="mt-1 text-sm text-zinc-500">No reportaste incidencias.</p></div>}

      {active.length > 0 && <section><div className="mb-3 flex items-center justify-between px-1"><h2 className="text-sm font-black text-white">Incidencias activas</h2><span className="rounded-full bg-orange-500/15 px-2.5 py-1 text-xs font-black text-orange-300">{active.length}</span></div><div className="space-y-3">{active.map((incident) => <IncidentCard key={incident.id} incident={incident} />)}</div></section>}
      {history.length > 0 && <section className="mt-6"><div className="mb-3 flex items-center justify-between px-1"><h2 className="text-sm font-black text-white">Histórico</h2><span className="text-xs text-zinc-500">{history.length}</span></div><div className="space-y-3">{history.map((incident) => <IncidentCard key={incident.id} incident={incident} />)}</div></section>}

      <Drawer open={open} onClose={() => setOpen(false)} title="Nueva incidencia" width="460px">
        {activeDeliveries.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center"><Icon name="inbox" className="mx-auto h-7 w-7 text-zinc-500" /><h2 className="mt-3 font-black text-white">Sin entregas activas</h2><p className="mt-1 text-sm leading-6 text-zinc-500">Las incidencias se reportan sobre una entrega en curso.</p></div> : <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
          <label className="block text-xs font-bold text-zinc-300">Entrega relacionada<select className="input mt-2 w-full" value={deliveryId} onChange={(event) => setDeliveryId(Number(event.target.value))}>{activeDeliveries.map((delivery) => <option key={delivery.id} value={delivery.id}>{delivery.number} · {delivery.customerName}</option>)}</select></label>
          <label className="block text-xs font-bold text-zinc-300">Tipo<select className="input mt-2 w-full" value={type} onChange={(event) => setType(event.target.value)}>{TYPES.map((entry) => <option key={entry} value={entry}>{entry[0]!.toUpperCase() + entry.slice(1)}</option>)}</select></label>
          <label className="block text-xs font-bold text-zinc-300">Descripción<textarea className="input mt-2 min-h-32 w-full resize-y" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Contanos qué pasó…" maxLength={2000} required /></label>
          <p className="text-[11px] leading-5 text-zinc-500">La incidencia queda registrada con fecha, entrega y usuario. No se adjunta foto porque el backend actual no ofrece ese soporte.</p>
          <button type="submit" disabled={saving || !description.trim()} className="min-h-13 w-full rounded-2xl bg-orange-600 px-4 font-black text-white transition hover:bg-orange-500 disabled:opacity-50">{saving ? "Reportando…" : "Reportar incidencia"}</button>
        </form>}
      </Drawer>
    </>
  );
}
