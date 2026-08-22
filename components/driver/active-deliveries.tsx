"use client";

import { useState } from "react";
import Swal from "sweetalert2";
import { scopedFetch } from "@/lib/client-routing";
import { deliveryStatusMeta, nextDriverStatus } from "@/lib/delivery-drivers";
import { Drawer } from "@/components/admin/ui/drawer";
import { Icon } from "@/components/admin/ui/icons";
import { Timeline } from "@/components/admin/ui/timeline";

export type DriverDelivery = {
  id: number;
  number: string;
  status: string;
  customerName: string;
  deliveryAddress?: string | null;
  contactPhone?: string | null;
  instructions?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  createdAt: string | Date;
  assignedAt?: string | Date | null;
  pickedUpAt?: string | Date | null;
  deliveredAt?: string | Date | null;
  order?: {
    id: number;
    reference: string;
    status: string;
    customerName: string;
    phone?: string | null;
    deliveryAddress?: string | null;
    notes?: string | null;
    total?: string | number | object;
    currency?: string;
    requestedAt?: string | Date | null;
  } | null;
  branch?: {
    id: number;
    name: string;
    address?: string | null;
    phone?: string | null;
    latitude?: unknown;
    longitude?: unknown;
  } | null;
  items?: Array<{ id: number; productName: string; quantityDelivered: number; unitPrice: string | number | object; notes?: string | null }>;
  incidents?: Array<{ id: number; type: string; description: string; resolved: boolean; reportedAt: string | Date }>;
  statusLogs?: Array<{ id?: number; status: string; previousStatus: string | null; changedAt: string | Date; reason?: string | null }>;
};

const SWAL_THEME = { background: "#18181b", color: "#fafafa" };
const INCIDENT_TYPES = ["cliente ausente", "dirección incorrecta", "rechazó el pedido", "problema de tránsito", "problema del vehículo", "otro"];

