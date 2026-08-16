import { businessDateInZone } from "@/lib/reservations";

export const ORDER_SLOT_INTERVAL_MINUTES = 30;
export const ORDER_MINIMUM_LEAD_MINUTES = 30;

export type OrderOpeningHourInput = {
  dayOfWeek: string;
  morningStartTime: string | null;
  morningEndTime: string | null;
  eveningStartTime: string | null;
  eveningEndTime: string | null;
};

export type OrderScheduleSlot = {
  value: string;
  date: string;
  time: string;
};

const dayAliases = [
  ["domingo", "sunday"],
  ["lunes", "monday"],
  ["martes", "tuesday"],
  ["miercoles", "wednesday"],
  ["jueves", "thursday"],
  ["viernes", "friday"],
  ["sabado", "saturday"],
] as const;

/** @summary Normaliza etiquetas de día para aceptar nombres completos, acentos y configuraciones heredadas. */
function normalized(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("es");
}

/** @summary Desplaza una fecha calendario sin depender del huso horario del proceso. */
export function addOrderDate(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** @summary Convierte un horario serializado por Prisma a HH:mm. */
export function orderTimeText(value: Date | string | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) {
    return `${String(value.getUTCHours()).padStart(2, "0")}:${String(value.getUTCMinutes()).padStart(2, "0")}`;
  }
  const match = value.match(/T(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : /^\d{2}:\d{2}/.test(value) ? value.slice(0, 5) : null;
}

/** @summary Obtiene las partes locales de un instante dentro de una zona IANA. */
function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

/** @summary Convierte una fecha/hora local del negocio a un instante real, incluyendo cambios DST. */
export function orderLocalDateTime(date: string, time: string, timeZone: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const targetUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  let candidate = new Date(targetUtc);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const local = zonedParts(candidate, timeZone);
    const representedAsUtc = Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      local.hour,
      local.minute,
      local.second,
    );
    const next = new Date(candidate.getTime() + (targetUtc - representedAsUtc));
    if (Math.abs(next.getTime() - candidate.getTime()) < 1_000) return next;
    candidate = next;
  }
  return candidate;
}

/**
 * @summary Indica si una regla horaria corresponde al día solicitado.
 */
function dayMatches(dayOfWeek: string, date: string) {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const label = normalized(dayOfWeek);
  return dayAliases[weekday].some((alias) => label.includes(alias));
}

/**
 * @summary Convierte una hora textual a minutos desde medianoche.
 */
function minutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

/**
 * @summary Construye una fecha local para una hora determinada.
 */
function timeAt(totalMinutes: number) {
  const value = ((totalMinutes % 1_440) + 1_440) % 1_440;
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

/**
 * @summary Convierte horarios de apertura en intervalos operativos.
 */
function ranges(opening: OrderOpeningHourInput) {
  const values: Array<[string | null, string | null]> = [
    [opening.morningStartTime, opening.morningEndTime],
    [opening.eveningStartTime, opening.eveningEndTime],
  ];
  return values.filter((range): range is [string, string] => Boolean(range[0] && range[1]));
}

/** @summary Construye solamente franjas futuras que pertenecen a horarios configurados del negocio. */
export function availableOrderSlots({
  hours,
  timeZone,
  now = new Date(),
  leadMinutes = ORDER_MINIMUM_LEAD_MINUTES,
  days = 30,
}: {
  hours: OrderOpeningHourInput[];
  timeZone: string;
  now?: Date;
  leadMinutes?: number;
  days?: number;
}) {
  const today = businessDateInZone(timeZone, now);
  const lastDate = addOrderDate(today, days);
  const cutoff = now.getTime() + Math.max(0, leadMinutes) * 60_000;
  const slots = new Map<string, OrderScheduleSlot>();

  // El día anterior permite incluir correctamente el tramo posterior a medianoche.
  for (let dayOffset = -1; dayOffset <= days; dayOffset += 1) {
    const businessDate = addOrderDate(today, dayOffset);
    for (const opening of hours.filter((entry) => dayMatches(entry.dayOfWeek, businessDate))) {
      for (const [startText, endText] of ranges(opening)) {
        const start = minutes(startText);
        let end = minutes(endText);
        if (end <= start) end += 1_440;
        const firstSlot = Math.ceil(start / ORDER_SLOT_INTERVAL_MINUTES) * ORDER_SLOT_INTERVAL_MINUTES;
        for (let minute = firstSlot; minute < end; minute += ORDER_SLOT_INTERVAL_MINUTES) {
          const calendarDate = addOrderDate(businessDate, Math.floor(minute / 1_440));
          if (calendarDate < today || calendarDate > lastDate) continue;
          const time = timeAt(minute);
          const instant = orderLocalDateTime(calendarDate, time, timeZone);
          if (instant.getTime() < cutoff) continue;
          const value = instant.toISOString();
          slots.set(value, { value, date: calendarDate, time });
        }
      }
    }
  }

  return [...slots.values()].sort((left, right) => left.value.localeCompare(right.value));
}

/** @summary Comprueba que un instante enviado por el navegador corresponda a una franja calculada. */
export function isAvailableOrderSlot(requestedAt: Date, slots: OrderScheduleSlot[]) {
  return slots.some((slot) => Math.abs(new Date(slot.value).getTime() - requestedAt.getTime()) < 60_000);
}
