"use client";

import { useState } from "react";
import Swal from "sweetalert2";
import { scopedFetch } from "@/lib/client-routing";
import { Drawer } from "@/components/admin/ui/drawer";
import { Icon } from "@/components/admin/ui/icons";
import { formatDateTimeShort } from "@/lib/date-format";

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
  return formatDateTimeShort(value);
}

function IncidentCard({ incident }: { incident: Incident }) {
  return (
    <article className={`group overflow-hidden rounded-2xl border p-4 shadow-lg transition-all duration-200 ${incident.resolved ? "border-white/[.06] bg-zinc-900/60 hover:border-white/10" : "border-orange-400/15 bg-gradient-to-br from-orange-500/[.08] to-zinc-900 hover:border-orange-400/25"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${incident.resolved ? "bg-emerald-500/10 text-emerald-300" : "bg-orange-500/15 text-orange-300"}`}>
            <Icon name={incident.resolved ? "check-circle" : "warning"} className="h-5 w-5" />
          </span>
          <div>
            <span className={`text-[10px] font-black uppercase tracking-wider ${incident.resolved ? "text-emerald-300" : "text-orange-300"}`}>
              {incident.resolved ? "Resuelta" : "Activa"}
            </span>
            <h3 className="text-sm font-black capitalize text-white">{incident.type}</h3>
          </div>
        </div>
        <time className="shrink-0 text-[11px] tabular-nums text-zinc-500">{formatDateTime(incident.reportedAt)}</time>
      </div>
      <p className="mt-3 text-sm leading-6 text-zinc-300">{incident.description}</p>
      {incident.delivery && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-black/15 px-3 py-2">
          <Icon name="package" className="h-3.5 w-3.5 text-zinc-500" />
          <span className="text-xs font-bold text-zinc-400">{incident.delivery.number} · {incident.delivery.customerName}</span>
        </div>
      )}
    </article>
  );
}

/** @summary Panel de incidencias premium con listado, reporte y estados visuales claros. */
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
      {/* Header */}
      <header className="mb-5 flex items-end justify-between gap-3 px-1">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-orange-300">Soporte operativo</p>
          <h1 className="mt-1 text-2xl font-black text-white">Incidencias</h1>
          <p className="mt-1 text-sm text-zinc-500">Reportá bloqueos vinculados a una entrega.</p>
        </div>
        <button
          type="button"
          className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-2xl bg-orange-600 px-4 text-xs font-black text-white shadow-lg shadow-orange-950/30 transition hover:bg-orange-500 active:scale-[.98]"
          onClick={() => setOpen(true)}
        >
          <Icon name="plus" className="h-4 w-4" />
          Nueva
        </button>
      </header>

      {/* Empty state */}
      {incidents.length === 0 && (
        <div className="rounded-3xl border border-dashed border-white/10 bg-white/[.015] px-6 py-16 text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500/10 to-transparent text-emerald-400">
            <Icon name="check-circle" className="h-7 w-7" />
          </span>
          <h2 className="mt-5 text-lg font-black text-white">Todo en orden</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-zinc-500">No reportaste ninguna incidencia. ¡Seguí así!</p>
        </div>
      )}

      {/* Active incidents */}
      {active.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between px-1">
            <h2 className="text-sm font-black text-white">Incidencias activas</h2>
            <span className="rounded-full bg-orange-500/15 px-2.5 py-1 text-xs font-black text-orange-300">{active.length}</span>
          </div>
          <div className="space-y-3">{active.map((incident) => <IncidentCard key={incident.id} incident={incident} />)}</div>
        </section>
      )}

      {/* History */}
      {history.length > 0 && (
        <section className={active.length > 0 ? "mt-6" : ""}>
          <div className="mb-3 flex items-center justify-between px-1">
            <h2 className="text-sm font-black text-white">Histórico</h2>
            <span className="text-xs text-zinc-500">{history.length}</span>
          </div>
          <div className="space-y-3">{history.map((incident) => <IncidentCard key={incident.id} incident={incident} />)}</div>
        </section>
      )}

      {/* New incident drawer */}
      <Drawer open={open} onClose={() => setOpen(false)} title="Nueva incidencia" width="460px">
        {activeDeliveries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center">
            <Icon name="inbox" className="mx-auto h-7 w-7 text-zinc-500" />
            <h2 className="mt-3 font-black text-white">Sin entregas activas</h2>
            <p className="mt-1 text-sm leading-6 text-zinc-500">Las incidencias se reportan sobre una entrega en curso.</p>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
            <label className="block text-xs font-bold text-zinc-300">
              Entrega relacionada
              <select className="input mt-2 w-full" value={deliveryId} onChange={(event) => setDeliveryId(Number(event.target.value))}>
                {activeDeliveries.map((delivery) => (
                  <option key={delivery.id} value={delivery.id}>{delivery.number} · {delivery.customerName}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-bold text-zinc-300">
              Tipo
              <select className="input mt-2 w-full" value={type} onChange={(event) => setType(event.target.value)}>
                {TYPES.map((entry) => (
                  <option key={entry} value={entry}>{entry[0]!.toUpperCase() + entry.slice(1)}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-bold text-zinc-300">
              Descripción
              <textarea
                className="input mt-2 min-h-32 w-full resize-y"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Contanos qué pasó con esta entrega…"
                maxLength={2000}
                required
              />
            </label>
            <p className="text-[11px] leading-5 text-zinc-500">La incidencia queda registrada con fecha, entrega y usuario.</p>
            <button
              type="submit"
              disabled={saving || !description.trim()}
              className="flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-orange-600 px-4 font-black text-white transition hover:bg-orange-500 disabled:opacity-50"
            >
              {saving ? <Icon name="loader" className="h-4 w-4 animate-spin" /> : <Icon name="warning" className="h-4 w-4" />}
              {saving ? "Reportando…" : "Reportar incidencia"}
            </button>
          </form>
        )}
      </Drawer>
    </>
  );
}
