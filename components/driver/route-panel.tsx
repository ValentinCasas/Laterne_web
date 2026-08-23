"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import Swal from "sweetalert2";
import { scopedFetch } from "@/lib/client-routing";
import { deliveryStatusMeta, nextDriverStatus, canRetireDelivery } from "@/lib/delivery-drivers";
import {
  routeStatusMeta,
  nextRouteStatus,
  formatDuration,
  formatDistance,
  routeProgress,
  progressLabel,
  type RouteStatusKey,
} from "@/lib/delivery-route-state";
import { orderDeliveryRouteStops, googleMapsRouteUrl } from "@/lib/delivery-route";
import { Icon } from "@/components/admin/ui/icons";
import { NumberFlow } from "@/components/admin/ui/number-flow";
import { Drawer } from "@/components/admin/ui/drawer";
import { Timeline } from "@/components/admin/ui/timeline";
import { formatTime as _formatTime, formatRelativeTime as _formatRelativeTime } from "@/lib/date-format";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type RouteStop = {
  id: number;
  number: string;
  customerName: string;
  address: string;
  status: string;
  latitude: number;
  longitude: number;
  reference?: string;
  phone?: string | null;
  requestedAt?: string | Date | null;
  total?: unknown;
  currency?: string;
  itemCount: number;
  instructions?: string | null;
};

type DeliveryItem = {
  id: number;
  number: string;
  status: string;
  routeOrder?: number | null;
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

type ActiveRoute = {
  id: number;
  status: string;
  startedAt?: string | Date | null;
  completedAt?: string | Date | null;
  totalStops: number;
  completedStops: number;
  incidentCount: number;
  totalDistanceM?: number | null;
  totalDurationS?: number | null;
  deliveries: DeliveryItem[];
};

type LastPosition = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  recordedAt: string | Date;
} | null;

const SWAL_THEME = { background: "#18181b", color: "#fafafa" };
const INCIDENT_TYPES = ["cliente ausente", "dirección incorrecta", "rechazó el pedido", "problema de tránsito", "problema del vehículo", "otro"];
const FILTERS = ["Todos", "Pendientes", "Entregados", "Incidencias"] as const;
type FilterKey = (typeof FILTERS)[number];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function coordinate(value: unknown, limit: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && Math.abs(parsed) <= limit ? parsed : null;
}

function formatMoney(value: unknown, currency = "ARS") {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

function formatTime(value: string | Date) {
  return _formatTime(value);
}

function formatRelativeTime(value: string | Date) {
  return _formatRelativeTime(value);
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

/** @summary Agrupa eventos consecutivos del mismo tipo para no repetir "Asignado" N veces. */
function groupStatusLogs(logs: Array<{ status: string; previousStatus: string | null; changedAt: string | Date; reason?: string | null; id?: number }> | undefined) {
  if (!logs || logs.length === 0) return [];
  const grouped: Array<{ status: string; previousStatus: string | null; changedAt: string | Date; reason: string | null; id: number; count: number }> = [];
  for (const log of logs) {
    const last = grouped[grouped.length - 1];
    if (last && last.status === log.status) {
      last.count += 1;
      last.changedAt = log.changedAt; // Keep latest timestamp
    } else {
      grouped.push({
        status: log.status,
        previousStatus: log.previousStatus,
        changedAt: log.changedAt,
        reason: log.reason ?? null,
        id: log.id ?? grouped.length,
        count: 1,
      });
    }
  }
  return grouped;
}

/* ------------------------------------------------------------------ */
/*  Map Helpers                                                        */
/* ------------------------------------------------------------------ */

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
  });
  el.textContent = delivered ? "✓" : incident ? "!" : String(index);
  return el;
}

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

