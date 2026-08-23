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

/** @summary Mantiene separadas la preferencia persistida, el watcher del navegador y la última posición guardada. */
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

  /** @summary Restaura el watcher sin volver a pedir interacción cuando el permiso ya está concedido. */
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
    ? "Sin posiciones"
    : !live && freshness.state === "live"
      ? "Hace menos de 10 s"
      : freshness.label;
  const statusLabel = live
    ? "Compartiendo en vivo"
    : state === "denied"
      ? "Permiso de ubicación bloqueado"
      : preferenceEnabled
        ? tracking
          ? "Buscando señal GPS"
          : "Ubicación habilitada"
        : "Ubicación pausada";

  return (
    <section className={`overflow-hidden rounded-3xl border p-5 shadow-2xl transition-colors duration-300 ${live ? "border-emerald-400/25 bg-gradient-to-br from-emerald-500/10 via-zinc-900 to-zinc-950" : "border-white/10 bg-gradient-to-br from-zinc-900 to-zinc-950"}`}>
      <div className="flex items-start gap-3">
        <span className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${live ? "bg-emerald-500/15 text-emerald-300" : state === "denied" ? "bg-red-500/15 text-red-300" : "bg-white/5 text-zinc-400"}`}>
          {live && <span className="absolute inset-0 animate-ping rounded-2xl bg-emerald-400/10" />}
          <Icon name="location" className="relative h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-zinc-500">Ubicación</p>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-black text-white" aria-live="polite">{statusLabel}</h2>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black ${live ? "bg-emerald-500/15 text-emerald-300" : state === "denied" ? "bg-red-500/15 text-red-300" : "bg-white/5 text-zinc-300"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${live ? "animate-pulse bg-emerald-400" : state === "denied" ? "bg-red-400" : "bg-zinc-500"}`} />
              {isSending ? "Enviando" : live ? freshness?.label : preferenceEnabled ? "Habilitada" : "Pausada"}
            </span>
          </div>
          {state === "resume" && (
            <p className="mt-2 text-xs leading-5 text-sky-200">Compartir ubicación está habilitado. Tocá para reanudar el GPS.</p>
          )}
          {message && <p className={`mt-2 text-xs leading-5 ${state === "denied" ? "text-red-200" : "text-amber-200"}`}>{message}</p>}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-white/5 bg-black/15 px-3 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Última actualización</p>
          <p className="mt-1 text-sm font-bold text-zinc-100">{lastUpdateLabel}</p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-black/15 px-3 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Precisión</p>
          <p className="mt-1 text-sm font-bold text-zinc-100">{accuracy === null ? "—" : `± ${Math.round(accuracy)} m`}</p>
        </div>
      </div>

      <button
        type="button"
        className={`mt-4 min-h-14 w-full rounded-2xl px-5 py-4 text-base font-black transition-all active:scale-[.99] ${tracking ? "border border-white/15 bg-white/5 text-white hover:bg-white/10" : "bg-emerald-600 text-white shadow-lg shadow-emerald-950/30 hover:bg-emerald-500"}`}
        onClick={tracking ? () => void pause() : () => void enable()}
        disabled={(state === "requesting" && !tracking) || state === "unavailable"}
      >
        {tracking ? "Pausar ubicación" : state === "requesting" ? "Conectando GPS…" : preferenceEnabled ? "Reanudar GPS" : "Compartir ubicación"}
      </button>
      {preferenceEnabled && !tracking && state !== "requesting" && (
        <button type="button" className="mt-2 min-h-11 w-full py-2 text-xs font-bold text-zinc-400 transition hover:text-white" onClick={() => void pause()}>
          Desactivar ubicación
        </button>
      )}
      <p className="mt-3 text-[11px] leading-4 text-zinc-500">
        Mientras esté habilitada, MenuClick intentará compartir tu posición. Algunos teléfonos pueden suspender el GPS si cerrás el navegador.
      </p>
      <span className="sr-only">Permiso del navegador: {permission}</span>
    </section>
  );
}
