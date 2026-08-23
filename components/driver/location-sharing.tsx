"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/admin/ui/icons";
import { scopedFetch } from "@/lib/client-routing";
import {
  gpsFreshness,
  shouldPublishDriverPosition,
  type PublishablePosition,
} from "@/lib/delivery-tracking";

type TrackingTarget = { deliveryId?: number; branchId?: number };
type PermissionState = "granted" | "prompt" | "denied" | "unknown";
type SharingState = "paused" | "resume" | "requesting" | "active" | "denied" | "unavailable" | "error";

type LastPosition = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  recordedAt: string | Date;
} | null;

/** @summary Elige la entrega operativa prioritaria o la sucursal habilitada para asociar el GPS. */
function trackingTarget(
  deliveries: Array<{ id: number; branchId?: number | null; status: string }>,
  branchId?: number,
) {
  const priority = ["ON_THE_WAY", "PICKED_UP", "ASSIGNED"];
  const delivery = [...deliveries].sort(
    (a, b) => priority.indexOf(a.status) - priority.indexOf(b.status),
  )[0];
  if (delivery) return { deliveryId: delivery.id } satisfies TrackingTarget;
  return branchId ? ({ branchId } satisfies TrackingTarget) : null;
}

/** @summary Panel GPS premium con estados visuales claros, calidad de señal y controls elegantes. */
export function DriverLocationSharing({
  deliveries,
  fallbackBranchId,
  initialEnabled,
  initialLastPosition,
}: {
  deliveries: Array<{ id: number; branchId?: number | null; status: string }>;
  fallbackBranchId?: number;
  initialEnabled: boolean;
  initialLastPosition: LastPosition;
}) {
  const initialRecordedAt = initialLastPosition ? new Date(initialLastPosition.recordedAt) : null;
  const [preferenceEnabled, setPreferenceEnabled] = useState(initialEnabled);
  const [state, setState] = useState<SharingState>(initialEnabled ? "resume" : "paused");
  const [permission, setPermission] = useState<PermissionState>("unknown");
  const [tracking, setTracking] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<Date | null>(initialRecordedAt);
  const [accuracy, setAccuracy] = useState<number | null>(initialLastPosition?.accuracy ?? null);
  const [message, setMessage] = useState("");
  const [, setClock] = useState(0);
  const deliveriesRef = useRef(deliveries);
  const fallbackBranchIdRef = useRef(fallbackBranchId);
  const watchId = useRef<number | null>(null);
  const lastSent = useRef<PublishablePosition | null>(
    initialLastPosition
      ? {
          latitude: initialLastPosition.latitude,
          longitude: initialLastPosition.longitude,
          recordedAt: initialRecordedAt?.getTime() ?? 0,
        }
      : null,
  );
  const sending = useRef(false);
  const active = useRef(false);

  useEffect(() => {
    deliveriesRef.current = deliveries;
    fallbackBranchIdRef.current = fallbackBranchId;
  }, [deliveries, fallbackBranchId]);

  const clearWatcher = useCallback(() => {
    active.current = false;
    if (watchId.current !== null && typeof navigator !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.clearWatch(watchId.current);
    }
    watchId.current = null;
    sending.current = false;
    setIsSending(false);
    setTracking(false);
  }, []);

  const persistPreference = useCallback(async (enabled: boolean) => {
    const response = await scopedFetch("/api/driver/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationSharingEnabled: enabled }),
    });
    const body = (await response.json().catch(() => ({}))) as {
      driver?: { locationSharingEnabled: boolean };
      error?: string;
    };
    if (!response.ok || !body.driver) throw new Error(body.error ?? "No se pudo guardar la preferencia.");
    setPreferenceEnabled(body.driver.locationSharingEnabled);
  }, []);

  const publish = useCallback(
    async (position: GeolocationPosition) => {
      const next: PublishablePosition = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        recordedAt: position.timestamp || Date.now(),
      };
      if (!shouldPublishDriverPosition(lastSent.current, next) || sending.current) return;
      const target = trackingTarget(deliveriesRef.current, fallbackBranchIdRef.current);
      if (!target) {
        setState("error");
        setMessage("No tenés una entrega activa ni una sucursal habilitada para asociar la ubicación.");
        return;
      }

      sending.current = true;
      setIsSending(true);
      try {
        const response = await scopedFetch("/api/admin/drivers/positions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...target,
            latitude: next.latitude,
            longitude: next.longitude,
            accuracy: position.coords.accuracy,
            recordedAt: new Date(next.recordedAt).toISOString(),
          }),
        });
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) {
          setState("error");
          setMessage(body.error ?? "No se pudo enviar la ubicación.");
          return;
        }
        lastSent.current = next;
        setLastSentAt(new Date(next.recordedAt));
        setAccuracy(position.coords.accuracy);
        setState("active");
        setMessage("");
      } catch {
        setState("error");
        setMessage("Sin conexión. MenuClick seguirá intentando mientras el GPS esté activo.");
      } finally {
        sending.current = false;
        setIsSending(false);
      }
    },
    [],
  );

  const startWatcher = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setState("unavailable");
      setMessage("Este navegador no ofrece geolocalización.");
      return;
    }
    if (watchId.current !== null) return;
    setState("requesting");
    setTracking(true);
    setMessage("");
    active.current = true;
    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        if (active.current) void publish(position);
      },
      (error) => {
        if (!active.current) return;
        if (error.code === error.PERMISSION_DENIED) {
          clearWatcher();
          setPermission("denied");
          setState("denied");
          setMessage("Habilitá la ubicación para este sitio desde la configuración del navegador y volvé a intentar.");
          return;
        }
        setState("error");
        setMessage(error.code === error.TIMEOUT ? "No obtuvimos una posición a tiempo. Volveremos a intentar." : "No pudimos determinar tu ubicación.");
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 10_000 },
    );
  }, [clearWatcher, publish]);

  useEffect(() => {
    if (!preferenceEnabled) return clearWatcher;

    let disposed = false;
    let permissionStatus: PermissionStatus | null = null;
    async function restore() {
      if (!("permissions" in navigator)) {
        setState("resume");
        return;
      }
      try {
        permissionStatus = await navigator.permissions.query({ name: "geolocation" });
        if (disposed) return;
        const applyPermission = () => {
          if (!permissionStatus || disposed) return;
          setPermission(permissionStatus.state);
          if (permissionStatus.state === "granted") startWatcher();
          else if (permissionStatus.state === "denied") {
            clearWatcher();
            setState("denied");
            setMessage("Habilitá la ubicación para este sitio desde la configuración del navegador.");
          } else {
            clearWatcher();
            setState("resume");
            setMessage("");
          }
        };
        applyPermission();
        permissionStatus.onchange = applyPermission;
      } catch {
        setState("resume");
      }
    }
    void restore();
    return () => {
      disposed = true;
      if (permissionStatus) permissionStatus.onchange = null;
      clearWatcher();
    };
  }, [clearWatcher, preferenceEnabled, startWatcher]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock((value) => value + 1), 5_000);
    return () => window.clearInterval(timer);
  }, []);

  async function enable() {
    setState("requesting");
    setMessage("");
    try {
      if (!preferenceEnabled) await persistPreference(true);
      startWatcher();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "No se pudo habilitar la ubicación.");
    }
  }

  async function pause() {
    clearWatcher();
    setState("paused");
    setMessage("");
    try {
      await persistPreference(false);
    } catch (error) {
      setPreferenceEnabled(true);
      setState("resume");
      setMessage(error instanceof Error ? error.message : "No se pudo guardar la pausa.");
    }
  }

  const freshness = lastSentAt ? gpsFreshness(lastSentAt) : null;
  const live = tracking && state === "active" && freshness?.state !== "stale";
  const lastUpdateLabel = !freshness
    ? "Sin datos"
    : !live && freshness.state === "live"
      ? "Actualizando"
      : freshness.label;

  const stateConfig = live
    ? { bg: "from-emerald-500/12 via-zinc-900 to-zinc-950", border: "border-emerald-400/25", iconBg: "bg-emerald-500/20", iconColor: "text-emerald-300", dot: "bg-emerald-400", label: "Compartiendo en vivo" }
    : state === "denied"
      ? { bg: "from-red-500/10 via-zinc-900 to-zinc-950", border: "border-red-400/25", iconBg: "bg-red-500/20", iconColor: "text-red-300", dot: "bg-red-400", label: "Permiso denegado" }
      : state === "error"
        ? { bg: "from-orange-500/10 via-zinc-900 to-zinc-950", border: "border-orange-400/20", iconBg: "bg-orange-500/20", iconColor: "text-orange-300", dot: "bg-orange-400", label: "Error de conexión" }
        : tracking
          ? { bg: "from-sky-500/10 via-zinc-900 to-zinc-950", border: "border-sky-400/20", iconBg: "bg-sky-500/20", iconColor: "text-sky-300", dot: "bg-sky-400", label: "Buscando señal" }
          : { bg: "from-zinc-800/50 via-zinc-900 to-zinc-950", border: "border-white/10", iconBg: "bg-white/10", iconColor: "text-zinc-400", dot: "bg-zinc-500", label: "GPS inactivo" };

  // Quality indicator based on accuracy
  const qualityLabel = accuracy === null ? null : accuracy < 20 ? "Excelente" : accuracy < 50 ? "Buena" : accuracy < 100 ? "Regular" : "Baja";
  const qualityColor = accuracy === null ? "text-zinc-500" : accuracy < 20 ? "text-emerald-300" : accuracy < 50 ? "text-sky-300" : accuracy < 100 ? "text-amber-300" : "text-red-300";

  return (
    <section className={`overflow-hidden rounded-3xl border bg-gradient-to-br shadow-2xl transition-all duration-500 ${stateConfig.border} ${stateConfig.bg}`}>
      {/* Header */}
      <div className="flex items-start gap-3 p-5 pb-4">
        <span className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${stateConfig.iconBg} transition-colors`}>
          {live && <span className="absolute inset-0 animate-ping rounded-2xl bg-emerald-400/10" />}
          <Icon name="location" className={`relative h-5 w-5 ${stateConfig.iconColor}`} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-zinc-500">Ubicación GPS</p>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-black text-white">{stateConfig.label}</h2>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black ${live ? "bg-emerald-500/15 text-emerald-300" : state === "denied" ? "bg-red-500/15 text-red-300" : "bg-white/5 text-zinc-400"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${live ? "animate-pulse" : ""} ${stateConfig.dot}`} />
              {isSending ? "Enviando" : live ? freshness?.label : preferenceEnabled ? "Habilitada" : "Pausada"}
            </span>
          </div>
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 gap-2 px-5 pb-4">
        <div className="rounded-xl border border-white/5 bg-black/20 px-3 py-3">
          <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-600">Última actualización</p>
          <p className="mt-1 text-sm font-bold text-zinc-100">{lastUpdateLabel}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-black/20 px-3 py-3">
          <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-600">Precisión</p>
          <p className="mt-1 text-sm font-bold text-zinc-100">
            {accuracy === null ? "—" : `± ${Math.round(accuracy)} m`}
            {qualityLabel && <span className={`ml-1.5 text-[10px] font-bold ${qualityColor}`}>{qualityLabel}</span>}
          </p>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`mx-5 mb-3 rounded-xl px-4 py-3 text-xs leading-5 ${state === "denied" ? "bg-red-500/10 text-red-200" : state === "error" ? "bg-orange-500/10 text-orange-200" : "bg-sky-500/10 text-sky-200"}`}>
          {message}
        </div>
      )}

      {/* Action */}
      <div className="border-t border-white/5 px-5 py-4">
        <button
          type="button"
          className={`min-h-14 w-full rounded-2xl px-5 py-4 text-base font-black transition-all duration-200 active:scale-[.99] ${tracking ? "border border-white/10 bg-white/5 text-white hover:bg-white/10" : "bg-emerald-600 text-white shadow-lg shadow-emerald-950/30 hover:bg-emerald-500"}`}
          onClick={tracking ? () => void pause() : () => void enable()}
          disabled={(state === "requesting" && !tracking) || state === "unavailable"}
        >
          <span className="flex items-center justify-center gap-2">
            {tracking ? (
              <>
                <Icon name="x" className="h-5 w-5" />
                Pausar ubicación
              </>
            ) : state === "requesting" ? (
              <>
                <Icon name="loader" className="h-5 w-5 animate-spin" />
                Conectando GPS…
              </>
            ) : (
              <>
                <Icon name="location" className="h-5 w-5" />
                Compartir ubicación
              </>
            )}
          </span>
        </button>
        {preferenceEnabled && !tracking && state !== "requesting" && (
          <button type="button" className="mt-2 min-h-11 w-full py-2 text-xs font-bold text-zinc-500 transition hover:text-white" onClick={() => void pause()}>
            Desactivar completamente
          </button>
        )}
      </div>

      <p className="px-5 pb-4 text-[11px] leading-4 text-zinc-600">
        Mientras esté habilitada, MenuClick compartirá tu posición cada pocos segundos. Algunos teléfonos pueden suspender el GPS si cerrás el navegador.
      </p>
      <span className="sr-only">Permiso del navegador: {permission}</span>
    </section>
  );
}
