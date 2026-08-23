"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DriverActiveDeliveries, type DriverDelivery } from "@/components/driver/active-deliveries";
import { DriverLocationSharing } from "@/components/driver/location-sharing";
import { DriverProfileCard } from "@/components/driver/profile-card";
import { DriverSummaryCards } from "@/components/driver/summary-cards";
import { DriverRouteMap } from "@/components/driver/route-map";
import { scopedFetch } from "@/lib/client-routing";
import {
  routeStatusMeta,
  routeProgress,
  formatDuration,
} from "@/lib/delivery-route-state";
import { googleMapsRouteUrl, orderDeliveryRouteStops } from "@/lib/delivery-route";
import { Icon } from "@/components/admin/ui/icons";
import { NumberFlow } from "@/components/admin/ui/number-flow";
import { formatTime, formatRelativeTime } from "@/lib/date-format";
import { EditAddressModal } from "@/components/driver/edit-address-modal";
import Swal from "sweetalert2";

const SWAL_THEME = { background: "#18181b", color: "#fafafa" };

type DriverProfile = Parameters<typeof DriverProfileCard>[0]["driver"];
type LastPosition = Parameters<typeof DriverLocationSharing>[0]["initialLastPosition"];
type CompletedDelivery = { id: number; number: string; customerName: string; deliveredAt?: string | Date | null; order?: { reference: string } | null };