function formatMoney(value: unknown, currency = "ARS") {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

function formatTime(value: string | Date) {
  return new Date(value).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

function actionLabel(status: string) {
  if (status === "PICKED_UP") return "Retirar";
  if (status === "ON_THE_WAY") return "En camino";
  if (status === "DELIVERED") return "Entregado";
  return deliveryStatusMeta(status).label;
}

/** @summary Entregas activas como tarjetas operativas, detalle en drawer y mutaciones sin recargar la página. */
export function DriverActiveDeliveries({
  deliveries,
  onChange,
  onDelivered,
  onIncident,
}: {
  deliveries: DriverDelivery[];
  onChange: (deliveries: DriverDelivery[]) => void;
  onDelivered?: () => void;
  onIncident?: () => void;
}) {
  const items = deliveries;
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [incidentForId, setIncidentForId] = useState<number | null>(null);
  const [incidentType, setIncidentType] = useState(INCIDENT_TYPES[0]!);
  const [incidentDescription, setIncidentDescription] = useState("");
  const [workingId, setWorkingId] = useState<number | null>(null);

  const selected = items.find((delivery) => delivery.id === selectedId) ?? null;
  const incidentFor = items.find((delivery) => delivery.id === incidentForId) ?? null;

  function commit(nextItems: DriverDelivery[]) {
    onChange(nextItems);
  }

  async function advance(delivery: DriverDelivery) {
    const next = nextDriverStatus(delivery.status);
    if (!next) return;
    const confirmed = await Swal.fire({
      title: actionLabel(next),
      text: `La entrega avanzará a “${deliveryStatusMeta(next).label}”.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Confirmar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#16a34a",
      ...SWAL_THEME,
    });
    if (!confirmed.isConfirmed) return;
    setWorkingId(delivery.id);
    try {
      const response = await scopedFetch(`/api/driver/deliveries/${delivery.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const body = (await response.json().catch(() => ({}))) as { delivery?: { status: string }; error?: string };
      if (!response.ok || !body.delivery) {
        await Swal.fire({ title: "No se pudo avanzar", text: body.error ?? "Intentá de nuevo.", icon: "error", ...SWAL_THEME });
        return;
      }
      const changedAt = new Date();
      const nextItems = next === "DELIVERED"
        ? items.filter((item) => item.id !== delivery.id)
        : items.map((item) => item.id === delivery.id
          ? { ...item, status: body.delivery!.status, statusLogs: [...(item.statusLogs ?? []), { status: next, previousStatus: item.status, changedAt }] }
          : item);
      commit(nextItems);
      if (next === "DELIVERED") {
        onDelivered?.();
        setSelectedId(null);
      }
    } finally {
      setWorkingId(null);
    }
  }

  async function reportIncident() {
    if (!incidentFor || !incidentDescription.trim()) return;
    setWorkingId(incidentFor.id);
    try {
      const response = await scopedFetch("/api/driver/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryId: incidentFor.id, type: incidentType, description: incidentDescription.trim() }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        await Swal.fire({ title: "No se pudo reportar", text: body.error ?? "Intentá de nuevo.", icon: "error", ...SWAL_THEME });
        return;
      }
      commit(items.filter((item) => item.id !== incidentFor.id));
      onIncident?.();
      setIncidentForId(null);
      setSelectedId(null);
      setIncidentDescription("");
      await Swal.fire({ title: "Incidencia reportada", icon: "success", timer: 1100, showConfirmButton: false, ...SWAL_THEME });
    } finally {
      setWorkingId(null);
    }
  }

  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-white/10 bg-white/[.015] px-6 py-12 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white/5 text-zinc-500"><Icon name="package" className="h-6 w-6" /></span>
        <h3 className="mt-4 text-base font-black text-white">No tenés entregas activas</h3>
        <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-zinc-500">Cuando te asignen una aparecerá acá automáticamente.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {items.map((delivery) => {
          const meta = deliveryStatusMeta(delivery.status);
          const next = nextDriverStatus(delivery.status);
          const address = delivery.order?.deliveryAddress ?? delivery.deliveryAddress;
          return (
            <article key={delivery.id} className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/80 shadow-xl transition duration-200 hover:border-white/15">
              <button type="button" className="w-full p-4 text-left" onClick={() => setSelectedId(delivery.id)} aria-label={`Ver entrega ${delivery.number}`}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-black uppercase tracking-[.16em] text-zinc-500">Cliente</p>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${meta.badge}`}>{meta.label}</span>
                </div>
                <h3 className="mt-1 truncate text-lg font-black text-white">{delivery.order?.customerName ?? delivery.customerName}</h3>
                <p className="mt-1 flex items-start gap-2 text-sm leading-5 text-zinc-300"><Icon name="map-pin" className="mt-0.5 h-4 w-4 shrink-0 text-pink-400" />{address ?? "Dirección no informada"}</p>
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-500">
                  <span className="inline-flex items-center gap-1.5"><Icon name="receipt" className="h-3.5 w-3.5" />{delivery.order?.reference ?? delivery.number}</span>
                  <span className="inline-flex items-center gap-1.5"><Icon name="clock" className="h-3.5 w-3.5" />{formatTime(delivery.order?.requestedAt ?? delivery.createdAt)}</span>
                  {delivery.order?.total !== undefined && <span className="font-bold text-zinc-300">{formatMoney(delivery.order.total, delivery.order.currency)}</span>}
                </div>
              </button>
              <div className="grid grid-cols-[.75fr_1.25fr] gap-2 border-t border-white/5 p-3">
                <button type="button" className="min-h-12 rounded-2xl border border-white/10 bg-white/5 text-sm font-black text-white transition hover:bg-white/10" onClick={() => setSelectedId(delivery.id)}>Ver</button>
                {next && <button type="button" className="min-h-12 rounded-2xl bg-emerald-600 px-3 text-sm font-black text-white transition hover:bg-emerald-500 active:scale-[.99]" disabled={workingId === delivery.id} onClick={() => void advance(delivery)}>{workingId === delivery.id ? "Guardando…" : actionLabel(next)}</button>}
              </div>
            </article>
          );
        })}
      </div>

      <Drawer open={Boolean(selected)} onClose={() => setSelectedId(null)} title={selected ? `Entrega ${selected.number}` : "Entrega"} width="560px">
        {selected && (
          <div className="space-y-5 pb-24">
            <section className="rounded-2xl border border-white/10 bg-white/[.025] p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Cliente</p>
              <h3 className="mt-1 text-xl font-black text-white">{selected.order?.customerName ?? selected.customerName}</h3>
              <p className="mt-2 flex gap-2 text-sm text-zinc-300"><Icon name="map-pin" className="mt-0.5 h-4 w-4 shrink-0 text-pink-400" />{selected.order?.deliveryAddress ?? selected.deliveryAddress ?? "Dirección no informada"}</p>
              {(selected.order?.phone ?? selected.contactPhone) && <a className="mt-2 inline-flex items-center gap-2 text-sm font-bold text-sky-300" href={`tel:${selected.order?.phone ?? selected.contactPhone}`}><Icon name="phone" className="h-4 w-4" />{selected.order?.phone ?? selected.contactPhone}</a>}
              {(selected.instructions ?? selected.order?.notes) && <p className="mt-3 rounded-xl bg-amber-500/10 p-3 text-xs leading-5 text-amber-100">{selected.instructions ?? selected.order?.notes}</p>}
            </section>

            <section>
              <div className="flex items-center justify-between"><h3 className="text-sm font-black text-white">Pedido</h3>{selected.order?.total !== undefined && <span className="font-black text-emerald-300">{formatMoney(selected.order.total, selected.order.currency)}</span>}</div>
              <p className="mt-1 text-xs text-zinc-500">{selected.order?.reference ?? selected.number}</p>
              <ul className="mt-3 divide-y divide-white/5 rounded-2xl border border-white/10 px-4">
                {selected.items?.map((item) => <li key={item.id} className="flex items-center justify-between gap-3 py-3 text-sm"><span className="text-zinc-200">{item.productName}</span><span className="font-bold text-zinc-500">×{item.quantityDelivered}</span></li>)}
              </ul>
            </section>

            <section>
              <h3 className="mb-3 text-sm font-black text-white">Estado</h3>
              <Timeline items={(selected.statusLogs ?? []).map((log, index) => ({ id: log.id ?? index, date: log.changedAt, title: deliveryStatusMeta(log.status).label, description: log.reason, tone: log.status === "DELIVERED" ? "success" : log.status === "INCIDENT" ? "danger" : "info", icon: <Icon name={log.status === "DELIVERED" ? "check" : log.status === "INCIDENT" ? "warning" : "truck"} className="h-3.5 w-3.5" /> }))} initialLimit={5} />
            </section>

            <div className="sticky -bottom-5 -mx-5 -mb-5 z-20 grid grid-cols-[.8fr_1.2fr] gap-2 border-t border-white/10 bg-zinc-950/95 p-3 backdrop-blur">
              <button type="button" className="min-h-12 rounded-2xl bg-orange-500/10 px-3 text-xs font-black text-orange-300" onClick={() => setIncidentForId(selected.id)}>Incidencia</button>
              {nextDriverStatus(selected.status) && <button type="button" className="min-h-12 rounded-2xl bg-emerald-600 px-3 text-sm font-black text-white" disabled={workingId === selected.id} onClick={() => void advance(selected)}>{actionLabel(nextDriverStatus(selected.status)!)}</button>}
            </div>
          </div>
        )}
      </Drawer>

      <Drawer open={Boolean(incidentFor)} onClose={() => setIncidentForId(null)} title="Reportar incidencia" width="440px">
        {incidentFor && <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void reportIncident(); }}>
          <div className="rounded-2xl border border-orange-400/15 bg-orange-500/5 p-4"><p className="text-xs text-zinc-500">Entrega {incidentFor.number}</p><p className="mt-1 font-black text-white">{incidentFor.customerName}</p></div>
          <label className="block text-xs font-bold text-zinc-300">Tipo<select className="input mt-2 w-full" value={incidentType} onChange={(event) => setIncidentType(event.target.value)}>{INCIDENT_TYPES.map((type) => <option key={type} value={type}>{type[0]!.toUpperCase() + type.slice(1)}</option>)}</select></label>
          <label className="block text-xs font-bold text-zinc-300">Descripción<textarea className="input mt-2 min-h-28 w-full resize-y" value={incidentDescription} onChange={(event) => setIncidentDescription(event.target.value)} placeholder="Contanos qué pasó…" maxLength={2000} required /></label>
          <button type="submit" disabled={!incidentDescription.trim() || workingId === incidentFor.id} className="min-h-13 w-full rounded-2xl bg-orange-600 px-4 font-black text-white transition hover:bg-orange-500 disabled:opacity-50">Reportar incidencia</button>
        </form>}
      </Drawer>
    </>
  );
}
