/**
 * Helpers compartidos para componentes administrativos.
 *
 * Centraliza funciones de formato que estaban duplicadas en múltiples
 * componentes del panel admin.
 */

/** @summary Formatea un importe con la moneda indicada y fallback para valores inválidos. */
export function money(
  value: string | number | null | undefined,
  currency: string,
  fallback = "—",
): string {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(number);
}

/** @summary Formatea una fecha ISO para mostrar en la interfaz. */
export function dateLabel(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** @summary Formatea un importe con la moneda del documento (alias de money para compatibilidad). */
export function formatMoney(value: number | string, currency: string): string {
  return money(value, currency);
}

/** @summary Formatea un importe para el tablero de pedidos sin fallback. */
export function formatPrice(value: string | number, currency: string): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
  }).format(Number(value));
}

/** @summary Muestra el tiempo transcurrido desde un momento en lenguaje operativo. */
export function elapsedLabel(createdAt: string | number | Date): string {
  const elapsedMinutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000),
  );
  if (elapsedMinutes < 1) return "recién recibido";
  if (elapsedMinutes < 60) return `hace ${elapsedMinutes} min`;
  const hours = Math.floor(elapsedMinutes / 60);
  const minutes = elapsedMinutes % 60;
  return minutes ? `hace ${hours} h ${minutes} min` : `hace ${hours} h`;
}

/** @summary Convierte el JSON de agregados de una línea en texto legible. */
export function extrasText(value: unknown): string {
  if (!Array.isArray(value) || !value.length) return "";
  return value
    .map((extra) =>
      typeof extra === "object" && extra && typeof (extra as { name?: unknown }).name === "string"
        ? (extra as { name: string }).name
        : "",
    )
    .filter(Boolean)
    .join(" · ");
}
