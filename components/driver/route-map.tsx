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

function stopMarker(index: number) {
  const element = document.createElement("div");
  element.setAttribute("aria-label", `Parada ${index}`);
  element.textContent = String(index);
  Object.assign(element.style, {
    width: "32px",
    height: "32px",
    display: "grid",
    placeItems: "center",
    borderRadius: "999px",
    border: "3px solid white",
    background: "#ec4899",
    color: "white",
    fontSize: "12px",
    fontWeight: "900",
    boxShadow: "0 8px 22px rgba(0,0,0,.45)",
  });
  return element;
}

function originMarker() {
  const element = document.createElement("div");
  element.setAttribute("aria-label", "Inicio del recorrido");
  Object.assign(element.style, {
    width: "26px",
    height: "26px",
    borderRadius: "8px",
    border: "3px solid white",
    background: "#10b981",
    boxShadow: "0 8px 22px rgba(0,0,0,.4)",
    transform: "rotate(45deg)",
  });
  return element;
}

function popupText(className: string, text: string) {
  const element = document.createElement("p");
  element.className = className;
  element.textContent = text;
  return element;
}

/** @summary Construye una ficha completa y legible para una parada del recorrido. */
function routeStopPopup(stop: RouteStop, index: number) {
  const content = document.createElement("div");
  content.className = "mc-map-popup";
  content.append(
    popupText("mc-map-popup__eyebrow", `Parada ${index}`),
    popupText("mc-map-popup__title", stop.customerName),
    popupText("mc-map-popup__primary", stop.address),
    popupText("mc-map-popup__row", `Entrega: ${stop.number}`),
    popupText("mc-map-popup__row", `Estado: ${deliveryStatusMeta(stop.status).label}`),
  );
  if (stop.reference) content.append(popupText("mc-map-popup__row", `Pedido: ${stop.reference}`));
  if (stop.phone) content.append(popupText("mc-map-popup__row", `Teléfono: ${stop.phone}`));
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

/** @summary Identifica el punto de salida con los datos disponibles de la sucursal. */
function routeOriginPopup(origin: RouteOriginInfo | null, stops: number) {
  const content = document.createElement("div");
  content.className = "mc-map-popup";
  content.append(
    popupText("mc-map-popup__eyebrow", "Inicio del recorrido"),
    popupText("mc-map-popup__title", origin?.name ?? "Punto de salida"),
  );
  if (origin?.address) content.append(popupText("mc-map-popup__primary", origin.address));
  if (origin?.phone) content.append(popupText("mc-map-popup__row", `Teléfono: ${origin.phone}`));
  content.append(popupText("mc-map-popup__row", `${stops} ${stops === 1 ? "parada asignada" : "paradas asignadas"}`));
  return content;
}

/** @summary Dibuja el recorrido automático del repartidor sin reconstruir el mapa al actualizar entregas. */
export function DriverRouteMap({ deliveries }: { deliveries: DriverDelivery[] }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const [failed, setFailed] = useState(false);

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
    // El primer origen solo centra la instancia; las actualizaciones usan la fuente GeoJSON.
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

    /** @summary Sincroniza la línea cuando el estilo cartográfico está listo. */
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
            "line-width": 5,
            "line-opacity": 0.85,
            "line-dasharray": [1.2, 1.4],
          },
        });
      }
    };

    /** @summary Mantiene puntos y encuadre visibles aunque los tiles demoren en cargar. */
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
          new maplibregl.Marker({ element: stopMarker(index + 1), anchor: "bottom" })
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

  if (!routeOrigin) {
    return (
      <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-5">
        <h2 className="text-base font-black text-white">Recorrido</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-500">
          Configurá la ubicación de la sucursal para iniciar el recorrido en el mapa.
        </p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/70" aria-label="Recorrido de entregas">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4 sm:p-5">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-pink-300">Ruta automática</p>
          <h2 className="mt-1 text-lg font-black text-white">Recorrido · {orderedStops.length} paradas</h2>
          <p className="mt-1 text-xs text-zinc-500">Los puntos se ordenan por cercanía. La línea es orientativa.</p>
        </div>
        {navigationUrl && (
          <a
            href={navigationUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-pink-600 px-4 text-sm font-black text-white hover:bg-pink-500"
          >
            <Icon name="external-link" className="h-4 w-4" /> Abrir navegación
          </a>
        )}
      </header>
      {failed ? (
        <div className="grid h-80 place-items-center p-6 text-center text-sm text-zinc-500">El mapa no está disponible temporalmente.</div>
      ) : (
        <div ref={container} className="h-80 w-full sm:h-[420px]" aria-label="Mapa del recorrido del repartidor" />
      )}
      {missingLocations > 0 && (
        <p className="border-t border-amber-400/15 bg-amber-500/[.06] px-4 py-3 text-xs text-amber-200">
          {missingLocations} {missingLocations === 1 ? "entrega no tiene" : "entregas no tienen"} un punto confirmado y no se agregó al recorrido.
        </p>
      )}
    </section>
  );
}
