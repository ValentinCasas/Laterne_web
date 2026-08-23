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

function formatRelativeTime(value: string | Date) {
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Ahora";
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours}h`;
  return `Hace ${Math.floor(hours / 24)}d`;
}

function actionLabel(status: string) {
  if (status === "PICKED_UP") return "Retirar";
  if (status === "ON_THE_WAY") return "En camino";
  if (status === "DELIVERED") return "Entregado";
  return deliveryStatusMeta(status).label;
}

function actionIcon(status: string) {
  if (status === "PICKED_UP") return "package" as const;
  if (status === "ON_THE_WAY") return "truck" as const;
  if (status === "DELIVERED") return "check-circle" as const;
  return "arrow-right" as const;
}

/** @summary Entregas activas como tarjetas operativas premium con detalle en drawer y mutaciones en tiempo real. */
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
      text: `La entrega avanzará a "${deliveryStatusMeta(next).label}".`,
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

  // Empty state
  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-white/10 bg-white/[.015] px-6 py-16 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-white/5 to-transparent text-zinc-600">
          <Icon name="package" className="h-7 w-7" />
        </span>
        <h3 className="mt-5 text-lg font-black text-white">Todo entregado</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-zinc-500">No tenés entregas activas en este momento. Cuando te asignen una, aparecerá acá automáticamente.</p>
        {items.length === 0 && (
          <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-300">
            <Icon name="check-circle" className="h-3.5 w-3.5" />
            Jornada al día
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {items.map((delivery, index) => {
          const meta = deliveryStatusMeta(delivery.status);
          const next = nextDriverStatus(delivery.status);
          const address = delivery.order?.deliveryAddress ?? delivery.deliveryAddress;
          const hasIncidents = delivery.incidents?.some((incident) => !incident.resolved);
          const isActive = delivery.status === "ON_THE_WAY";
          return (
            <article
              key={delivery.id}
              className={`group overflow-hidden rounded-3xl border shadow-xl transition-all duration-300 ${isActive ? "border-sky-400/20 bg-gradient-to-br from-sky-500/[.08] via-zinc-900 to-zinc-950 hover:border-sky-400/30" : "border-white/[.08] bg-zinc-900/80 hover:border-white/[.14] hover:shadow-2xl"}`}
            >
              {/* Card header */}
              <button type="button" className="w-full p-4 text-left" onClick={() => setSelectedId(delivery.id)} aria-label={`Ver entrega ${delivery.number}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-black ${isActive ? "bg-sky-500/20 text-sky-300" : "bg-pink-500/15 text-pink-300"}`}>
                      #{index + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-base font-black text-white">{delivery.order?.customerName ?? delivery.customerName}</h3>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${meta.badge}`}>{meta.label}</span>
                        {hasIncidents && <span className="rounded-full bg-orange-500/15 px-2 py-1 text-[10px] font-black text-orange-300">Incidencia</span>}
                      </div>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-zinc-400">
                        <Icon name="map-pin" className="h-3.5 w-3.5 shrink-0 text-pink-400/70" />
                        <span className="truncate">{address ?? "Dirección no informada"}</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Info row */}
                <div className="mt-3 ml-[52px] flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-zinc-500">
                  <span className="inline-flex items-center gap-1.5">
                    <Icon name="receipt" className="h-3 w-3" />
                    {delivery.order?.reference ?? delivery.number}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Icon name="clock" className="h-3 w-3" />
                    {formatTime(delivery.order?.requestedAt ?? delivery.createdAt)}
                  </span>
                  {delivery.items && delivery.items.length > 0 && (
                    <span className="inline-flex items-center gap-1.5">
                      <Icon name="package" className="h-3 w-3" />
                      {delivery.items.length} {delivery.items.length === 1 ? "producto" : "productos"}
                    </span>
                  )}
                  {delivery.order?.total !== undefined && (
                    <span className="font-bold text-zinc-300">{formatMoney(delivery.order.total, delivery.order.currency)}</span>
                  )}
                </div>
              </button>

              {/* Actions */}
              <div className="flex gap-2 border-t border-white/5 p-3">
                <button
                  type="button"
                  className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 text-sm font-bold text-white transition hover:bg-white/10"
                  onClick={() => setSelectedId(delivery.id)}
                >
                  <Icon name="eye" className="h-4 w-4" />
                  Detalle
                </button>
                {next && (
                  <button
                    type="button"
                    className={`flex min-h-12 flex-[1.5] items-center justify-center gap-2 rounded-2xl text-sm font-black text-white transition active:scale-[.99] ${next === "DELIVERED" ? "bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-950/30" : "bg-sky-600 hover:bg-sky-500 shadow-lg shadow-sky-950/30"}`}
                    disabled={workingId === delivery.id}
                    onClick={() => void advance(delivery)}
                  >
                    {workingId === delivery.id ? (
                      <Icon name="loader" className="h-4 w-4 animate-spin" />
                    ) : (
                      <Icon name={actionIcon(next)} className="h-4 w-4" />
                    )}
                    {workingId === delivery.id ? "Guardando…" : actionLabel(next)}
                  </button>
                )}
                {/* Quick contact */}
                {(delivery.order?.phone ?? delivery.contactPhone) && (
                  <a
                    href={`tel:${delivery.order?.phone ?? delivery.contactPhone}`}
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-zinc-400 transition hover:bg-white/10 hover:text-white"
                    aria-label="Llamar al cliente"
                  >
                    <Icon name="phone" className="h-4 w-4" />
                  </a>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {/* ── Detail Drawer ── */}
      <Drawer open={Boolean(selected)} onClose={() => setSelectedId(null)} title={selected ? `Entrega ${selected.number}` : "Entrega"} width="560px">
        {selected && (
          <div className="space-y-5 pb-24">
            {/* Client info */}
            <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[.03] to-transparent p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Cliente</p>
                  <h3 className="mt-1 text-xl font-black text-white">{selected.order?.customerName ?? selected.customerName}</h3>
                </div>
                <span className={`rounded-full px-3 py-1.5 text-[10px] font-black ${deliveryStatusMeta(selected.status).badge}`}>
                  {deliveryStatusMeta(selected.status).label}
                </span>
              </div>
              <p className="mt-3 flex items-start gap-2 text-sm text-zinc-300">
                <Icon name="map-pin" className="mt-0.5 h-4 w-4 shrink-0 text-pink-400" />
                {selected.order?.deliveryAddress ?? selected.deliveryAddress ?? "Dirección no informada"}
              </p>
              {(selected.order?.phone ?? selected.contactPhone) && (
                <a className="mt-2 inline-flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm font-bold text-sky-300 transition hover:bg-white/10" href={`tel:${selected.order?.phone ?? selected.contactPhone}`}>
                  <Icon name="phone" className="h-4 w-4" />
                  {selected.order?.phone ?? selected.contactPhone}
                </a>
              )}
              {(selected.instructions ?? selected.order?.notes) && (
                <div className="mt-3 rounded-xl bg-amber-500/10 border border-amber-400/15 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300/70">Observaciones</p>
                  <p className="mt-1 text-xs leading-5 text-amber-100">{selected.instructions ?? selected.order?.notes}</p>
                </div>
              )}
            </section>

            {/* Order items */}
            <section>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-white">Pedido</h3>
                {selected.order?.total !== undefined && (
                  <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-black text-emerald-300">
                    {formatMoney(selected.order.total, selected.order.currency)}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-zinc-500">{selected.order?.reference ?? selected.number}</p>
              <ul className="mt-3 divide-y divide-white/5 rounded-2xl border border-white/10 bg-white/[.02] px-4">
                {selected.items?.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-3">
                    <span className="text-sm text-zinc-200">{item.productName}</span>
                    <span className="shrink-0 rounded-full bg-white/5 px-2.5 py-1 text-xs font-bold text-zinc-400">×{item.quantityDelivered}</span>
                  </li>
                ))}
                {(!selected.items || selected.items.length === 0) && (
                  <li className="py-4 text-center text-xs text-zinc-500">Sin detalles de productos</li>
                )}
              </ul>
            </section>

            {/* Timeline */}
            <section>
              <h3 className="mb-3 text-sm font-black text-white">Historial de estados</h3>
              <Timeline
                items={(selected.statusLogs ?? []).map((log, index) => ({
                  id: log.id ?? index,
                  date: log.changedAt,
                  title: deliveryStatusMeta(log.status).label,
                  description: log.reason,
                  tone: log.status === "DELIVERED" ? "success" : log.status === "INCIDENT" ? "danger" : "info",
                  icon: <Icon name={log.status === "DELIVERED" ? "check" : log.status === "INCIDENT" ? "warning" : "truck"} className="h-3.5 w-3.5" />,
                }))}
                initialLimit={5}
              />
            </section>

            {/* Sticky actions */}
            <div className="sticky -bottom-5 -mx-5 -mb-5 z-20 grid grid-cols-[auto_1fr] gap-2 border-t border-white/10 bg-zinc-950/95 p-4 backdrop-blur-xl">
              <button
                type="button"
                className="flex min-h-12 items-center gap-2 rounded-2xl border border-orange-400/20 bg-orange-500/10 px-4 text-xs font-black text-orange-300 transition hover:bg-orange-500/20"
                onClick={() => setIncidentForId(selected.id)}
              >
                <Icon name="warning" className="h-4 w-4" />
                Incidencia
              </button>
              {nextDriverStatus(selected.status) && (
                <button
                  type="button"
                  className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl text-sm font-black text-white transition active:scale-[.99] ${nextDriverStatus(selected.status) === "DELIVERED" ? "bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-950/30" : "bg-sky-600 hover:bg-sky-500 shadow-lg shadow-sky-950/30"}`}
                  disabled={workingId === selected.id}
                  onClick={() => void advance(selected)}
                >
                  {workingId === selected.id ? <Icon name="loader" className="h-4 w-4 animate-spin" /> : <Icon name={actionIcon(nextDriverStatus(selected.status)!)} className="h-4 w-4" />}
                  {actionLabel(nextDriverStatus(selected.status)!)}
                </button>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* ── Incident Drawer ── */}
      <Drawer open={Boolean(incidentFor)} onClose={() => setIncidentForId(null)} title="Reportar incidencia" width="440px">
        {incidentFor && (
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void reportIncident(); }}>
            <div className="rounded-2xl border border-orange-400/15 bg-orange-500/5 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-orange-300/60">Entrega</p>
              <p className="mt-1 font-black text-white">{incidentFor.number} · {incidentFor.customerName}</p>
            </div>
            <label className="block text-xs font-bold text-zinc-300">
              Tipo de incidencia
              <select className="input mt-2 w-full" value={incidentType} onChange={(event) => setIncidentType(event.target.value)}>
                {INCIDENT_TYPES.map((type) => (
                  <option key={type} value={type}>{type[0]!.toUpperCase() + type.slice(1)}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-bold text-zinc-300">
              Descripción
              <textarea
                className="input mt-2 min-h-28 w-full resize-y"
                value={incidentDescription}
                onChange={(event) => setIncidentDescription(event.target.value)}
                placeholder="Contanos qué pasó con esta entrega…"
                maxLength={2000}
                required
              />
            </label>
            <button
              type="submit"
              disabled={!incidentDescription.trim() || workingId === incidentFor.id}
              className="flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-orange-600 px-4 font-black text-white transition hover:bg-orange-500 disabled:opacity-50"
            >
              {workingId === incidentFor.id ? <Icon name="loader" className="h-4 w-4 animate-spin" /> : <Icon name="warning" className="h-4 w-4" />}
              {workingId === incidentFor.id ? "Reportando…" : "Reportar incidencia"}
            </button>
          </form>
        )}
      </Drawer>
    </>
  );
}
