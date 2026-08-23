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

type RouteStop = DeliveryRouteCoordinate & {
  id: number;
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

/** @summary Marcador premium de parada con numeración elegante. */
function stopMarker(index: number, status: string) {
  const element = document.createElement("div");
  element.setAttribute("aria-label", `Parada ${index}`);
  const delivered = status === "DELIVERED";
  Object.assign(element.style, {
    width: "34px",
    height: "34px",
    display: "grid",
    placeItems: "center",
    borderRadius: "12px",
    border: "3px solid white",
    background: delivered ? "#10b981" : "#ec4899",
    color: "white",
    fontSize: "13px",
    fontWeight: "900",
    boxShadow: "0 8px 25px rgba(0,0,0,.5)",
    opacity: delivered ? "0.6" : "1",
    transition: "opacity 0.3s",
  });
  element.textContent = delivered ? "✓" : String(index);
  return element;
}

/** @summary Marcador del origen (sucursal) con estilo distinctivo. */
function originMarker() {
  const element = document.createElement("div");
  element.setAttribute("aria-label", "Inicio del recorrido");
  Object.assign(element.style, {
    width: "28px",
    height: "28px",
    borderRadius: "8px",
    border: "3px solid white",
    background: "linear-gradient(135deg, #10b981, #059669)",
    boxShadow: "0 8px 25px rgba(0,0,0,.5)",
    display: "grid",
    placeItems: "center",
  });
  const inner = document.createElement("div");
  inner.className = "icon-inner";
  Object.assign(inner.style, {
    width: "8px",
    height: "8px",
    borderRadius: "2px",
    background: "white",
    transform: "rotate(45deg)",
  });
  element.appendChild(inner);
  return element;
}

function popupText(className: string, text: string) {
  const element = document.createElement("p");
  element.className = className;
  element.textContent = text;
  return element;
}

/** @summary Ficha premium para una parada del recorrido. */
function routeStopPopup(stop: RouteStop, index: number) {
  const content = document.createElement("div");
  content.className = "mc-map-popup";
  content.style.maxWidth = "260px";
  const meta = deliveryStatusMeta(stop.status);
  content.append(
    popupText("mc-map-popup__eyebrow", `Parada ${index}`),
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
    content.append(
      popupText(
        "mc-map-popup__row",
        `Horario: ${new Date(stop.requestedAt).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`,
      ),
    );
  }
  content.append(popupText("mc-map-popup__row", `Productos: ${stop.itemCount}`));
  const total = Number(stop.total);
  if (Number.isFinite(total)) {
    content.append(
      popupText(
        "mc-map-popup__row",
        `Total: ${new Intl.NumberFormat("es-AR", { style: "currency", currency: stop.currency ?? "ARS", maximumFractionDigits: 0 }).format(total)}`,
      ),
    );
  }
  return content;
}

/** @summary Popup del origen (sucursal). */
function routeOriginPopup(origin: RouteOriginInfo | null, stops: number) {
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

/** @summary Mapa premium del recorrido con marcadores numerados, ruta visual y controles inteligentes. */
export function DriverRouteMap({ deliveries }: { deliveries: DriverDelivery[] }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const [failed, setFailed] = useState(false);
  const [showRoute, setShowRoute] = useState(true);

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
    const orderedStops = routeOrigin ? orderDeliveryRouteStops(routeOrigin, stops) : [];
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
  const navigationUrl = route.navigationUrl;
  const missingLocations = route.missingLocations;

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
      for (const marker of markers.current) marker.remove();
      markers.current = [];
      try {
        map.current?.remove();
      } catch {
        /* ya removido */
      }
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasRouteOrigin]);

  useEffect(() => {
    const currentMap = map.current;
    const currentOrigin = routeOrigin;
    if (!currentMap || !currentOrigin) return;

    const coordinates: [number, number][] = [
      [currentOrigin.longitude, currentOrigin.latitude],
      ...orderedStops.map((stop) => [stop.longitude, stop.latitude] as [number, number]),
    ];
    const data = {
      type: "Feature" as const,
      properties: {},
      geometry: { type: "LineString" as const, coordinates },
    };

    const drawLine = () => {
      const source = currentMap.getSource("driver-route") as maplibregl.GeoJSONSource | undefined;
      if (source) source.setData(data);
      else {
        currentMap.addSource("driver-route", { type: "geojson", data });
        currentMap.addLayer({
          id: "driver-route-line",
          type: "line",
          source: "driver-route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#ec4899",
            "line-width": 4,
            "line-opacity": 0.8,
            "line-dasharray": [1.2, 1.4],
          },
        });
      }
    };

    const drawMarkers = () => {
      for (const marker of markers.current) marker.remove();
      markers.current = [];
      markers.current.push(
        new maplibregl.Marker({ element: originMarker() })
          .setLngLat([currentOrigin.longitude, currentOrigin.latitude])
          .setPopup(new maplibregl.Popup({ offset: 18 }).setDOMContent(routeOriginPopup(originInfo, orderedStops.length)))
          .addTo(currentMap),
      );
      orderedStops.forEach((stop, index) => {
        markers.current.push(
          new maplibregl.Marker({ element: stopMarker(index + 1, stop.status), anchor: "bottom" })
            .setLngLat([stop.longitude, stop.latitude])
            .setPopup(new maplibregl.Popup({ offset: 18 }).setDOMContent(routeStopPopup(stop, index + 1)))
            .addTo(currentMap),
        );
      });

      const bounds = new maplibregl.LngLatBounds();
      coordinates.forEach((point) => bounds.extend(point));
      if (!bounds.isEmpty()) currentMap.fitBounds(bounds, { padding: 54, maxZoom: 15, duration: 500 });
    };

    drawMarkers();
    if (currentMap.isStyleLoaded()) drawLine();
    else currentMap.once("load", drawLine);
    return () => {
      currentMap.off("load", drawLine);
    };
  }, [orderedStops, originInfo, routeOrigin]);

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
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 p-4 sm:p-5">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-pink-300">Ruta automática</p>
          <h2 className="mt-1 text-lg font-black text-white">Recorrido · {orderedStops.length} paradas</h2>
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
          {navigationUrl && (
            <a
              href={navigationUrl}
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
        <div className="flex flex-wrap items-center gap-3 border-t border-white/5 px-4 py-3 text-[11px] text-zinc-500">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-emerald-500" />
            Sucursal
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-pink-500" />
            Parada pendiente
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-emerald-400 opacity-60" />
            Entregada
          </span>
        </div>
      )}

      {/* Missing locations warning */}
      {missingLocations > 0 && (
        <div className="flex items-center gap-2 border-t border-amber-400/15 bg-amber-500/[.06] px-4 py-3 text-xs text-amber-200">
          <Icon name="warning" className="h-4 w-4 shrink-0" />
          {missingLocations} {missingLocations === 1 ? "entrega no tiene" : "entregas no tienen"} un punto confirmado y no se agregó al recorrido.
        </div>
      )}
    </section>
  );
}
