"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { DriverDelivery } from "@/components/driver/active-deliveries";
import {
  googleMapsRouteUrl,
  orderDeliveryRouteStops,
  type DeliveryRouteCoordinate,
} from "@/lib/delivery-route";
import { Icon } from "@/components/admin/ui/icons";
import { deliveryStatusMeta } from "@/lib/delivery-drivers";
import { formatDateTime } from "@/lib/date-format";

type RouteStop = DeliveryRouteCoordinate & {
  id: number;
  routeOrder?: number | null;
  number: string;
  customerName: string;
  address: string;
  status: string;
  reference?: string;
  phone?: string | null;
  requestedAt?: string | Date | null;
  total?: unknown;
  currency?: string;
  itemCount: number;
};

type RouteOriginInfo = {
  name: string;
  address?: string | null;
  phone?: string | null;
};

function coordinate(value: unknown, limit: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && Math.abs(parsed) <= limit ? parsed : null;
}

/* ── Marker builders ── */

/** @summary Marcador de parada con numeración, color por estado y highlight de selección. */
function buildStopMarker(index: number, status: string, isSelected: boolean) {
  const el = document.createElement("div");
  el.setAttribute("aria-label", `Parada ${index}`);
  const delivered = status === "DELIVERED";
  const incident = status === "INCIDENT" || status === "FAILED";
  const baseSize = isSelected ? 40 : 34;
  Object.assign(el.style, {
    width: `${baseSize}px`,
    height: `${baseSize}px`,
    display: "grid",
    placeItems: "center",
    borderRadius: "12px",
    border: isSelected ? "3px solid #ec4899" : "3px solid white",
    background: delivered ? "#10b981" : incident ? "#f59e0b" : "#ec4899",
    color: "white",
    fontSize: isSelected ? "14px" : "13px",
    fontWeight: "900",
    boxShadow: isSelected
      ? "0 0 0 4px rgba(236,72,153,.3), 0 8px 25px rgba(0,0,0,.5)"
      : "0 8px 25px rgba(0,0,0,.5)",
    opacity: delivered ? "0.6" : "1",
    transition: "all 0.2s",
    transform: isSelected ? "scale(1.15)" : "scale(1)",
    cursor: "pointer",
  });
  el.textContent = delivered ? `${index} ✓` : incident ? "!" : String(index);
  return el;
}

/** @summary Marcador del origen (sucursal) con estilo distintivo. */
function buildOriginMarker() {
  const el = document.createElement("div");
  el.setAttribute("aria-label", "Sucursal base");
  Object.assign(el.style, {
    width: "30px",
    height: "30px",
    borderRadius: "10px",
    border: "3px solid white",
    background: "linear-gradient(135deg, #10b981, #059669)",
    boxShadow: "0 8px 25px rgba(0,0,0,.5)",
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
  });
  const inner = document.createElement("div");
  Object.assign(inner.style, {
    width: "8px",
    height: "8px",
    borderRadius: "2px",
    background: "white",
    transform: "rotate(45deg)",
  });
  el.appendChild(inner);
  return el;
}

/* ── Popup builders ── */

function popupText(className: string, text: string) {
  const element = document.createElement("p");
  element.className = className;
  element.textContent = text;
  return element;
}

function popupButton(text: string, onClick: () => void) {
  const btn = document.createElement("button");
  btn.textContent = text;
  btn.type = "button";
  btn.style.cssText = "display:inline-flex;align-items:center;gap:4px;padding:6px 12px;border-radius:10px;font-size:11px;font-weight:700;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:#fafafa;cursor:pointer;transition:background 0.2s;";
  btn.onmouseenter = () => { btn.style.background = "rgba(255,255,255,.1)"; };
  btn.onmouseleave = () => { btn.style.background = "rgba(255,255,255,.05)"; };
  btn.onclick = (e) => { e.stopPropagation(); onClick(); };
  return btn;
}

