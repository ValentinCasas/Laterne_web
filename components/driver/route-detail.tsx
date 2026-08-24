"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Route } from "next";
import * as maplibregl from "maplibre-gl";
import Link from "next/link";
import { Icon } from "@/components/admin/ui/icons";
import { Drawer } from "@/components/admin/ui/drawer";
import { Timeline } from "@/components/admin/ui/timeline";
import { routeStatusMeta, formatDuration, formatDistance } from "@/lib/delivery-route-state";
import { deliveryStatusMeta } from "@/lib/delivery-drivers";
import { formatTime, formatDate } from "@/lib/date-format";

type RouteStop = {
  id: number;
  number: string;
  routeOrder?: number | null;
  plannedOrder?: number | null;
  status: string;
  customerName: string;
  deliveryAddress?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  deliveredAt?: string | Date | null;
  contactPhone?: string | null;
  instructions?: string | null;
  order?: {
    id: number;
    reference: string;
    customerName: string;
    phone?: string | null;
    deliveryAddress?: string | null;
    notes?: string | null;
    total?: string | number | object;
    currency?: string;
    requestedAt?: string | Date | null;
  } | null;
  items?: Array<{ id: number; productName: string; quantityDelivered: number; notes?: string | null }>;
  incidents?: Array<{ id: number; type: string; description: string; resolved: boolean; reportedAt: string | Date }>;
  statusLogs?: Array<{ id?: number; status: string; previousStatus: string | null; changedAt: string | Date; reason?: string | null }>;
};

type HistoricalRoute = {
  id: number;
  status: string;
  startedAt?: string | Date | null;
  completedAt?: string | Date | null;
  cancelledAt?: string | Date | null;
  totalStops: number;
  completedStops: number;
  incidentCount: number;
  totalDistanceM?: number | null;
  totalDurationS?: number | null;
  createdAt: string | Date;
  branch?: { id: number; name: string; address?: string | null; latitude?: unknown; longitude?: unknown } | null;
  deliveries: RouteStop[];
};

