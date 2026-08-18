/** @summary Formatea un importe con la moneda indicada. */
export function money(value: number | null | undefined, currency: string) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

/** @summary Formatea una fecha ISO a formato legible en español. */
export function dateLabel(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

/** @summary Formatea un porcentaje a partir de un valor y su total. */
export function percent(value: number, total: number) {
  if (!total || total === 0) return "—";
  const pct = (value / total) * 100;
  return `${pct.toFixed(1)}%`;
}

/** @summary Formatea la variación porcentual entre el valor actual y el anterior. */
export function variation(current: number, previous: number) {
  if (!previous || previous === 0) return current > 0 ? "Nuevo" : "—";
  const var_ = ((current - previous) / Math.abs(previous)) * 100;
  const sign = var_ >= 0 ? "+" : "";
  return `${sign}${var_.toFixed(1)}%`;
}