/** @summary Popup de parada con datos reales y acciones. */
function buildStopPopup(stop: RouteStop, index: number, onSelect?: (id: number) => void, onEditAddress?: (id: number) => void) {
  const content = document.createElement("div");
  content.className = "mc-map-popup";
  content.style.maxWidth = "280px";
  const meta = deliveryStatusMeta(stop.status);
  const delivered = stop.status === "DELIVERED";
  content.append(
    popupText("mc-map-popup__eyebrow", `PARADA ${index}${delivered ? " ✓" : ""}`),
    popupText("mc-map-popup__title", stop.customerName),
    popupText("mc-map-popup__primary", stop.address),
  );
  const badge = document.createElement("span");
  badge.className = `mc-map-popup__badge ${meta.badge}`;
  badge.textContent = meta.label;
  badge.style.marginTop = "6px";
  content.appendChild(badge);
  if (stop.reference) content.append(popupText("mc-map-popup__row", `Pedido: ${stop.reference}`));
  if (stop.phone) content.append(popupText("mc-map-popup__row", `Tel: ${stop.phone}`));
  if (stop.requestedAt) {
    content.append(popupText("mc-map-popup__row", `Horario: ${formatDateTime(stop.requestedAt)}`));
  }
  content.append(popupText("mc-map-popup__row", `Productos: ${stop.itemCount}`));
  const total = Number(stop.total);
  if (Number.isFinite(total)) {
    content.append(popupText("mc-map-popup__row", `Total: ${new Intl.NumberFormat("es-AR", { style: "currency", currency: stop.currency ?? "ARS", maximumFractionDigits: 0 }).format(total)}`));
  }
  // Action buttons
  if (onSelect || onEditAddress) {
    const actions = document.createElement("div");
    actions.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;";
    if (onSelect) actions.appendChild(popupButton("Ver datos", () => onSelect(stop.id)));
    if (onEditAddress && !delivered) actions.appendChild(popupButton("Editar dirección", () => onEditAddress(stop.id)));
    content.appendChild(actions);
  }
  return content;
}

function buildOriginPopup(origin: RouteOriginInfo | null, stops: number) {
  const content = document.createElement("div");
  content.className = "mc-map-popup";
  content.append(
    popupText("mc-map-popup__eyebrow", "Sucursal"),
    popupText("mc-map-popup__title", origin?.name ?? "Punto de salida"),
  );
  if (origin?.address) content.append(popupText("mc-map-popup__primary", origin.address));
  if (origin?.phone) content.append(popupText("mc-map-popup__row", `Tel: ${origin.phone}`));
  content.append(popupText("mc-map-popup__row", `${stops} ${stops === 1 ? "parada asignada" : "paradas asignadas"}`));
  return content;
}

/* ── Main Component ── */

