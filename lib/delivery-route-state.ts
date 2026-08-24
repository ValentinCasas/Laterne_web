/**
 * Estados y transiciones del recorrido del repartidor.
 * Mantenido en un archivo separado para reuso seguro en cliente y servidor.
 */

export const ROUTE_STATUSES = {
  PREPARING: { label: "Preparando", badge: "bg-zinc-500/15 text-zinc-300" },
  IN_PROGRESS: { label: "En curso", badge: "bg-sky-500/15 text-sky-300" },
  COMPLETED: { label: "Completado", badge: "bg-emerald-500/15 text-emerald-300" },
  CANCELLED: { label: "Cancelado", badge: "bg-red-500/15 text-red-300" },
} as const;

export type RouteStatusKey = keyof typeof ROUTE_STATUSES;

export function routeStatusMeta(status: string | null | undefined) {
  return (
    ROUTE_STATUSES[status as RouteStatusKey] ?? {
      label: status || "Desconocido",
      badge: "bg-zinc-500/15 text-zinc-300",
    }
  );
}

/** @summary Transiciones válidas desde cada estado del recorrido. */
export const ROUTE_TRANSITIONS: Record<string, ReadonlyArray<string>> = {
  PREPARING: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
};

/** @summary Indica si una transición de recorrido es válida. */
export function canRouteTransition(from: string, to: string) {
  const allowed = ROUTE_TRANSITIONS[from];
  return Array.isArray(allowed) && allowed.includes(to);
}

/** @summary Siguiente estado lógico del recorrido. */
export function nextRouteStatus(from: string): string | null {
  const allowed = ROUTE_TRANSITIONS[from];
  if (!Array.isArray(allowed)) return null;
  return allowed.find((s) => s !== "CANCELLED") ?? null;
}

/** @summary Formatea la duración en segundos a texto legible. */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m} min`;
  return `${h} h ${m} min`;
}

/** @summary Formatea distancia en metros a texto legible. */
export function formatDistance(meters: number | null | undefined): string {
  if (meters === null || meters === undefined) return "—";
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/** @summary Calcula el progreso como porcentaje. */
export function routeProgress(completed: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

/** @summary Etiqueta de progreso legible. */
export function progressLabel(completed: number, total: number): string {
  return `${completed} de ${total} entregas`;
}

/** @summary Cálculo canónico de métricas de recorrido. Úsalo en lista, detalle y admin para evitar discrepancias entre vistas. */
export function getRouteStats(
  route: {
    totalStops: number;
    startedAt?: string | Date | null;
    completedAt?: string | Date | null;
    cancelledAt?: string | Date | null;
    totalDurationS?: number | null;
  },
  deliveries: Array<{
    status: string;
    incidents?: Array<{ resolved?: boolean }>;
  }>
): {
  totalStops: number;
  deliveredStops: number;
  incidentStops: number;
  failedStops: number;
  duration: number | null;
  progress: number;
} {
  const totalStops = route.totalStops > 0 ? route.totalStops : deliveries.length;
  const deliveredStops = deliveries.filter((d) => d.status === "DELIVERED").length;
  const incidentStops = deliveries.filter((d) => d.incidents && d.incidents.length > 0).length;
  const failedStops = deliveries.filter((d) => d.status === "FAILED" || d.status === "CANCELLED").length;
  const duration =
    route.startedAt && (route.completedAt || route.cancelledAt)
      ? Math.round(((new Date(route.completedAt ?? route.cancelledAt!)).getTime() - new Date(route.startedAt).getTime()) / 1000)
      : route.totalDurationS ?? null;
  return {
    totalStops,
    deliveredStops,
    incidentStops,
    failedStops,
    duration,
    progress: routeProgress(deliveredStops, totalStops),
  };
}
