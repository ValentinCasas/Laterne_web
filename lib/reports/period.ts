import type { Period } from "./index";

/** @summary Devuelve el inicio del día en UTC para rangos consistentes. */
export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

/** @summary Devuelve el fin del día en UTC para rangos inclusivos. */
export function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setUTCHours(23, 59, 59, 999);
  return result;
}

/** @summary Resuelve un período desde query params con default de 30 días. */
export function resolvePeriod(params: { from?: string; to?: string }): Period {
  const to = params.to ? new Date(params.to) : new Date();
  const from = params.from ? new Date(params.from) : (() => {
    const fallback = new Date(to);
    fallback.setUTCDate(fallback.getUTCDate() - 30);
    return fallback;
  })();
  return { from: startOfDay(from), to: endOfDay(to) };
}

/** @summary Calcula el período anterior equivalente para comparaciones. */
export function previousPeriod(from: Date, to: Date): Period {
  const duration = to.getTime() - from.getTime();
  return { from: new Date(from.getTime() - duration), to: new Date(from.getTime()) };
}

/** @summary Duración en días del período. */
export function periodDays(from: Date, to: Date): number {
  return Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000));
}

/** @summary Granularidad sugerida según la duración del período. */
export function periodGranularity(from: Date, to: Date): "hour" | "day" | "week" | "month" {
  const days = periodDays(from, to);
  if (days < 3) return "hour";
  if (days <= 30) return "day";
  if (days <= 90) return "week";
  return "month";
}