/** @summary Mapa premium del recorrido con selección sincronizada, marcadores por estado y progreso de línea. */
export function DriverRouteMap({
  deliveries,
  selectedId,
  onSelect,
  onEditAddress,
}: {
  deliveries: DriverDelivery[];
  selectedId?: number | null;
  onSelect?: (id: number) => void;
  onEditAddress?: (id: number) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [failed, setFailed] = useState(false);
  const prevSelectedRef = useRef<number | null | undefined>(null);

  const route = useMemo(() => {
    let origin: DeliveryRouteCoordinate | null = null;
    let originInfo: RouteOriginInfo | null = null;
    for (const delivery of deliveries) {
      const latitude = coordinate(delivery.branch?.latitude, 90);
      const longitude = coordinate(delivery.branch?.longitude, 180);
      if (latitude !== null && longitude !== null) {
        origin = { latitude, longitude };
        originInfo = delivery.branch
          ? { name: delivery.branch.name, address: delivery.branch.address, phone: delivery.branch.phone }
          : null;
        break;
      }
    }
    const stops: RouteStop[] = deliveries.flatMap((delivery) => {
      const latitude = coordinate(delivery.latitude, 90);
      const longitude = coordinate(delivery.longitude, 180);
      if (latitude === null || longitude === null) return [];
      return [{
        id: delivery.id,
        routeOrder: delivery.routeOrder,
        number: delivery.number,
        customerName: delivery.order?.customerName ?? delivery.customerName,
        address: delivery.order?.deliveryAddress ?? delivery.deliveryAddress ?? "Dirección no informada",
        status: delivery.status,
        reference: delivery.order?.reference,
        phone: delivery.order?.phone ?? delivery.contactPhone,
        requestedAt: delivery.order?.requestedAt,
        total: delivery.order?.total,
        currency: delivery.order?.currency,
        itemCount: delivery.items?.length ?? 0,
        latitude,
        longitude,
      }];
    });
    const routeOrigin = origin ?? stops[0] ?? null;
    // When deliveries have routeOrder (active route), respect that order.
    // Only fall back to proximity sort for deliveries without routeOrder.
    const hasRouteOrder = stops.some((s) => s.routeOrder != null);
    const orderedStops = routeOrigin
      ? hasRouteOrder
        ? [...stops].sort((a, b) => (a.routeOrder ?? Infinity) - (b.routeOrder ?? Infinity))
        : orderDeliveryRouteStops(routeOrigin, stops)
      : [];
    return {
      origin: routeOrigin,
      originInfo,
      stops: orderedStops,
      navigationUrl: routeOrigin ? googleMapsRouteUrl(routeOrigin, orderedStops) : null,
      missingLocations: deliveries.length - stops.length,
    };
  }, [deliveries]);

  const routeOrigin = route.origin;
  const hasRouteOrigin = Boolean(routeOrigin);
  const orderedStops = route.stops;
  const originInfo = route.originInfo;

  /* ── Map init ── */
  useEffect(() => {
    if (!container.current || map.current || !routeOrigin) return;
    maplibregl.setWorkerUrl("/vendor/maplibre/maplibre-gl-worker.mjs");
    try {
      const instance = new maplibregl.Map({
        container: container.current,
        style: "https://tiles.openfreemap.org/styles/liberty",
        center: [routeOrigin.longitude, routeOrigin.latitude],
        zoom: 13,
        cooperativeGestures: true,
      });
      instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      instance.on("error", () => {
        if (!instance.isStyleLoaded()) startTransition(() => setFailed(true));
      });
      map.current = instance;
    } catch {
      startTransition(() => setFailed(true));
    }
    return () => {
      markersRef.current.forEach((mk) => mk.remove());
      markersRef.current = [];
      try { map.current?.remove(); } catch { /* ya removido */ }
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasRouteOrigin]);

  /* ── Draw markers, route line, and handle selection ── */
  useEffect(() => {
    const m = map.current;
    const currentOrigin = routeOrigin;
    if (!m || !currentOrigin) return;

    // All coordinates for the route
    const coords: [number, number][] = [
      [currentOrigin.longitude, currentOrigin.latitude],
      ...orderedStops.map((s) => [s.longitude, s.latitude] as [number, number]),
    ];

    // Find where completed portion ends (last DELIVERED stop index)
    const completedCoords: [number, number][] = [[currentOrigin.longitude, currentOrigin.latitude]];
    for (let i = 0; i < orderedStops.length; i++) {
      if (orderedStops[i]!.status === "DELIVERED") {
        completedCoords.push([orderedStops[i]!.longitude, orderedStops[i]!.latitude]);
      }
    }

    // Pending segment: starts from the LAST delivered stop (or origin if none delivered)
    const lastDeliveredIdx = (() => {
      for (let i = orderedStops.length - 1; i >= 0; i--) {
        if (orderedStops[i]!.status === "DELIVERED") return i;
      }
      return -1;
    })();
    const pendingCoords: [number, number][] = [
      lastDeliveredIdx >= 0
        ? [orderedStops[lastDeliveredIdx]!.longitude, orderedStops[lastDeliveredIdx]!.latitude]
        : [currentOrigin.longitude, currentOrigin.latitude],
      ...orderedStops.slice(lastDeliveredIdx + 1).map((s) => [s.longitude, s.latitude] as [number, number]),
    ];

    // Draw route lines (completed = green, pending = pink)
    const drawLines = () => {
      // Completed segment (solid green)
      if (completedCoords.length > 1) {
        const completedData = { type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: completedCoords } };
        const src = m.getSource("route-completed") as maplibregl.GeoJSONSource | undefined;
        if (src) src.setData(completedData);
        else {
          m.addSource("route-completed", { type: "geojson", data: completedData });
          m.addLayer({
            id: "route-completed-line",
            type: "line",
            source: "route-completed",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": "#10b981", "line-width": 4, "line-opacity": 0.7 },
          });
        }
      }
      // Pending segment (dashed pink, only from last delivered to remaining stops)
      if (pendingCoords.length > 1) {
        const pendingData = { type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: pendingCoords } };
        const src2 = m.getSource("route-pending") as maplibregl.GeoJSONSource | undefined;
        if (src2) src2.setData(pendingData);
        else {
          m.addSource("route-pending", { type: "geojson", data: pendingData });
          m.addLayer({
            id: "route-pending-line",
            type: "line",
            source: "route-pending",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": "#ec4899", "line-width": 4, "line-opacity": 0.6, "line-dasharray": [1.2, 1.4] },
          });
        }
      }
    };

    // Remove old markers
    markersRef.current.forEach((mk) => mk.remove());
    markersRef.current = [];

    // Origin marker
    const originMk = new maplibregl.Marker({ element: buildOriginMarker() })
      .setLngLat([currentOrigin.longitude, currentOrigin.latitude])
      .setPopup(new maplibregl.Popup({ offset: 18, closeButton: false }).setDOMContent(buildOriginPopup(originInfo, orderedStops.length)))
      .addTo(m);
    markersRef.current.push(originMk);

    // Stop markers
    orderedStops.forEach((stop, i) => {
      const isSelected = selectedId === stop.id;
      const stopNumber = stop.routeOrder ?? (i + 1);
      const mkElement = buildStopMarker(stopNumber, stop.status, isSelected);
      const popup = new maplibregl.Popup({ offset: 18, closeButton: false }).setDOMContent(
        buildStopPopup(stop, stopNumber, onSelect, onEditAddress)
      );
      const mk = new maplibregl.Marker({ element: mkElement, anchor: "bottom" })
        .setLngLat([stop.longitude, stop.latitude])
        .setPopup(popup)
        .addTo(m);

      // Click marker → select delivery
      mkElement.addEventListener("click", () => {
        onSelect?.(stop.id);
      });

      markersRef.current.push(mk);
    });

    // Draw lines
    if (m.isStyleLoaded()) drawLines();
    else m.once("load", drawLines);

    // Fit bounds
    const bounds = new maplibregl.LngLatBounds();
    coords.forEach((p) => bounds.extend(p));
    if (!bounds.isEmpty()) m.fitBounds(bounds, { padding: 54, maxZoom: 15, duration: 500 });
  }, [orderedStops, originInfo, routeOrigin, selectedId, onSelect, onEditAddress]);

  /* ── Fly to selected marker ── */
  useEffect(() => {
    if (selectedId == null || !map.current) return;
    if (prevSelectedRef.current === selectedId) return;
    prevSelectedRef.current = selectedId;
    const stop = orderedStops.find((s) => s.id === selectedId);
    if (!stop) return;
    map.current.flyTo({ center: [stop.longitude, stop.latitude], zoom: 15, duration: 600 });
    // Open popup
    const idx = orderedStops.indexOf(stop);
    if (idx >= 0 && markersRef.current[idx + 1]) {
      markersRef.current[idx + 1]!.togglePopup();
    }
  }, [selectedId, orderedStops]);

  // Reset prevSelected when selectedId becomes null/undefined
  useEffect(() => {
    if (selectedId == null) prevSelectedRef.current = null;
  }, [selectedId]);

  // Empty state
  if (!routeOrigin) {
    return (
      <section className="rounded-3xl border border-white/[.08] bg-gradient-to-br from-zinc-800/30 to-zinc-900 p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/5 text-zinc-500">
            <Icon name="map-pin" className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-black text-white">Recorrido</h2>
            <p className="mt-1 text-sm leading-6 text-zinc-500">
              Configurá la ubicación de la sucursal en el panel de administración para iniciar el recorrido en el mapa.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const pendingStops = orderedStops.filter((stop) => stop.status !== "DELIVERED").length;
  const completedStops = orderedStops.length - pendingStops;

  return (
    <section className="overflow-hidden rounded-3xl border border-white/[.08] bg-zinc-900/70 shadow-xl" aria-label="Recorrido de entregas">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 border-b border-white/5 p-3 sm:p-5">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-pink-300">Ruta automática</p>
          <h2 className="mt-1 text-base sm:text-lg font-black text-white">Recorrido · {orderedStops.length} paradas</h2>
          <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              {completedStops} {completedStops === 1 ? "entregada" : "entregadas"}
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-pink-400" />
              {pendingStops} {pendingStops === 1 ? "pendiente" : "pendientes"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {route.navigationUrl && (
            <a
              href={route.navigationUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-pink-600 px-4 text-sm font-black text-white shadow-lg shadow-pink-950/30 transition hover:bg-pink-500 active:scale-[.98]"
            >
              <Icon name="external-link" className="h-4 w-4" />
              <span className="hidden sm:inline">Navegar</span>
            </a>
          )}
        </div>
      </header>

      {/* Map */}
      {failed ? (
        <div className="grid h-72 place-items-center p-6 text-center text-sm text-zinc-500">
          <Icon name="map-pin" className="mx-auto mb-2 h-6 w-6 text-zinc-600" />
          El mapa no está disponible temporalmente.
        </div>
      ) : (
        <div ref={container} className="h-72 w-full sm:h-[400px]" aria-label="Mapa del recorrido del repartidor" />
      )}

      {/* Legend */}
      {orderedStops.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 border-t border-white/5 px-3 sm:px-4 py-2.5 sm:py-3 text-[10px] sm:text-[11px] text-zinc-500">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-emerald-500" />
            Sucursal
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-pink-500" />
            Pendiente
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-emerald-400 opacity-60" />
            Entregada
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-amber-500" />
            Incidencia
          </span>
        </div>
      )}

      {/* Missing locations warning */}
      {route.missingLocations > 0 && (
        <div className="flex items-center gap-2 border-t border-amber-400/15 bg-amber-500/[.06] px-4 py-3 text-xs text-amber-200">
          <Icon name="warning" className="h-4 w-4 shrink-0" />
          {route.missingLocations} {route.missingLocations === 1 ? "entrega no tiene" : "entregas no tienen"} un punto confirmado y no se agregó al recorrido.
        </div>
      )}
    </section>
  );
}
