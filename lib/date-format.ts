/**
 * Formateadores centralizados de fecha/hora deterministas.
 *
 * IMPORTANTE: `toLocaleTimeString` y `toLocaleString` de JavaScript producen
 * resultados DIFERENTES entre Node.js (server) y el navegador (client) debido
 * a diferencias en los datos de Intl entre motores V8/ICU del server y los
 * navegadores. Esto causa HYDRATION MISMATCHES.
 *
 * Estas funciones usan opciones EXPLÍCITAS y 24h (`hour12: false`) para
 * garantizar exactamente el mismo string en ambos entornos.
 *
 * Locale fijo: `es-AR`. Si el SaaS soporta otros países, se puede parametrizar.
 */

const LOCALE = "es-AR";

/* ── Time (hour:minute) ── */

/** @summary Hora HH:MM en formato 24h, determinista server/client. */
export function formatTime(value: string | number | Date): string {
  const date = toSafeDate(value);
  if (!date) return "—";
  try {
    return new Intl.DateTimeFormat(LOCALE, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  } catch {
    return fallbackTime(date);
  }
}

/* ── Date (day/month/year) ── */

/** @summary Fecha corta "dd/mm/yyyy", determinista server/client. */
export function formatDate(value: string | number | Date): string {
  const date = toSafeDate(value);
  if (!date) return "—";
  try {
    return new Intl.DateTimeFormat(LOCALE, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour12: false,
    }).format(date);
  } catch {
    return fallbackDate(date);
  }
}

/** @summary Fecha con mes abreviado "dd Mmm yyyy", determinista server/client. */
export function formatDateShort(value: string | number | Date): string {
  const date = toSafeDate(value);
  if (!date) return "—";
  try {
    return new Intl.DateTimeFormat(LOCALE, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour12: false,
    }).format(date);
  } catch {
    return fallbackDate(date);
  }
}

/** @summary Fecha con mes abreviado SIN año "dd Mmm", determinista server/client. */
export function formatDateMonthShort(value: string | number | Date): string {
  const date = toSafeDate(value);
  if (!date) return "—";
  try {
    return new Intl.DateTimeFormat(LOCALE, {
      day: "2-digit",
      month: "short",
      hour12: false,
    }).format(date);
  } catch {
    return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
  }
}

/* ── DateTime (dd/mm/yyyy HH:MM) ── */

/** @summary Fecha + hora "dd/mm/yyyy HH:MM", determinista server/client. */
export function formatDateTime(value: string | number | Date): string {
  const date = toSafeDate(value);
  if (!date) return "—";
  try {
    return new Intl.DateTimeFormat(LOCALE, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  } catch {
    return `${fallbackDate(date)} ${fallbackTime(date)}`;
  }
}

/** @summary Fecha + hora con mes abreviado, determinista server/client. */
export function formatDateTimeShort(value: string | number | Date): string {
  const date = toSafeDate(value);
  if (!date) return "—";
  try {
    return new Intl.DateTimeFormat(LOCALE, {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  } catch {
    return `${fallbackDate(date)} ${fallbackTime(date)}`;
  }
}

/* ── Relative time (deterministic) ── */

/** @summary Tiempo relativo "Hace X min / Hace Xh / Hace Xd". */
export function formatRelativeTime(value: string | number | Date): string {
  const date = toSafeDate(value);
  if (!date) return "";
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Ahora";
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours}h`;
  return `Hace ${Math.floor(hours / 24)}d`;
}

/* ── Helpers internos ── */

function toSafeDate(value: string | number | Date): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** @summary Fallback manual si Intl falla completamente. */
function fallbackTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** @summary Fallback manual si Intl falla completamente. */
function fallbackDate(date: Date): string {
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}
