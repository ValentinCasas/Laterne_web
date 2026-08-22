import { haversineMeters } from "@/lib/geofence";

export const DRIVER_POSITION_MIN_INTERVAL_MS = 15_000;
export const DRIVER_POSITION_HEARTBEAT_MS = 60_000;
export const DRIVER_POSITION_MIN_DISTANCE_METERS = 15;

export type PublishablePosition = {
  latitude: number;
  longitude: number;
  recordedAt: number;
};

/** @summary Decide si una lectura GPS merece enviarse por tiempo, movimiento o latido de continuidad. */
export function shouldPublishDriverPosition(
  previous: PublishablePosition | null,
  next: PublishablePosition,
) {
  if (!previous) return true;
  const elapsed = next.recordedAt - previous.recordedAt;
  if (elapsed < DRIVER_POSITION_MIN_INTERVAL_MS) return false;
  if (elapsed >= DRIVER_POSITION_HEARTBEAT_MS) return true;
  return (
    haversineMeters(previous.latitude, previous.longitude, next.latitude, next.longitude) >=
    DRIVER_POSITION_MIN_DISTANCE_METERS
  );
}

export type GpsFreshness = {
  label: string;
  state: "live" | "recent" | "stale";
};

/** @summary Traduce la antigüedad de una posición a una etiqueta operativa que nunca finge presencia en vivo. */
export function gpsFreshness(value: string | Date, now = Date.now()): GpsFreshness {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return { label: "Ubicación desactualizada", state: "stale" };
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1_000));
  if (seconds <= 10) return { label: "En vivo", state: "live" };
  if (seconds < 60) return { label: `Hace ${seconds} s`, state: "recent" };
  const minutes = Math.floor(seconds / 60);
  if (minutes < 5) return { label: `Hace ${minutes} min`, state: "recent" };
  return { label: "Ubicación desactualizada", state: "stale" };
}
