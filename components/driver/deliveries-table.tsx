"use client";

import { useState } from "react";
import { deliveryStatusMeta } from "@/lib/delivery-drivers";
import { Drawer } from "@/components/admin/ui/drawer";
import { Icon, type IconName } from "@/components/admin/ui/icons";
import { Timeline, type TimelineItem } from "@/components/admin/ui/timeline";

type StatusLog = {
  id: number;
  status: string;
  previousStatus: string | null;
  reason?: string | null;
  changedAt: string | Date;
  changedBy?: { name: string } | null;
};

type Delivery = {
  id: number;
  number: string;
  status: string;
  createdAt: string | Date;
  assignedAt?: string | Date | null;
  deliveredAt?: string | Date | null;
  customerName: string;
  deliveryAddress?: string | null;
  order?: { id: number; reference: string; customerName: string; phone?: string | null; deliveryAddress?: string | null; total?: unknown; currency?: string } | null;
  branch?: { id: number; name: string } | null;
  incidents?: Array<{ id: number; type: string; resolved: boolean; reportedAt: string | Date }>;
  statusLogs?: StatusLog[];
};

const MAJOR_STATUSES = ["ASSIGNED", "PICKED_UP", "ON_THE_WAY", "DELIVERED"];

function shortDate(value: string | Date) {
  return new Date(value).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatMoney(value: unknown, currency = "ARS") {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

function logIcon(status: string): IconName {
  if (status === "DELIVERED") return "check";
  if (status === "INCIDENT") return "warning";
  if (status === "PICKED_UP") return "package";
  return "truck";
}

function logTone(status: string): TimelineItem["tone"] {
  if (status === "DELIVERED") return "success";
  if (status === "INCIDENT") return "danger";
  if (status === "PENDING_ASSIGNMENT") return "warning";
  return "info";
}

function timelineItem(log: StatusLog): TimelineItem {
  return {
    id: log.id,
    date: log.changedAt,
    title: deliveryStatusMeta(log.status).label,
    description: log.reason || undefined,
    actor: log.changedBy?.name,
    tone: logTone(log.status),
    icon: <Icon name={logIcon(log.status)} className="h-3.5 w-3.5" />,
  };
}

/** @summary Resume el flujo real dejando una sola entrada visible por estado operativo principal. */
function majorTimeline(logs: StatusLog[]) {
  const latestByStatus = new Map<string, StatusLog>();
  for (const log of logs) if (MAJOR_STATUSES.includes(log.status)) latestByStatus.set(log.status, log);
  return [...latestByStatus.values()].map(timelineItem);
}

/** @summary Historial agrupado por entrega con timeline resumida y auditoría completa bajo demanda. */
export function DriverDeliveriesHistory({ deliveries }: { deliveries: Delivery[] }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = deliveries.find((delivery) => delivery.id === selectedId) ?? null;

  // Empty state
  if (deliveries.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-white/10 bg-white/[.015] px-6 py-16 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-white/5 to-transparent text-zinc-600">
          <Icon name="file" className="h-7 w-7" />
        </span>
        <h1 className="mt-5 text-lg font-black text-white">Todavía no tenés entregas</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-zinc-500">Tu historial aparecerá acá cuando completes el primer recorrido.</p>
      </div>
    );
  }

  // Group by date
  const grouped = new Map<string, Delivery[]>();
  for (const delivery of deliveries) {
    const dateKey = shortDate(delivery.deliveredAt ?? delivery.createdAt);
    const group = grouped.get(dateKey) ?? [];
    group.push(delivery);
    grouped.set(dateKey, group);
  }

  return (
    <>
      {/* Header */}
      <header className="mb-5 px-1">
        <p className="text-[10px] font-black uppercase tracking-[.18em] text-pink-300">Actividad</p>
        <h1 className="mt-1 text-2xl font-black text-white">Historial de entregas</h1>
        <p className="mt-1 text-sm text-zinc-500">{deliveries.length} entregas registradas</p>
      </header>

      {/* Grouped by date */}
      <div className="space-y-6">
        {[...grouped.entries()].map(([date, items]) => (
          <section key={date}>
            <div className="mb-3 flex items-center gap-3 px-1">
              <h2 className="text-sm font-black text-zinc-300">{date}</h2>
              <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-bold text-zinc-500">{items.length} {items.length === 1 ? "entrega" : "entregas"}</span>
            </div>
            <div className="space-y-3">
              {items.map((delivery) => {
                const meta = deliveryStatusMeta(delivery.status);
                const logs = delivery.statusLogs ?? [];
                const major = majorTimeline(logs);
                const assignmentCount = logs.filter((log) => log.status === "ASSIGNED").length;
                const hasMore = logs.length > major.length || assignmentCount > 1;
                const hasActiveIncidents = delivery.incidents?.some((incident) => !incident.resolved);
                return (
                  <article key={delivery.id} className="group overflow-hidden rounded-2xl border border-white/[.08] bg-zinc-900/70 p-4 shadow-lg transition-all duration-200 hover:border-white/[.14] hover:shadow-xl">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${meta.badge}`}>{meta.label}</span>
                          {hasActiveIncidents && <span className="rounded-full bg-orange-500/15 px-2 py-1 text-[10px] font-black text-orange-300">Incidencia</span>}
                          {assignmentCount > 1 && <span className="rounded-full bg-violet-500/10 px-2 py-1 text-[10px] font-black text-violet-300">Reasignado ×{assignmentCount - 1}</span>}
                        </div>
                        <h2 className="mt-2 truncate text-base font-black text-white">{delivery.order?.customerName ?? delivery.customerName}</h2>
                        <p className="mt-0.5 text-xs text-zinc-500">{delivery.number} · {delivery.order?.reference ?? "Sin pedido"}</p>
                        {delivery.order?.total !== undefined && (
                          <p className="mt-1 text-xs font-bold text-zinc-400">{formatMoney(delivery.order.total, delivery.order.currency)}</p>
                        )}
                      </div>
                    </div>

                    <Timeline items={major} initialLimit={3} className="mt-4" emptyMessage="Sin estados registrados" />

                    {hasMore && (
                      <button
                        type="button"
                        className="mt-2 flex min-h-10 items-center gap-1.5 rounded-xl px-2 py-2 text-xs font-black text-pink-300 transition hover:bg-pink-500/10"
                        onClick={() => setSelectedId(delivery.id)}
                      >
                        Ver historial completo
                        <Icon name="arrow-right" className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* Detail drawer */}
      <Drawer open={Boolean(selected)} onClose={() => setSelectedId(null)} title={selected ? `Historial ${selected.number}` : "Historial"} width="580px">
        {selected && (
          <div className="space-y-5">
            {/* Header info */}
            <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[.03] to-transparent p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${deliveryStatusMeta(selected.status).badge}`}>
                    {deliveryStatusMeta(selected.status).label}
                  </span>
                  <h2 className="mt-3 text-xl font-black text-white">{selected.order?.customerName ?? selected.customerName}</h2>
                  <p className="mt-1 text-xs text-zinc-500">{selected.number} · {selected.order?.reference}</p>
                </div>
              </div>
              {(selected.order?.deliveryAddress ?? selected.deliveryAddress) && (
                <p className="mt-3 flex items-start gap-2 text-sm text-zinc-300">
                  <Icon name="map-pin" className="mt-0.5 h-4 w-4 shrink-0 text-pink-400" />
                  {selected.order?.deliveryAddress ?? selected.deliveryAddress}
                </p>
              )}
            </section>

            {/* Full timeline */}
            <section>
              <h3 className="mb-3 text-sm font-black text-white">Todos los eventos</h3>
              <Timeline items={(selected.statusLogs ?? []).map(timelineItem)} initialLimit={100} />
            </section>

            {/* Assignment details */}
            {(selected.statusLogs ?? []).filter((log) => log.status === "ASSIGNED" || log.status === "PENDING_ASSIGNMENT").length > 1 && (
              <details className="rounded-2xl border border-white/10 bg-white/[.02] p-4">
                <summary className="cursor-pointer text-sm font-black text-violet-200">Detalle de asignaciones</summary>
                <ul className="mt-3 space-y-2">
                  {selected.statusLogs!.filter((log) => log.status === "ASSIGNED" || log.status === "PENDING_ASSIGNMENT").map((log) => (
                    <li key={log.id} className="flex justify-between gap-3 text-xs text-zinc-400">
                      <span>{deliveryStatusMeta(log.status).label}{log.changedBy?.name ? ` · ${log.changedBy.name}` : ""}</span>
                      <time className="shrink-0 tabular-nums">{new Date(log.changedAt).toLocaleString("es-AR")}</time>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </Drawer>
    </>
  );
}