/** @summary Vista de detalle histórico de un recorrido: mapa, paradas, timeline y métricas (solo lectura). */
export function DriverRouteDetail({
  route,
  driverName,
  tenantSlug,
  tenantGuid,
}: {
  route: HistoricalRoute;
  driverName: string;
  tenantSlug: string;
  tenantGuid?: string;
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const prefix = tenantGuid ? `/t/${tenantGuid}/${tenantSlug}` : `/t/${tenantSlug}`;
  const backUrl = `${prefix}/driver/recorridos` as Route;

  // Compute duration
  const duration = useMemo(() => {
    if (route.startedAt && (route.completedAt || route.cancelledAt)) {
      return Math.round(((new Date(route.completedAt ?? route.cancelledAt!)).getTime() - new Date(route.startedAt).getTime()) / 1000);
    }
    return route.totalDurationS ?? null;
  }, [route]);

  // Timeline events
  const timelineEvents = useMemo(() => {
    const events: Array<{ id: number; date: string | Date; title: string; description?: string; tone: "success" | "danger" | "info" | "default"; icon: string }> = [];
    let id = 0;
    if (route.startedAt) {
      events.push({ id: id++, date: route.startedAt, title: "Recorrido iniciado", tone: "info", icon: "truck" });
    }
    for (const d of route.deliveries) {
      if (d.deliveredAt) {
        events.push({
          id: id++,
          date: d.deliveredAt,
          title: `#${d.routeOrder ?? "?"} ${d.customerName} entregada`,
          description: d.order?.reference,
          tone: "success",
          icon: "check",
        });
      }
      if (d.incidents && d.incidents.length > 0) {
        for (const inc of d.incidents) {
          events.push({
            id: id++,
            date: inc.reportedAt,
            title: `Incidencia en #${d.routeOrder ?? "?"} ${d.customerName}`,
            description: `${inc.type}: ${inc.description}`,
            tone: "danger",
            icon: "warning",
          });
        }
      }
    }
    if (route.completedAt) {
      events.push({ id: id++, date: route.completedAt, title: "Recorrido finalizado", tone: "success", icon: "check-circle" });
    }
    if (route.cancelledAt && !route.completedAt) {
      events.push({ id: id++, date: route.cancelledAt, title: "Recorrido cancelado", tone: "default", icon: "x" });
    }
    return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [route]);

  const selected = route.deliveries.find((d) => d.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      {/* Back link */}
      <Link href={backUrl} className="inline-flex items-center gap-2 text-xs font-bold text-zinc-400 transition hover:text-white">
        <Icon name="arrow-right" className="h-3.5 w-3.5 rotate-180" />
        Volver a mis recorridos
      </Link>

      {/* Header */}
      <section className="rounded-3xl border border-white/[.08] bg-gradient-to-br from-sky-500/[.06] via-zinc-900 to-zinc-950 p-5 shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${routeStatusMeta(route.status).badge}`}>
                {routeStatusMeta(route.status).label}
              </span>
              <span className="text-xs font-bold text-zinc-400">Recorrido #{route.id}</span>
            </div>
            <h1 className="mt-2 text-xl font-black text-white">{formatDate(route.createdAt)}</h1>
            <p className="mt-1 text-xs text-zinc-500">
              {route.startedAt ? formatTime(route.startedAt) : "—"} → {route.completedAt ? formatTime(route.completedAt) : route.cancelledAt ? formatTime(route.cancelledAt) : "—"}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: "Paradas", value: String(route.totalStops), icon: "map-pin" as const },
            { label: "Entregadas", value: String(route.completedStops), icon: "check-circle" as const },
            { label: "Incidencias", value: String(route.incidentCount), icon: "warning" as const },
            { label: "Duración", value: duration != null ? formatDuration(duration) : "—", icon: "clock" as const },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-xl bg-white/[.04] px-3 py-2.5">
              <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">{kpi.label}</p>
              <p className="mt-1 text-sm font-black text-white">{kpi.value}</p>
            </div>
          ))}
        </div>

        {(route.totalDistanceM != null || driverName || route.branch) && (
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-zinc-500">
            {route.totalDistanceM != null && <span>Distancia: {formatDistance(route.totalDistanceM)}</span>}
            {driverName && <span>Repartidor: {driverName}</span>}
            {route.branch && <span>Sucursal: {route.branch.name}</span>}
          </div>
        )}
      </section>

      {/* Map */}
      {route.deliveries.some((d) => d.latitude && d.longitude) && (
        <HistoricalRouteMap deliveries={route.deliveries} branch={route.branch} selectedId={selectedId} onSelect={setSelectedId} />
      )}

      {/* Timeline */}
      {timelineEvents.length > 0 && (
        <section className="rounded-3xl border border-white/[.08] bg-zinc-900/60 p-5">
          <h2 className="text-sm font-black text-white">Línea de tiempo</h2>
          <div className="mt-3">
            <Timeline
              items={timelineEvents.map((ev) => ({
                id: ev.id,
                date: ev.date,
                title: ev.title,
                description: ev.description,
                tone: ev.tone,
                icon: <Icon name={ev.icon as "truck" | "check" | "warning" | "check-circle" | "x"} className="h-3.5 w-3.5" />,
              }))}
              initialLimit={10}
            />
          </div>
        </section>
      )}

      {/* Stops list */}
      <section className="rounded-3xl border border-white/[.08] bg-zinc-900/60 p-5">
        <h2 className="text-sm font-black text-white">Paradas</h2>
        <div className="mt-3 space-y-2">
          {route.deliveries.map((delivery, index) => {
            const stopNum = delivery.routeOrder ?? index + 1;
            const isDelivered = delivery.status === "DELIVERED";
            const hasIncident = delivery.incidents && delivery.incidents.length > 0;
            const isSelected = selectedId === delivery.id;
            return (
              <button
                key={delivery.id}
                type="button"
                className={`w-full text-left flex items-center gap-3 rounded-2xl border p-3 transition ${
                  isSelected
                    ? "border-pink-400/30 bg-pink-500/[.08]"
                    : "border-white/[.06] bg-zinc-900/40 hover:border-white/[.12]"
                }`}
                onClick={() => setSelectedId(delivery.id)}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-black ${
                  isDelivered ? "bg-emerald-500/20 text-emerald-300" : hasIncident ? "bg-orange-500/20 text-orange-300" : "bg-zinc-500/20 text-zinc-300"
                }`}>
                  {isDelivered ? "✓" : hasIncident ? "!" : `#${stopNum}`}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-white">
                    #{stopNum} · {delivery.order?.customerName ?? delivery.customerName}
                  </p>
                  <div className="mt-0.5 flex flex-wrap gap-2 text-[11px] text-zinc-500">
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${deliveryStatusMeta(delivery.status).badge}`}>
                      {deliveryStatusMeta(delivery.status).label}
                    </span>
                    {delivery.deliveredAt && <span>Entregado {formatTime(delivery.deliveredAt)}</span>}
                    {hasIncident && <span className="text-orange-300">Incidencia</span>}
                  </div>
                </div>
                <Icon name="arrow-right" className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
              </button>
            );
          })}
        </div>
      </section>

      {/* Detail drawer */}
      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelectedId(null)}
        title={selected ? `Parada #${selected.routeOrder ?? "?"}` : "Detalle"}
        width="560px"
      >
        {selected && <StopDetail stop={selected} />}
      </Drawer>
    </div>
  );
}

/* ── Stop detail (read-only) ── */
function StopDetail({ stop }: { stop: RouteStop }) {
  const isDelivered = stop.status === "DELIVERED";
  const hasIncident = stop.incidents && stop.incidents.length > 0;
  const wasReordered = stop.plannedOrder != null && stop.routeOrder != null && stop.plannedOrder !== stop.routeOrder;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-black ${
          isDelivered ? "bg-emerald-500/15 text-emerald-300" : hasIncident ? "bg-orange-500/15 text-orange-300" : "bg-pink-500/15 text-pink-300"
        }`}>
          {isDelivered ? "✓" : hasIncident ? "!" : `#${stop.routeOrder ?? "?"}`}
        </span>
        <span className={`rounded-full px-3 py-1.5 text-[10px] font-black ${deliveryStatusMeta(stop.status).badge}`}>
          {deliveryStatusMeta(stop.status).label}
        </span>
      </div>

      {/* Reorder info */}
      {wasReordered && (
        <div className="rounded-xl border border-violet-400/15 bg-violet-500/5 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-violet-300/70">Cambio de orden</p>
          <p className="mt-1 text-xs text-zinc-300">
            Orden original: <span className="font-bold text-white">#{stop.plannedOrder}</span>
            <span className="mx-2 text-zinc-600">→</span>
            Orden real: <span className="font-bold text-white">#{stop.routeOrder}</span>
          </p>
        </div>
      )}

      <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[.03] to-transparent p-5">
        <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Cliente</p>
        <h3 className="mt-1 text-xl font-black text-white">{stop.order?.customerName ?? stop.customerName}</h3>
        <p className="mt-3 flex items-start gap-2 text-sm text-zinc-300">
          <Icon name="map-pin" className="mt-0.5 h-4 w-4 shrink-0 text-pink-400" />
          {stop.order?.deliveryAddress ?? stop.deliveryAddress ?? "Dirección no informada"}
        </p>
        {(stop.order?.phone ?? stop.contactPhone) && (
          <a className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm font-bold text-sky-300" href={`tel:${stop.order?.phone ?? stop.contactPhone}`}>
            <Icon name="phone" className="h-4 w-4" />
            {stop.order?.phone ?? stop.contactPhone}
          </a>
        )}
        {(stop.instructions ?? stop.order?.notes) && (
          <div className="mt-3 rounded-xl bg-amber-500/10 border border-amber-400/15 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300/70">Observaciones</p>
            <p className="mt-1 text-xs leading-5 text-amber-100">{stop.instructions ?? stop.order?.notes}</p>
          </div>
        )}
      </section>

      {stop.order && (
        <section>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-white">Pedido</h3>
            {stop.order?.total !== undefined && (
              <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-black text-emerald-300">
                {formatMoney(stop.order.total, stop.order.currency)}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-zinc-500">{stop.order.reference}</p>
          {stop.items && stop.items.length > 0 && (
            <ul className="mt-3 divide-y divide-white/5 rounded-2xl border border-white/10 bg-white/[.02] px-4">
              {stop.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 py-3">
                  <span className="text-sm text-zinc-200">{item.productName}</span>
                  <span className="shrink-0 rounded-full bg-white/5 px-2.5 py-1 text-xs font-bold text-zinc-400">×{item.quantityDelivered}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {hasIncident && (
        <section>
          <h3 className="text-sm font-black text-white">Incidencias</h3>
          <div className="mt-3 space-y-2">
            {stop.incidents!.map((inc) => (
              <div key={inc.id} className="rounded-xl border border-orange-400/15 bg-orange-500/5 p-3">
                <p className="text-xs font-bold text-orange-300">{inc.type}</p>
                <p className="mt-1 text-xs text-zinc-300">{inc.description}</p>
                <p className="mt-1 text-[10px] text-zinc-500">{formatTime(inc.reportedAt)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {stop.deliveredAt && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-400/15 px-4 py-3">
          <p className="text-xs font-bold text-emerald-300">Entregado: {formatTime(stop.deliveredAt)}</p>
        </div>
      )}
    </div>
  );
}

/* ── Historical route map ── */
function HistoricalRouteMap({
  deliveries,
  branch,
  selectedId,
  onSelect,
}: {
  deliveries: RouteStop[];
  branch?: { latitude?: unknown; longitude?: unknown } | null;
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const origin = useMemo(() => {
    const lat = Number(branch?.latitude);
    const lng = Number(branch?.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) {
      return { latitude: lat, longitude: lng };
    }
    return null;
  }, [branch]);

  const stops = useMemo(() => {
    return deliveries
      .filter((d) => {
        const lat = Number(d.latitude);
        const lng = Number(d.longitude);
        return Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);
      })
      .map((d) => ({
        id: d.id,
        latitude: Number(d.latitude)!,
        longitude: Number(d.longitude)!,
        status: d.status,
        routeOrder: d.routeOrder,
        customerName: d.order?.customerName ?? d.customerName,
      }));
  }, [deliveries]);

  // Init map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current || !origin) return;
    maplibregl.setWorkerUrl("/vendor/maplibre/maplibre-gl-worker.mjs");
    try {
      const m = new maplibregl.Map({
        container: mapContainer.current,
        style: "https://tiles.openfreemap.org/styles/liberty",
        center: [origin.longitude, origin.latitude],
        zoom: 13,
        cooperativeGestures: true,
      });
      m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      mapRef.current = m;
    } catch { /* ignore */ }
    return () => {
      markersRef.current.forEach((mk) => mk.remove());
      markersRef.current = [];
      try { mapRef.current?.remove(); } catch { /* */ }
      mapRef.current = null;
    };
  }, [Boolean(origin)]);

  // Update markers and lines
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !origin || stops.length === 0) return;

    const coords: [number, number][] = [
      [origin.longitude, origin.latitude],
      ...stops.map((s) => [s.longitude, s.latitude] as [number, number]),
    ];

    // Draw route line
    const lineData = { type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: coords } };
    const src = m.getSource("historical-route") as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(lineData);
    else {
      m.addSource("historical-route", { type: "geojson", data: lineData });
      m.addLayer({
        id: "historical-route-line",
        type: "line",
        source: "historical-route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#ec4899", "line-width": 3, "line-opacity": 0.6 },
      });
    }

    // Markers
    markersRef.current.forEach((mk) => mk.remove());
    markersRef.current = [];

    // Origin marker
    const originEl = document.createElement("div");
    Object.assign(originEl.style, {
      width: "24px", height: "24px", borderRadius: "8px", border: "3px solid white",
      background: "linear-gradient(135deg, #10b981, #059669)", boxShadow: "0 4px 12px rgba(0,0,0,.4)",
      display: "grid", placeItems: "center",
    });
    const dot = document.createElement("div");
    Object.assign(dot.style, { width: "6px", height: "6px", borderRadius: "2px", background: "white", transform: "rotate(45deg)" });
    originEl.appendChild(dot);
    markersRef.current.push(new maplibregl.Marker({ element: originEl }).setLngLat([origin.longitude, origin.latitude]).addTo(m));

    // Stop markers
    stops.forEach((stop, i) => {
      const isSelected = selectedId === stop.id;
      const delivered = stop.status === "DELIVERED";
      const incident = stop.status === "INCIDENT" || stop.status === "FAILED";
      const el = document.createElement("div");
      const size = isSelected ? 36 : 30;
      Object.assign(el.style, {
        width: `${size}px`, height: `${size}px`, display: "grid", placeItems: "center",
        borderRadius: "10px", border: isSelected ? "3px solid #ec4899" : "3px solid white",
        background: delivered ? "#10b981" : incident ? "#f59e0b" : "#ec4899",
        color: "white", fontSize: "12px", fontWeight: "900",
        boxShadow: isSelected ? "0 0 0 4px rgba(236,72,153,.3), 0 6px 20px rgba(0,0,0,.5)" : "0 6px 20px rgba(0,0,0,.5)",
        opacity: delivered ? "0.7" : "1", cursor: "pointer",
      });
      el.textContent = delivered ? "✓" : incident ? "!" : String(stop.routeOrder ?? i + 1);
      el.addEventListener("click", () => onSelect(stop.id));
      markersRef.current.push(new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat([stop.longitude, stop.latitude]).addTo(m));
    });

    // Fit bounds
    const bounds = new maplibregl.LngLatBounds();
    coords.forEach((p) => bounds.extend(p));
    if (!bounds.isEmpty()) m.fitBounds(bounds, { padding: 54, maxZoom: 15, duration: 500 });
  }, [stops, origin, selectedId, onSelect]);

  if (!origin && stops.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-white/10 bg-white/[.015] p-8 text-center">
        <Icon name="map-pin" className="mx-auto h-6 w-6 text-zinc-600" />
        <p className="mt-2 text-sm text-zinc-500">No hay coordenadas disponibles para este recorrido.</p>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-white/[.08] bg-zinc-900/70 shadow-xl">
      <header className="flex items-center justify-between border-b border-white/5 px-4 py-3">
        <h3 className="text-sm font-black text-white">Mapa del recorrido</h3>
      </header>
      <div ref={mapContainer} className="w-full h-72 sm:h-[400px]" aria-label="Mapa del recorrido histórico" />
    </section>
  );
}

function formatMoney(value: unknown, currency = "ARS") {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}