/** @summary Recorrido activo del repartidor con datos de progreso y entregas. */
type ActiveRoute = {
  id: number;
  status: string;
  startedAt?: string | Date | null;
  totalStops: number;
  completedStops: number;
  incidentCount: number;
  totalDistanceM?: number | null;
  totalDurationS?: number | null;
  deliveries: DriverDelivery[];
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function coordinate(value: unknown, limit: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && Math.abs(parsed) <= limit ? parsed : null;
}



/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

/** @summary Dashboard operativo del repartidor con KPIs, mapa, entregas, GPS y recorrido. */
export function DriverDashboard({
  driver,
  initialDeliveries,
  completedToday: initialCompleted,
  averageMinutes,
  incidents,
  lastPosition,
  initialRoute,
}: {
  driver: DriverProfile;
  initialDeliveries: DriverDelivery[];
  completedToday: CompletedDelivery[];
  averageMinutes: number | null;
  incidents: number;
  lastPosition: LastPosition;
  initialRoute?: ActiveRoute | null;
}) {
  const [rawDeliveries, setRawDeliveries] = useState(initialDeliveries);
  const [completedToday, setCompletedToday] = useState(initialCompleted);
  const [deliveredTodayCount, setDeliveredTodayCount] = useState(initialCompleted.length);
  const [incidentCount, setIncidentCount] = useState(incidents);
  const [route, setRoute] = useState(initialRoute ?? null);
  const [working, setWorking] = useState(false);

  /* ── Source of truth: when a route is active, route.deliveries includes ALL
     stops (pending + delivered). The separate `rawDeliveries` state only has
     active statuses and would drop DELIVERED stops on every poll. */
  const hasActiveRoute = route?.status === "IN_PROGRESS" || route?.status === "PREPARING";
  const deliveries = useMemo(() => {
    if (hasActiveRoute && route?.deliveries?.length) return route.deliveries;
    return rawDeliveries;
  }, [hasActiveRoute, route?.deliveries, rawDeliveries]);
  const setDeliveriesFromRoute = useCallback((updater: (prev: DriverDelivery[]) => DriverDelivery[]) => {
    setRoute((prev) => {
      if (!prev?.deliveries) return prev;
      return { ...prev, deliveries: updater(prev.deliveries) };
    });
  }, []);

  /* ── Map ↔ List sync ── */
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectTarget, setSelectTarget] = useState<"map" | "list" | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filter, setFilter] = useState<"Todos" | "Pendientes" | "Entregados" | "Incidencias">("Todos");
  const [editAddressId, setEditAddressId] = useState<number | null>(null);
  /* ── Route computed ── */
  const completedCount = deliveries.filter((d) => d.status === "DELIVERED").length;
  const pendingDeliveries = deliveries.filter((d) => d.status !== "DELIVERED");
  const nextStop = hasActiveRoute ? pendingDeliveries[0] ?? null : null;
  const routeProgressPct = route ? routeProgress(completedCount, route.totalStops) : 0;

  /** @summary Ordena entregas por routeOrder cuando hay recorrido activo. */
  const sortedDeliveries = useMemo(() => {
    if (hasActiveRoute && deliveries.some((d) => d.routeOrder)) {
      return [...deliveries].sort((a, b) => (a.routeOrder ?? Infinity) - (b.routeOrder ?? Infinity));
    }
    return deliveries;
  }, [deliveries, hasActiveRoute]);

  /** @summary Filtro de entregas para la lista. */
  const filteredDeliveries = useMemo(() => {
    if (filter === "Pendientes") return sortedDeliveries.filter((d) => d.status !== "DELIVERED");
    if (filter === "Entregados") return sortedDeliveries.filter((d) => d.status === "DELIVERED");
    if (filter === "Incidencias") return sortedDeliveries.filter((d) => d.incidents?.some((i) => !i.resolved));
    return sortedDeliveries;
  }, [sortedDeliveries, filter]);

  const pendingCount = pendingDeliveries.length;
  const deliveredInRouteCount = sortedDeliveries.filter((d) => d.status === "DELIVERED").length;
  const incidentsInRouteCount = sortedDeliveries.filter((d) => d.incidents?.some((i) => !i.resolved)).length;

  /** @summary URL de navegación por Google Maps con todas las paradas del recorrido. */
  const navUrl = useMemo(() => {
    if (!hasActiveRoute) return null;
    let origin: { latitude: number; longitude: number } | null = null;
    for (const d of deliveries) {
      const lat = coordinate(d.branch?.latitude, 90);
      const lng = coordinate(d.branch?.longitude, 180);
      if (lat !== null && lng !== null) { origin = { latitude: lat, longitude: lng }; break; }
    }
    if (!origin) return null;
    const stops = deliveries
      .filter((d) => coordinate(d.latitude, 90) !== null && coordinate(d.longitude, 180) !== null)
      .map((d) => ({ id: d.id, latitude: coordinate(d.latitude, 90)!, longitude: coordinate(d.longitude, 180)! }));
    if (stops.length === 0) return null;
    const ordered = orderDeliveryRouteStops(origin, stops);
    return googleMapsRouteUrl(origin, ordered);
  }, [hasActiveRoute, deliveries]);

  /* ── Selection handlers ── */
  /** @summary Selecciona una entrega y abre el drawer de detalle. */
  const handleVerDatos = useCallback((id: number) => {
    setSelectedId(id);
    setDrawerOpen(true);
  }, []);

  /** @summary Selecciona una entrega y centra el mapa en su marker. */
  const handleVerEnMapa = useCallback((id: number) => {
    setSelectedId(id);
    setSelectTarget("map");
  }, []);

  /** @summary Maneja click en marker del mapa: selecciona y abre popup. */
  const handleMarkerSelect = useCallback((id: number) => {
    setSelectedId(id);
    setDrawerOpen(false);
  }, []);

  /** @summary Cierra el drawer de detalle. */
  const handleCloseDrawer = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  /* ── Effects: scroll/center based on selectTarget ── */
  useEffect(() => {
    if (selectedId === null || !selectTarget) return;
    if (selectTarget === "list") {
      const el = document.getElementById(`delivery-card-${selectedId}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    // Use rAF to avoid synchronous setState in effect
    const id = requestAnimationFrame(() => setSelectTarget(null));
    return () => cancelAnimationFrame(id);
  }, [selectedId, selectTarget]);

  /* ── Polling: entregas + completadas ── */
  useEffect(() => {
    let disposed = false;
    async function refresh() {
      const response = await scopedFetch("/api/driver/deliveries", { cache: "no-store" }).catch(() => null);
      if (!response?.ok || disposed) return;
      const body = (await response.json()) as { activeDeliveries?: DriverDelivery[]; completedToday?: CompletedDelivery[]; deliveredTodayCount?: number };
      // When a route is active, route.deliveries is the source of truth.
      // The /deliveries endpoint only returns active statuses and would drop DELIVERED stops.
      if (!hasActiveRoute && body.activeDeliveries) setRawDeliveries(body.activeDeliveries);
      if (body.completedToday) setCompletedToday(body.completedToday);
      if (body.deliveredTodayCount !== undefined) setDeliveredTodayCount(body.deliveredTodayCount);
    }
    const timer = window.setInterval(() => void refresh(), 20_000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [hasActiveRoute]);

  /* ── Polling: recorrido activo ── */
  useEffect(() => {
    if (!route) return;
    const routeId = route.id;
    let disposed = false;
    async function refresh() {
      const res = await scopedFetch(`/api/driver/routes/${routeId}`, { cache: "no-store" }).catch(() => null);
      if (!res?.ok || disposed) return;
      const body = (await res.json()) as { route?: ActiveRoute };
      if (body.route) setRoute(body.route);
    }
    const timer = window.setInterval(() => void refresh(), 15_000);
    return () => { disposed = true; window.clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.id]);

  /* ── Acciones de recorrido ── */

  async function startRoute() {
    const confirmed = await Swal.fire({
      title: "Iniciar recorrido",
      text: `Se asignarán las ${pendingDeliveries.length || "?"} entrega${pendingDeliveries.length === 1 ? "" : "s"} pendiente${pendingDeliveries.length === 1 ? "" : "s"} a tu recorrido.`,
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
      // Re-fetch full route with all deliveries to sync state
      const routeRes = await scopedFetch(`/api/driver/routes/${body.route.id}`, { cache: "no-store" }).catch(() => null);
      if (routeRes?.ok) {
        const routeBody = (await routeRes.json().catch(() => ({}))) as { route?: ActiveRoute };
        if (routeBody.route) setRoute(routeBody.route);
      }
    } finally {
      setWorking(false);
    }
  }

  async function completeRoute() {
    if (!route) return;
    const pending = pendingDeliveries.length;
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
      setRoute(null);
      setSelectedId(null);
      const delRes = await scopedFetch("/api/driver/deliveries", { cache: "no-store" });
      const delBody = (await delRes.json().catch(() => ({}))) as { activeDeliveries?: DriverDelivery[]; completedToday?: CompletedDelivery[]; deliveredTodayCount?: number };
      if (delBody.activeDeliveries) setRawDeliveries(delBody.activeDeliveries);
      if (delBody.completedToday) setCompletedToday(delBody.completedToday);
      if (delBody.deliveredTodayCount !== undefined) setDeliveredTodayCount(delBody.deliveredTodayCount);
      await Swal.fire({ title: "Recorrido completado", icon: "success", timer: 1500, showConfirmButton: false, ...SWAL_THEME });
    } finally {
      setWorking(false);
    }
  }

  /* ── Render ── */
  return (
    <div className="space-y-4 overflow-x-hidden">
      {/* ── Hero KPIs ── */}
      <DriverSummaryCards active={hasActiveRoute ? pendingDeliveries.length : deliveries.length} deliveredToday={deliveredTodayCount} averageMinutes={averageMinutes} incidents={incidentCount} />

      {/* ── Main layout: Map + Sidebar ── */}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,.8fr)] min-w-0">
        {/* ── Left: Map + Deliveries ── */}
        <div className="space-y-4 lg:col-start-1 min-w-0">
          {/* Mapa */}
          <DriverRouteMap
            deliveries={sortedDeliveries}
            selectedId={selectedId}
            onSelect={handleMarkerSelect}
            onEditAddress={(id) => setEditAddressId(id)}
          />

          {/* ── Entregas ── */}
          <section>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3 px-1">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.18em] text-pink-300">Operación</p>
                <h2 className="mt-1 text-xl font-black text-white">
                  {hasActiveRoute ? "Paradas del recorrido" : "Mis entregas"}
                </h2>
              </div>
              {sortedDeliveries.length > 0 && (
                <span className="flex items-center gap-1.5 rounded-full bg-sky-500/15 px-3 py-1.5 text-xs font-black text-sky-300">
                  <Icon name="package" className="h-3 w-3" />
                  {sortedDeliveries.length} {hasActiveRoute ? "paradas" : "activas"}
                </span>
              )}
            </div>

            {/* Filtros */}
            {hasActiveRoute && sortedDeliveries.length > 0 && (
              <div className="mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
                {(["Todos", "Pendientes", "Entregados", "Incidencias"] as const).map((f) => {
                  const count = f === "Todos" ? sortedDeliveries.length
                    : f === "Pendientes" ? pendingCount
                    : f === "Entregados" ? deliveredInRouteCount
                    : incidentsInRouteCount;
                  return (
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
                      {count > 0 && f !== "Todos" && (
                        <span className="ml-1.5 rounded-full bg-pink-500/20 px-1.5 py-0.5 text-[9px]">{count}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            <DriverActiveDeliveries
              deliveries={filteredDeliveries}
              allDeliveries={sortedDeliveries}
              onChange={hasActiveRoute ? (next) => setDeliveriesFromRoute(() => next) : setRawDeliveries}
              onDelivered={() => {
                setDeliveredTodayCount((value) => value + 1);
                setCompletedToday((current) => {
                  const newEntry = { id: Date.now(), number: "", customerName: "", deliveredAt: new Date() };
                  return [newEntry, ...current];
                });
              }}
              onIncident={() => setIncidentCount((value) => value + 1)}
              routeActive={hasActiveRoute}
              selectedId={selectedId}
              onSelect={handleVerDatos}
              onMapSelect={handleVerEnMapa}
              drawerOpen={drawerOpen}
              onCloseDrawer={handleCloseDrawer}
            />
          </section>
        </div>

        {/* ── Right: Sidebar (sticky) ── */}
        <aside className="space-y-4 lg:col-start-2 lg:row-start-1 min-w-0">
          {/* ── Recorrido ── */}
          {hasActiveRoute && route ? (
            <section className="overflow-hidden rounded-3xl border border-white/[.08] bg-gradient-to-br from-sky-500/[.06] via-zinc-900 to-zinc-950 p-4 sm:p-5 shadow-xl">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="grid h-9 w-9 place-items-center rounded-2xl bg-sky-500/15">
                    <Icon name="truck" className="h-4 w-4 text-sky-300" />
                  </span>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[.18em] text-sky-300">Recorrido</p>
                    <p className="text-xs text-zinc-500">
                      {route.startedAt ? `Iniciado ${formatRelativeTime(route.startedAt)}` : "Preparando"}
                    </p>
                  </div>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${routeStatusMeta(route.status).badge}`}>
                  {routeStatusMeta(route.status).label}
                </span>
              </div>

              {/* Barra de progreso */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>Progreso</span>
                  <span className="font-bold text-white">{routeProgressPct}%</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
                    style={{ width: `${routeProgressPct}%` }}
                  />
                </div>
              </div>

              <p className="mt-2 text-xs text-zinc-500">
                <NumberFlow value={completedCount} /> de {route.totalStops} entregas
                {route.totalDurationS != null && ` · ${formatDuration(route.totalDurationS)}`}
              </p>

              {/* Próxima parada */}
              {nextStop && (
                <div className="mt-3 rounded-xl border border-pink-400/15 bg-pink-500/[.06] p-3">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-pink-300/70">Próxima parada</p>
                  <p className="mt-1 text-sm font-bold text-white truncate">
                    #{nextStop.routeOrder ?? "?"} · {nextStop.order?.customerName ?? nextStop.customerName}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-400 truncate">
                    {nextStop.order?.deliveryAddress ?? nextStop.deliveryAddress ?? "Dirección no informada"}
                  </p>
                  {nextStop.order?.reference && (
                    <p className="mt-1 text-[11px] text-zinc-500">Pedido: {nextStop.order.reference}</p>
                  )}
                  {(nextStop.order?.phone ?? nextStop.contactPhone) && (
                    <a
                      href={`tel:${encodeURIComponent(nextStop.order?.phone ?? nextStop.contactPhone ?? "")}`}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-[11px] font-bold text-sky-300 transition hover:bg-white/10"
                    >
                      <Icon name="phone" className="h-3 w-3" />
                      {nextStop.order?.phone ?? nextStop.contactPhone}
                    </a>
                  )}
                </div>
              )}

              {/* Acciones */}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 text-xs font-bold text-white transition hover:bg-white/10 active:scale-[.99]"
                  onClick={() => void completeRoute()}
                  disabled={working}
                >
                  {working ? <Icon name="loader" className="h-4 w-4 animate-spin" /> : <Icon name="check-circle" className="h-4 w-4" />}
                  Finalizar
                </button>
                {navUrl && (
                  <a
                    href={navUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-pink-600 px-4 text-xs font-black text-white shadow-lg shadow-pink-950/30 transition hover:bg-pink-500 active:scale-[.98]"
                  >
                    <Icon name="external-link" className="h-4 w-4" />
                    Navegar
                  </a>
                )}
              </div>
            </section>
          ) : (
            /* Sin recorrido: card compacta para iniciar */
            <section className="overflow-hidden rounded-3xl border border-white/[.08] bg-gradient-to-br from-zinc-800/30 to-zinc-900 p-4 sm:p-5 shadow-xl">
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-2xl bg-pink-500/15">
                  <Icon name="truck" className="h-4 w-4 text-pink-300" />
                </span>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.18em] text-pink-300">Recorrido</p>
                  <p className="text-xs text-zinc-500">Sin recorrido activo</p>
                </div>
              </div>
              {pendingDeliveries.length > 0 ? (                  <p className="mt-3 text-xs sm:text-sm text-zinc-400">
                  Tenés <span className="font-bold text-white">{pendingDeliveries.length}</span>{" "}
                  entrega{pendingDeliveries.length === 1 ? "" : "s"} disponible{pendingDeliveries.length === 1 ? "" : "s"} para incluir en el recorrido.
                </p>
              ) : (
                <p className="mt-3 text-sm text-zinc-500">No hay entregas pendientes por el momento.</p>
              )}
              <button
                type="button"
                className="mt-4 flex min-h-11 sm:min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 text-xs sm:text-sm font-black text-white shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-500 active:scale-[.99] disabled:opacity-50"
                onClick={() => void startRoute()}
                disabled={working || pendingDeliveries.length === 0}
              >
                {working ? <Icon name="loader" className="h-4 w-4 animate-spin" /> : <Icon name="truck" className="h-4 w-4" />}
                Iniciar recorrido
              </button>
            </section>
          )}

          {/* GPS — SIEMPRE visible */}
          <DriverLocationSharing
            deliveries={sortedDeliveries.filter((d) => d.status !== "DELIVERED").map((delivery) => ({ id: delivery.id, branchId: delivery.branch?.id, status: delivery.status }))}
            fallbackBranchId={driver.branches?.[0]?.branch?.id}
            initialEnabled={driver.locationSharingEnabled}
            initialLastPosition={lastPosition}
          />

          {/* Últimas completadas */}
          {completedToday.length > 0 && (
            <section className="overflow-hidden rounded-3xl border border-white/[.08] bg-gradient-to-br from-emerald-500/[.06] via-zinc-900 to-zinc-950 shadow-xl">
              <div className="flex items-center justify-between border-b border-white/5 px-4 sm:px-5 py-3 sm:py-3.5">
                <div>
                  <h2 className="text-sm font-black text-white">Completadas hoy</h2>
                  <p className="text-[10px] font-medium text-zinc-500">{deliveredTodayCount} entregas finalizadas</p>
                </div>
                <span className="hidden sm:inline-flex rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-black text-emerald-300">
                  <Icon name="check-circle" className="mr-1 inline h-3 w-3" />
                  Hoy
                </span>
              </div>
              <ul className="divide-y divide-white/5">
                {completedToday.slice(0, 5).map((delivery) => (
                  <li key={delivery.id} className="flex items-center justify-between gap-2 sm:gap-3 px-4 sm:px-5 py-2.5 sm:py-3 transition-colors hover:bg-white/[.02]">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-zinc-200">{delivery.customerName}</p>
                      <p className="mt-0.5 text-[11px] text-zinc-500">{delivery.order?.reference ?? delivery.number}</p>
                    </div>
                    <span className="shrink-0 text-[10px] font-bold text-emerald-400">
                      {delivery.deliveredAt ? formatTime(delivery.deliveredAt) : ""}
                    </span>
                  </li>
                ))}
              </ul>
              {completedToday.length > 5 && (
                <div className="border-t border-white/5 px-5 py-2.5 text-center">
                  <span className="text-[11px] font-bold text-zinc-500">+{completedToday.length - 5} más</span>
                </div>
              )}
            </section>
          )}
        </aside>
      </div>

      {/* ── Edit Address Modal ── */}
      {editAddressId !== null && (() => {
        const editDelivery = deliveries.find((d) => d.id === editAddressId);
        if (!editDelivery) return null;
        return (
          <EditAddressModal
            deliveryId={editAddressId}
            currentAddress={editDelivery.order?.deliveryAddress ?? editDelivery.deliveryAddress ?? ""}
            currentReference={editDelivery.order?.notes ?? editDelivery.instructions}
            currentLat={coordinate(editDelivery.latitude, 90)}
            currentLng={coordinate(editDelivery.longitude, 180)}
            onClose={() => setEditAddressId(null)}
            onSaved={(updated) => {
              if (hasActiveRoute) {
                setDeliveriesFromRoute((prev) => prev.map((d) =>
                  d.id === editAddressId
                    ? { ...d, deliveryAddress: updated.deliveryAddress, latitude: String(updated.latitude), longitude: String(updated.longitude) }
                    : d
                ));
              }
              setEditAddressId(null);
            }}
          />
        );
      })()}
    </div>
  );
}