function buildDriverMarker() {
  const el = document.createElement("div");
  el.setAttribute("aria-label", "Mi ubicación");
  Object.assign(el.style, {
    width: "20px",
    height: "20px",
    borderRadius: "50%",
    border: "3px solid #3b82f6",
    background: "#1d4ed8",
    boxShadow: "0 0 0 6px rgba(59,130,246,.25), 0 4px 12px rgba(0,0,0,.4)",
    transition: "all 0.3s",
  });
  return el;
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function DriverRoutePanel({
  initialRoute,
  lastPosition,
  gpsEnabled,
}: {
  initialRoute: ActiveRoute | null;
  lastPosition: LastPosition;
  gpsEnabled: boolean;
}) {
  const [route, setRoute] = useState(initialRoute);
  const [deliveries, setDeliveries] = useState<DeliveryItem[]>(initialRoute?.deliveries ?? []);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filter, setFilter] = useState<FilterKey>("Todos");
  const [working, setWorking] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [lastSyncAt, setLastSyncAt] = useState<Date>(new Date());

  // Incident drawer
  const [incidentForId, setIncidentForId] = useState<number | null>(null);
  const [incidentType, setIncidentType] = useState(INCIDENT_TYPES[0]!);
  const [incidentDescription, setIncidentDescription] = useState("");

  // Confirm drawer
  const [confirmForId, setConfirmForId] = useState<number | null>(null);

  // Driver position
  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number } | null>(
    lastPosition ? { lat: lastPosition.latitude, lng: lastPosition.longitude } : null
  );

  // Map
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const driverMarkerRef = useRef<maplibregl.Marker | null>(null);

  const routeStatus = route?.status ?? "PREPARING";
  const isActive = routeStatus === "IN_PROGRESS" || routeStatus === "PREPARING";
  const completedCount = deliveries.filter((d) => d.status === "DELIVERED").length;
  const pendingDeliveries = deliveries.filter((d) => d.status !== "DELIVERED");
  const nextStop = pendingDeliveries[0] ?? null;
  const progress = routeProgress(completedCount, route?.totalStops ?? deliveries.length);

  // Online/offline detection
  useEffect(() => {
    function handleOnline() { setIsOnline(true); setLastSyncAt(new Date()); }
    function handleOffline() { setIsOnline(false); }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    setIsOnline(navigator.onLine);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Poll for updates
  useEffect(() => {
    if (!route) return;
    let disposed = false;
    async function refresh() {
      const res = await scopedFetch(`/api/driver/routes/${route!.id}`, { cache: "no-store" }).catch(() => null);
      if (!res?.ok || disposed) return;
      const body = (await res.json()) as { route?: ActiveRoute };
      if (body.route) {
        setDeliveries(body.route.deliveries);
        setRoute(body.route);
        setLastSyncAt(new Date());
      }
    }
    const timer = window.setInterval(() => void refresh(), 15_000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [route?.id]);

  // Driver position watch
  useEffect(() => {
    if (!gpsEnabled || !("geolocation" in navigator)) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => setDriverPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [gpsEnabled]);

  // Filtered deliveries
  const filteredDeliveries = useMemo(() => {
    if (filter === "Pendientes") return deliveries.filter((d) => d.status !== "DELIVERED");
    if (filter === "Entregados") return deliveries.filter((d) => d.status === "DELIVERED");
    if (filter === "Incidencias") return deliveries.filter((d) => d.incidents?.some((i) => !i.resolved));
    return deliveries;
  }, [deliveries, filter]);

  // Route stops for map
  const routeStops = useMemo(() => {
    let origin: { latitude: number; longitude: number } | null = null;
    for (const d of deliveries) {
      const lat = coordinate(d.branch?.latitude, 90);
      const lng = coordinate(d.branch?.longitude, 180);
      if (lat !== null && lng !== null) { origin = { latitude: lat, longitude: lng }; break; }
    }
    const stops: RouteStop[] = deliveries.flatMap((d) => {
      const lat = coordinate(d.latitude, 90);
      const lng = coordinate(d.longitude, 180);
      if (lat === null || lng === null) return [];
      return [{
        id: d.id,
        number: d.routeOrder ? String(d.routeOrder) : d.number,
        customerName: d.order?.customerName ?? d.customerName,
        address: d.order?.deliveryAddress ?? d.deliveryAddress ?? "Dirección no informada",
        status: d.status,
        latitude: lat,
        longitude: lng,
        reference: d.order?.reference,
        phone: d.order?.phone ?? d.contactPhone,
        requestedAt: d.order?.requestedAt,
        total: d.order?.total,
        currency: d.order?.currency,
        itemCount: d.items?.length ?? 0,
        instructions: d.instructions ?? d.order?.notes,
      }];
    });
    const ordered = origin ? orderDeliveryRouteStops(origin, stops) : [];
    return { origin, stops: ordered };
  }, [deliveries]);

  const orderedStops = routeStops.stops;
  const routeOrigin = routeStops.origin;
  const navUrl = routeOrigin ? googleMapsRouteUrl(routeOrigin, orderedStops) : null;

  // ── Map initialization ──
  useEffect(() => {
    if (!mapContainer.current || mapRef.current || !routeOrigin) return;
    maplibregl.setWorkerUrl("/vendor/maplibre/maplibre-gl-worker.mjs");
    try {
      const m = new maplibregl.Map({
        container: mapContainer.current,
        style: "https://tiles.openfreemap.org/styles/liberty",
        center: [routeOrigin.longitude, routeOrigin.latitude],
        zoom: 13,
        cooperativeGestures: true,
      });
      m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      mapRef.current = m;
    } catch { /* ignore */ }
    return () => {
      markersRef.current.forEach((mk) => mk.remove());
      markersRef.current = [];
      driverMarkerRef.current?.remove();
      driverMarkerRef.current = null;
      try { mapRef.current?.remove(); } catch { /* */ }
      mapRef.current = null;
    };
  }, [Boolean(routeOrigin)]);

  // ── Update markers & route line ──
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !routeOrigin) return;

    const coords: [number, number][] = [
      [routeOrigin.longitude, routeOrigin.latitude],
      ...orderedStops.map((s) => [s.longitude, s.latitude] as [number, number]),
    ];

    // Find where completed portion ends (last DELIVERED stop index)
    const completedCoords: [number, number][] = [[routeOrigin.longitude, routeOrigin.latitude]];
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
        : [routeOrigin.longitude, routeOrigin.latitude],
      ...orderedStops.slice(lastDeliveredIdx + 1).map((s) => [s.longitude, s.latitude] as [number, number]),
    ];

    // Draw route lines (completed = green solid, pending = pink dashed)
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

    // Remove old single line if exists
    if (m.getLayer("route-line-layer")) {
      m.removeLayer("route-line-layer");
      m.removeSource("route-line");
    }

    // Markers
    markersRef.current.forEach((mk) => mk.remove());
    markersRef.current = [];

    markersRef.current.push(
      new maplibregl.Marker({ element: buildOriginMarker() })
        .setLngLat([routeOrigin.longitude, routeOrigin.latitude])
        .addTo(m)
    );

    orderedStops.forEach((stop, i) => {
      const isSelected = selectedId === stop.id;
      markersRef.current.push(
        new maplibregl.Marker({ element: buildStopMarker(i + 1, stop.status, isSelected), anchor: "bottom" })
          .setLngLat([stop.longitude, stop.latitude])
          .addTo(m)
      );
    });

    if (m.isStyleLoaded()) drawLines();
    else m.once("load", drawLines);

    // Fit bounds
    const bounds = new maplibregl.LngLatBounds();
    coords.forEach((p) => bounds.extend(p));
    if (!bounds.isEmpty()) m.fitBounds(bounds, { padding: 54, maxZoom: 15, duration: 500 });
  }, [orderedStops, routeOrigin, selectedId]);

  // ── Driver position marker ──
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !driverPos) return;
    if (driverMarkerRef.current) {
      driverMarkerRef.current.setLngLat([driverPos.lng, driverPos.lat]);
    } else {
      driverMarkerRef.current = new maplibregl.Marker({ element: buildDriverMarker() })
        .setLngLat([driverPos.lng, driverPos.lat])
        .addTo(m);
    }
  }, [driverPos]);

  // ── Actions ──
  async function startRoute() {
    const confirmed = await Swal.fire({
      title: "Iniciar recorrido",
      text: `Se asignarán las ${deliveries.length || "?"} entregas pendientes a tu recorrido.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Iniciar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#16a34a",
      ...SWAL_THEME,
    });
    if (!confirmed.isConfirmed) return;
    setWorking(true);
    try {
      const res = await scopedFetch("/api/driver/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const body = (await res.json().catch(() => ({}))) as { route?: ActiveRoute; error?: string };
      if (!res.ok || !body.route) {
        await Swal.fire({ title: "No se pudo iniciar", text: body.error ?? "Intentá de nuevo.", icon: "error", ...SWAL_THEME });
        return;
      }
      setRoute(body.route);
      if (body.route.deliveries) setDeliveries(body.route.deliveries);
    } finally {
      setWorking(false);
    }
  }

  async function advanceDelivery(delivery: DeliveryItem) {
    const next = nextDriverStatus(delivery.status);
    if (!next) return;

    // Delivery confirmation drawer for DELIVERED
    if (next === "DELIVERED") {
      setConfirmForId(delivery.id);
      return;
    }

    const confirmed = await Swal.fire({
      title: actionLabel(next),
      text: `La entrega pasará a "${deliveryStatusMeta(next).label}".`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Confirmar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#16a34a",
      ...SWAL_THEME,
    });
    if (!confirmed.isConfirmed) return;

    setWorking(true);
    try {
      const res = await scopedFetch(`/api/driver/deliveries/${delivery.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const body = (await res.json().catch(() => ({}))) as { delivery?: DeliveryItem; error?: string };
      if (!res.ok || !body.delivery) {
        await Swal.fire({ title: "No se pudo avanzar", text: body.error ?? "Intentá de nuevo.", icon: "error", ...SWAL_THEME });
        return;
      }
      setDeliveries((prev) =>
        prev.map((d) =>
          d.id === delivery.id
            ? { ...d, status: body.delivery!.status, statusLogs: [...(d.statusLogs ?? []), { status: next, previousStatus: d.status, changedAt: new Date() }] }
            : d
        )
      );
      setLastSyncAt(new Date());
    } finally {
      setWorking(false);
    }
  }

  async function confirmDeliveryAction() {
    if (!confirmForId) return;
    setWorking(true);
    try {
      const res = await scopedFetch(`/api/driver/deliveries/${confirmForId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DELIVERED" }),
      });
      const body = (await res.json().catch(() => ({}))) as { delivery?: DeliveryItem; error?: string };
      if (!res.ok || !body.delivery) {
        await Swal.fire({ title: "No se pudo confirmar", text: body.error ?? "Intentá de nuevo.", icon: "error", ...SWAL_THEME });
        return;
      }
      setDeliveries((prev) => prev.filter((d) => d.id !== confirmForId));
      setConfirmForId(null);
      setSelectedId(null);
      setLastSyncAt(new Date());
    } finally {
      setWorking(false);
    }
  }

  async function completeRoute() {
    if (!route) return;
    const pending = deliveries.filter((d) => d.status !== "DELIVERED").length;
    if (pending > 0) {
      const result = await Swal.fire({
        title: "¿Finalizar recorrido?",
        text: `Quedan ${pending} entrega${pending === 1 ? "" : "s"} pendiente${pending === 1 ? "" : "s"}. ¿Seguro que querés finalizar?`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Sí, finalizar",
        cancelButtonText: "Seguir entregando",
        confirmButtonColor: "#dc2626",
        ...SWAL_THEME,
      });
      if (!result.isConfirmed) return;
    } else {
      const result = await Swal.fire({
        title: "¿Finalizar recorrido?",
        text: "Todas las entregas están completadas.",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Finalizar",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#16a34a",
        ...SWAL_THEME,
      });
      if (!result.isConfirmed) return;
    }
    setWorking(true);
    try {
      const res = await scopedFetch(`/api/driver/routes/${route.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      });
      const body = (await res.json().catch(() => ({}))) as { route?: ActiveRoute; error?: string };
      if (!res.ok || !body.route) {
        await Swal.fire({ title: "No se pudo finalizar", text: body.error ?? "Intentá de nuevo.", icon: "error", ...SWAL_THEME });
        return;
      }
      setRoute(body.route);
      await Swal.fire({ title: "Recorrido completado", icon: "success", timer: 1500, showConfirmButton: false, ...SWAL_THEME });
    } finally {
      setWorking(false);
    }
  }

  async function reportIncident() {
    if (!incidentForId || !incidentDescription.trim()) return;
    setWorking(true);
    try {
      const res = await scopedFetch("/api/driver/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryId: incidentForId, type: incidentType, description: incidentDescription.trim() }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        await Swal.fire({ title: "No se pudo reportar", text: body.error ?? "Intentá de nuevo.", icon: "error", ...SWAL_THEME });
        return;
      }
      setDeliveries((prev) => prev.map((d) =>
        d.id === incidentForId ? { ...d, status: "INCIDENT", incidents: [...(d.incidents ?? []), { id: Date.now(), type: incidentType, description: incidentDescription, resolved: false, reportedAt: new Date() }] } : d
      ));
      setIncidentForId(null);
      setIncidentDescription("");
      setLastSyncAt(new Date());
      await Swal.fire({ title: "Incidencia reportada", icon: "success", timer: 1100, showConfirmButton: false, ...SWAL_THEME });
    } finally {
      setWorking(false);
    }
  }

  const selected = deliveries.find((d) => d.id === selectedId) ?? null;
  const confirmTarget = deliveries.find((d) => d.id === confirmForId) ?? null;
  const incidentFor = deliveries.find((d) => d.id === incidentForId) ?? null;

  // ── No route state ──
  if (!route || route.status === "COMPLETED" || route.status === "CANCELLED") {
    return (
      <div className="space-y-5">
        {/* Summary if just completed */}
        {route && (route.status === "COMPLETED" || route.status === "CANCELLED") && (
          <div className="rounded-3xl border border-emerald-400/20 bg-gradient-to-br from-emerald-500/10 via-zinc-900 to-zinc-950 p-6 text-center shadow-xl">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-500/20">
              <Icon name="check-circle" className="h-8 w-8 text-emerald-300" />
            </span>
            <h2 className="mt-4 text-xl font-black text-white">Recorrido {route.status === "COMPLETED" ? "completado" : "cancelado"}</h2>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-sm text-zinc-400">
              <span><NumberFlow value={route.completedStops} />/{route.totalStops} entregas</span>
              {route.totalDurationS != null && <span>{formatDuration(route.totalDurationS)}</span>}
              {route.incidentCount > 0 && <span>{route.incidentCount} incidencia{route.incidentCount === 1 ? "" : "s"}</span>}
            </div>
          </div>
        )}

        {/* Start new route */}
        <div className="rounded-3xl border border-dashed border-white/10 bg-white/[.015] p-8 text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-white/5 to-transparent text-zinc-600">
            <Icon name="truck" className="h-7 w-7" />
          </span>
          <h3 className="mt-5 text-lg font-black text-white">
            {route ? "Iniciar nuevo recorrido" : "Sin recorrido activo"}
          </h3>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-zinc-500">
            Iniciá un recorrido para organizar tus entregas en una secuencia ordenada.
          </p>
          <button
            type="button"
            className="mt-6 inline-flex min-h-14 items-center gap-2 rounded-2xl bg-emerald-600 px-8 text-base font-black text-white shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-500 active:scale-[.98]"
            onClick={() => void startRoute()}
            disabled={working}
          >
            {working ? <Icon name="loader" className="h-5 w-5 animate-spin" /> : <Icon name="truck" className="h-5 w-5" />}
            Iniciar recorrido
          </button>
        </div>
      </div>
    );
  }

  // ── Active route ──
  return (
    <div className={`space-y-4 ${fullscreen ? "fixed inset-0 z-50 bg-zinc-950 overflow-auto p-4" : ""}`}>
      {/* ── Route header with progress ── */}
      <section className="rounded-3xl border border-white/[.08] bg-gradient-to-br from-sky-500/[.06] via-zinc-900 to-zinc-950 p-5 shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${routeStatusMeta(routeStatus).badge}`}>
                {routeStatusMeta(routeStatus).label}
              </span>
              {!isOnline && (
                <span className="rounded-full bg-orange-500/15 px-2.5 py-1 text-[10px] font-black text-orange-300">
                  Sin conexión
                </span>
              )}
            </div>
            <h2 className="mt-2 text-xl font-black text-white">
              Recorrido · {progressLabel(completedCount, route.totalStops)}
            </h2>
            {route.startedAt && (
              <p className="mt-1 text-xs text-zinc-500">
                Iniciado {formatRelativeTime(route.startedAt)}
                {route.totalDurationS != null && ` · ${formatDuration(route.totalDurationS)}`}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {navUrl && (
              <a
                href={navUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-pink-600 px-4 text-sm font-black text-white shadow-lg shadow-pink-950/30 transition hover:bg-pink-500 active:scale-[.98]"
              >
                <Icon name="external-link" className="h-4 w-4" />
                <span className="hidden sm:inline">Navegar</span>
              </a>
            )}
            {isActive && (
              <button
                type="button"
                className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-bold text-white transition hover:bg-white/10"
                onClick={() => void completeRoute()}
                disabled={working}
              >
                <Icon name="check-circle" className="h-4 w-4" />
                <span className="hidden sm:inline">Finalizar</span>
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Progreso</span>
            <span className="font-bold text-white">{progress}%</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* KPI row */}
        <div className="mt-4 grid grid-cols-4 gap-2">
          {[
            { label: "Activas", value: pendingDeliveries.length, icon: "package", color: "text-sky-300", bg: "bg-sky-500/15" },
            { label: "Entregadas", value: completedCount, icon: "check-circle", color: "text-emerald-300", bg: "bg-emerald-500/15" },
            { label: "Incidencias", value: route.incidentCount, icon: "warning", color: route.incidentCount > 0 ? "text-orange-300" : "text-zinc-400", bg: route.incidentCount > 0 ? "bg-orange-500/15" : "bg-white/5" },
            { label: "Paradas", value: route.totalStops, icon: "map-pin", color: "text-violet-300", bg: "bg-violet-500/15" },
          ].map((kpi) => (
            <div key={kpi.label} className={`rounded-xl ${kpi.bg} px-3 py-2.5`}>
              <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">{kpi.label}</p>
              <p className={`mt-1 text-lg font-black ${kpi.color}`}>
                <NumberFlow value={kpi.value} />
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Map ── */}
      {routeOrigin && (
        <section className="overflow-hidden rounded-3xl border border-white/[.08] bg-zinc-900/70 shadow-xl">
          <header className="flex items-center justify-between border-b border-white/5 px-4 py-3">
            <h3 className="text-sm font-black text-white">Mapa del recorrido</h3>
            <div className="flex items-center gap-2">
              {driverPos && (
                <button
                  type="button"
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-white/5 px-3 text-xs font-bold text-zinc-400 transition hover:bg-white/10 hover:text-white"
                  onClick={() => {
                    mapRef.current?.flyTo({ center: [driverPos.lng, driverPos.lat], zoom: 15, duration: 500 });
                  }}
                >
                  <Icon name="location" className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Mi ubicación</span>
                </button>
              )}
              <button
                type="button"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-white/5 px-3 text-xs font-bold text-zinc-400 transition hover:bg-white/10 hover:text-white"
                onClick={() => setFullscreen((f) => !f)}
              >
                <Icon name={fullscreen ? "x" : "eye"} className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{fullscreen ? "Salir" : "Completo"}</span>
              </button>
            </div>
          </header>
          <div
            ref={mapContainer}
            className={`w-full ${fullscreen ? "h-[60vh]" : "h-72 sm:h-[400px]"}`}
            aria-label="Mapa del recorrido"
          />
        </section>
      )}

      {/* ── Next stop ── */}
      {nextStop && (
        <section className="rounded-3xl border border-pink-400/20 bg-gradient-to-br from-pink-500/[.08] via-zinc-900 to-zinc-950 p-5 shadow-xl">
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-pink-300">Próxima parada</p>
          <div className="mt-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-lg font-black text-white">
                {nextStop.order?.customerName ?? nextStop.customerName}
              </h3>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-zinc-400">
                <Icon name="map-pin" className="h-3.5 w-3.5 shrink-0 text-pink-400/70" />
                {nextStop.order?.deliveryAddress ?? nextStop.deliveryAddress ?? "Dirección no informada"}
              </p>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-500">
                {nextStop.order?.reference && <span>Pedido: {nextStop.order.reference}</span>}
                {nextStop.order?.total !== undefined && (
                  <span className="font-bold text-zinc-300">{formatMoney(nextStop.order.total, nextStop.order.currency)}</span>
                )}
              </div>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className="flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-pink-600 text-sm font-black text-white shadow-lg shadow-pink-950/30 transition hover:bg-pink-500 active:scale-[.98]"
              onClick={() => setSelectedId(nextStop.id)}
            >
              <Icon name="eye" className="h-4 w-4" />
              Ver parada
            </button>
            {(nextStop.order?.phone ?? nextStop.contactPhone) && (
              <a
                href={`tel:${encodeURIComponent(nextStop.order?.phone ?? nextStop.contactPhone ?? "")}`}
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-zinc-400 transition hover:bg-white/10 hover:text-white"
                aria-label="Llamar al cliente"
              >
                <Icon name="phone" className="h-4 w-4" />
              </a>
            )}
          </div>
        </section>
      )}

      {/* ── Filters ── */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition ${
              filter === f
                ? "bg-white/10 text-white"
                : "bg-white/5 text-zinc-500 hover:bg-white/[.08] hover:text-zinc-300"
            }`}
            onClick={() => setFilter(f)}
          >
            {f}
            {f === "Pendientes" && pendingDeliveries.length > 0 && (
              <span className="ml-1.5 rounded-full bg-pink-500/20 px-1.5 py-0.5 text-[9px]">{pendingDeliveries.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Delivery cards ── */}
      <div className="space-y-3">
        {filteredDeliveries.map((delivery) => {
          const meta = deliveryStatusMeta(delivery.status);
          const next = nextDriverStatus(delivery.status);
          const address = delivery.order?.deliveryAddress ?? delivery.deliveryAddress;
          const hasIncidents = delivery.incidents?.some((i) => !i.resolved);
          const isDelivered = delivery.status === "DELIVERED";
          const stopNum = delivery.routeOrder;
          return (
            <article
              key={delivery.id}
              className={`group overflow-hidden rounded-3xl border shadow-xl transition-all duration-300 ${
                selectedId === delivery.id
                  ? "border-pink-400/30 bg-gradient-to-br from-pink-500/[.08] via-zinc-900 to-zinc-950"
                  : isDelivered
                    ? "border-emerald-400/15 bg-zinc-900/50 opacity-70"
                    : "border-white/[.08] bg-zinc-900/80 hover:border-white/[.14]"
              }`}
            >
              <button type="button" className="w-full p-4 text-left" onClick={() => setSelectedId(delivery.id)}>
                <div className="flex items-start gap-3">
                  {/* Stop number */}
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-black ${
                    isDelivered ? "bg-emerald-500/20 text-emerald-300" : "bg-pink-500/15 text-pink-300"
                  }`}>
                    {isDelivered ? "✓" : stopNum ? `#${stopNum}` : `#${delivery.id}`}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-base font-black text-white">
                        {delivery.order?.customerName ?? delivery.customerName}
                      </h3>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${meta.badge}`}>{meta.label}</span>
                      {hasIncidents && <span className="rounded-full bg-orange-500/15 px-2 py-1 text-[10px] font-black text-orange-300">Incidencia</span>}
                    </div>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-zinc-400">
                      <Icon name="map-pin" className="h-3.5 w-3.5 shrink-0 text-pink-400/70" />
                      <span className="truncate">{address ?? "Dirección no informada"}</span>
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
                      {delivery.order?.reference && <span>{delivery.order.reference}</span>}
                      <span>{formatTime(delivery.order?.requestedAt ?? delivery.createdAt)}</span>
                      {delivery.items && delivery.items.length > 0 && (
                        <span>{delivery.items.length} producto{delivery.items.length === 1 ? "" : "s"}</span>
                      )}
                      {delivery.order?.total !== undefined && (
                        <span className="font-bold text-zinc-300">{formatMoney(delivery.order.total, delivery.order.currency)}</span>
                      )}
                    </div>
                  </div>
                </div>
              </button>

              {/* Actions */}
              {!isDelivered && (
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
                      className={`flex min-h-12 flex-[1.5] items-center justify-center gap-2 rounded-2xl text-sm font-black text-white transition active:scale-[.99] ${
                        next === "DELIVERED" ? "bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-950/30" : "bg-sky-600 hover:bg-sky-500 shadow-lg shadow-sky-950/30"
                      }`}
                      disabled={working}
                      onClick={() => void advanceDelivery(delivery)}
                    >
                      {working ? <Icon name="loader" className="h-4 w-4 animate-spin" /> : <Icon name={actionIcon(next)} className="h-4 w-4" />}
                      {actionLabel(next)}
                    </button>
                  )}
                  {(delivery.order?.phone ?? delivery.contactPhone) && (
                    <a
                      href={`tel:${delivery.order?.phone ?? delivery.contactPhone}`}
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-zinc-400 transition hover:bg-white/10 hover:text-white"
                      aria-label="Llamar"
                    >
                      <Icon name="phone" className="h-4 w-4" />
                    </a>
                  )}
                </div>
              )}
            </article>
          );
        })}
        {filteredDeliveries.length === 0 && (
          <div className="rounded-3xl border border-dashed border-white/10 bg-white/[.015] p-8 text-center">
            <Icon name="package" className="mx-auto h-6 w-6 text-zinc-600" />
            <p className="mt-2 text-sm text-zinc-500">
              {filter === "Todos" ? "No hay entregas en este recorrido" : `No hay entregas ${filter.toLowerCase()}`}
            </p>
          </div>
        )}
      </div>

      {/* ── Detail Drawer ── */}
      <Drawer
        open={Boolean(selected)}
        onClose={() => { /* keep selection on close */ }}
        title={selected ? `Parada ${selected.routeOrder ?? selected.number}` : "Detalle"}
        width="560px"
        footer={selected && (
          <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-2">
            <button
              type="button"
              className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-orange-400/20 bg-orange-500/10 px-4 text-xs font-black text-orange-300 transition hover:bg-orange-500/20"
              onClick={() => setIncidentForId(selected.id)}
            >
              <Icon name="warning" className="h-4 w-4" />
              Incidencia
            </button>
            {nextDriverStatus(selected.status) && (
              <button
                type="button"
                className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl text-sm font-black text-white transition active:scale-[.99] ${
                  nextDriverStatus(selected.status) === "DELIVERED" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-sky-600 hover:bg-sky-500"
                }`}
                disabled={working}
                onClick={() => void advanceDelivery(selected)}
              >
                {working ? <Icon name="loader" className="h-4 w-4 animate-spin" /> : <Icon name={actionIcon(nextDriverStatus(selected.status)!)} className="h-4 w-4" />}
                {actionLabel(nextDriverStatus(selected.status)!)}
              </button>
            )}
          </div>
        )}
      >
        {selected && (
          <div className="space-y-5">
            {/* Client */}
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
              {/* Contact */}
              <div className="mt-3 flex gap-2">
                {(selected.order?.phone ?? selected.contactPhone) && (
                  <a className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm font-bold text-sky-300 transition hover:bg-white/10" href={`tel:${selected.order?.phone ?? selected.contactPhone}`}>
                    <Icon name="phone" className="h-4 w-4" />
                    {selected.order?.phone ?? selected.contactPhone}
                  </a>
                )}
                {/* Copy address */}
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm font-bold text-zinc-400 transition hover:bg-white/10 hover:text-white"
                  onClick={() => {
                    const addr = selected.order?.deliveryAddress ?? selected.deliveryAddress;
                    if (addr) navigator.clipboard.writeText(addr);
                  }}
                >
                  <Icon name="search" className="h-4 w-4" />
                  Copiar dirección
                </button>
              </div>
              {/* Instructions */}
              {(selected.instructions ?? selected.order?.notes) && (
                <div className="mt-3 rounded-xl bg-amber-500/10 border border-amber-400/15 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300/70">Observaciones</p>
                  <p className="mt-1 text-xs leading-5 text-amber-100">{selected.instructions ?? selected.order?.notes}</p>
                </div>
              )}
            </section>

            {/* Order */}
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
              <h3 className="mb-3 text-sm font-black text-white">Historial</h3>
              <Timeline
                items={groupStatusLogs(selected.statusLogs).map((group) => ({
                  id: group.id,
                  date: group.changedAt,
                  title: group.count > 1
                    ? `${deliveryStatusMeta(group.status).label} ×${group.count}`
                    : deliveryStatusMeta(group.status).label,
                  description: group.reason,
                  tone: group.status === "DELIVERED" ? "success" : group.status === "INCIDENT" ? "danger" : "info",
                  icon: <Icon name={group.status === "DELIVERED" ? "check" : group.status === "INCIDENT" ? "warning" : "truck"} className="h-3.5 w-3.5" />,
                }))}
                initialLimit={5}
              />
            </section>
          </div>
        )}
      </Drawer>

      {/* ── Confirm Delivery Drawer ── */}
      <Drawer open={Boolean(confirmForId)} onClose={() => setConfirmForId(null)} title="Confirmar entrega" width="440px">
        {confirmTarget && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-400/15 bg-emerald-500/5 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300/60">Entrega</p>
              <p className="mt-1 font-black text-white">
                Parada {confirmTarget.routeOrder ?? confirmTarget.number} · {confirmTarget.order?.customerName ?? confirmTarget.customerName}
              </p>
              <p className="mt-1 text-sm text-zinc-400">
                {confirmTarget.order?.deliveryAddress ?? confirmTarget.deliveryAddress}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[.02] p-4">
              <p className="text-xs text-zinc-500">Pedido: {confirmTarget.order?.reference ?? confirmTarget.number}</p>
              {confirmTarget.order?.total !== undefined && (
                <p className="mt-1 text-sm font-bold text-zinc-300">{formatMoney(confirmTarget.order.total, confirmTarget.order.currency)}</p>
              )}
            </div>
            <button
              type="button"
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 font-black text-white transition hover:bg-emerald-500 disabled:opacity-50"
              disabled={working}
              onClick={() => void confirmDeliveryAction()}
            >
              {working ? <Icon name="loader" className="h-5 w-5 animate-spin" /> : <Icon name="check-circle" className="h-5 w-5" />}
              {working ? "Confirmando…" : "Confirmar entrega"}
            </button>
          </div>
        )}
      </Drawer>

      {/* ── Incident Drawer ── */}
      <Drawer open={Boolean(incidentForId)} onClose={() => setIncidentForId(null)} title="Reportar incidencia" width="440px">
        {incidentFor && (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void reportIncident(); }}>
            <div className="rounded-2xl border border-orange-400/15 bg-orange-500/5 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-orange-300/60">Entrega</p>
              <p className="mt-1 font-black text-white">{incidentFor.number} · {incidentFor.customerName}</p>
            </div>
            <label className="block text-xs font-bold text-zinc-300">
              Tipo de incidencia
              <select className="input mt-2 w-full" value={incidentType} onChange={(e) => setIncidentType(e.target.value)}>
                {INCIDENT_TYPES.map((t) => <option key={t} value={t}>{t[0]!.toUpperCase() + t.slice(1)}</option>)}
              </select>
            </label>
            <label className="block text-xs font-bold text-zinc-300">
              Descripción
              <textarea
                className="input mt-2 min-h-28 w-full resize-y"
                value={incidentDescription}
                onChange={(e) => setIncidentDescription(e.target.value)}
                placeholder="Contanos qué pasó con esta entrega…"
                maxLength={2000}
                required
              />
            </label>
            <button
              type="submit"
              disabled={!incidentDescription.trim() || working}
              className="flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-orange-600 px-4 font-black text-white transition hover:bg-orange-500 disabled:opacity-50"
            >
              {working ? <Icon name="loader" className="h-4 w-4 animate-spin" /> : <Icon name="warning" className="h-4 w-4" />}
              {working ? "Reportando…" : "Reportar incidencia"}
            </button>
          </form>
        )}
      </Drawer>
    </div>
  );
}
