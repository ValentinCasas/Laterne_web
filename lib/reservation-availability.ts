import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { addOrderDate, orderLocalDateTime, orderTimeText } from "@/lib/order-scheduling";
import { businessDateInZone } from "@/lib/reservations";

export const RESERVATION_SLOT_INTERVAL_MINUTES = 30;

export type ReservationSlotStatus = "available" | "pending" | "full";

export type ReservationAvailabilitySlot = {
  time: string;
  remaining: number;
  pending: number;
  status: ReservationSlotStatus;
};

type AvailabilityOpening = {
  dayOfWeek: string;
  morningStartTime: string | null;
  morningEndTime: string | null;
  eveningStartTime: string | null;
  eveningEndTime: string | null;
};

type AvailabilityBlock = {
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
};

type AvailabilityReservation = {
  date: string;
  time: string;
  partySize: number;
  status: string;
  sector?: string | null;
};

export type ReservationAvailabilitySettings = {
  enabled: boolean;
  capacityPerSlot: number;
  minimumLeadMinutes: number;
  maximumAdvanceDays: number;
  maximumPartySize: number;
  sectors: string[];
  policy: string | null;
  confirmationMode: string;
  defaultDuration: number;
};

export type ReservationAvailability = {
  date: string;
  slots: ReservationAvailabilitySlot[];
  hasAvailability: boolean;
  settings: ReservationAvailabilitySettings;
};

type CalculateAvailabilityInput = {
  date: string;
  partySize: number;
  sector?: string | null;
  timeZone: string;
  now: Date;
  settings: ReservationAvailabilitySettings;
  openings: AvailabilityOpening[];
  blocks: AvailabilityBlock[];
  reservations: AvailabilityReservation[];
};

type ReservationDatabase = Pick<
  Prisma.TransactionClient,
  "reservationSettings" | "openingHour" | "reservationBlock" | "reservation"
>;

const weekdayAliases = [
  ["domingo", "sunday"],
  ["lunes", "monday"],
  ["martes", "tuesday"],
  ["miercoles", "wednesday"],
  ["jueves", "thursday"],
  ["viernes", "friday"],
  ["sabado", "saturday"],
] as const;

/**
 * @summary Normaliza fechas y horas recibidas por el cálculo de disponibilidad.
 */
function normalized(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("es");
}

/**
 * @summary Indica si un horario de apertura aplica a una fecha.
 */
function openingMatchesDate(dayOfWeek: string, date: string) {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const label = normalized(dayOfWeek);
  return weekdayAliases[weekday].some((alias) => label.includes(alias));
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
function timeAt(value: number) {
  const normalizedMinutes = ((value % 1_440) + 1_440) % 1_440;
  return `${String(Math.floor(normalizedMinutes / 60)).padStart(2, "0")}:${String(normalizedMinutes % 60).padStart(2, "0")}`;
}

/**
 * @summary Construye una fecha local combinando día y horario.
 */
function dateValue(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

/**
 * @summary Convierte horarios de apertura en rangos reservables.
 */
function openingRanges(opening: AvailabilityOpening) {
  return [
    [opening.morningStartTime, opening.morningEndTime],
    [opening.eveningStartTime, opening.eveningEndTime],
  ].filter((range): range is [string, string] => Boolean(range[0] && range[1]));
}

/**
 * @summary Indica si una franja está alcanzada por un bloqueo de reservas.
 */
function blockedAt(date: string, time: string, blocks: AvailabilityBlock[]) {
  return blocks.some((block) => {
    if (date < block.startDate || date > block.endDate) return false;
    if (!block.startTime || !block.endTime) return true;
    const value = minutes(time);
    const start = minutes(block.startTime);
    const end = minutes(block.endTime);
    return end >= start ? value >= start && value <= end : value >= start || value <= end;
  });
}

/**
 * @summary Devuelve una configuración de reservas segura cuando aún no existe.
 */
function emptySettings(): ReservationAvailabilitySettings {
  return {
    enabled: true,
    capacityPerSlot: 30,
    minimumLeadMinutes: 120,
    maximumAdvanceDays: 60,
    maximumPartySize: 20,
    sectors: ["Salón", "Exterior"],
    policy: "La reserva queda sujeta a confirmación del negocio.",
    confirmationMode: "manual",
    defaultDuration: 120,
  };
}

/** @summary Calcula una fecha usando solo horarios, bloqueos y ocupación ya cargados. */
export function calculateReservationAvailability({
  date,
  partySize,
  timeZone,
  now,
  settings,
  openings,
  blocks,
  reservations,
}: CalculateAvailabilityInput): ReservationAvailability {
  const today = businessDateInZone(timeZone, now);
  const lastDate = addOrderDate(today, settings.maximumAdvanceDays);
  if (!settings.enabled || date < today || date > lastDate) {
    return { date, slots: [], hasAvailability: false, settings };
  }

  const requestedPartySize = Math.max(1, Math.min(Math.trunc(partySize), settings.maximumPartySize));
  const cutoff = now.getTime() + Math.max(0, settings.minimumLeadMinutes) * 60_000;
  const candidateTimes = new Set<string>();

  // También se mira el día comercial anterior para aperturas que cruzan medianoche.
  for (const businessDate of [addOrderDate(date, -1), date]) {
    for (const opening of openings.filter((entry) => openingMatchesDate(entry.dayOfWeek, businessDate))) {
      for (const [startText, endText] of openingRanges(opening)) {
        const start = minutes(startText);
        let end = minutes(endText);
        if (end <= start) end += 1_440;
        const first =
          Math.ceil(start / RESERVATION_SLOT_INTERVAL_MINUTES) * RESERVATION_SLOT_INTERVAL_MINUTES;
        for (let value = first; value < end; value += RESERVATION_SLOT_INTERVAL_MINUTES) {
          const calendarDate = addOrderDate(businessDate, Math.floor(value / 1_440));
          if (calendarDate !== date) continue;
          const time = timeAt(value);
          const instant = orderLocalDateTime(calendarDate, time, timeZone);
          if (instant.getTime() < cutoff || blockedAt(calendarDate, time, blocks)) continue;
          candidateTimes.add(time);
        }
      }
    }
  }

  const occupied = new Map<string, number>();
  const pending = new Map<string, number>();
  for (const reservation of reservations) {
    if (reservation.date !== date || !["pending", "confirmed"].includes(reservation.status)) continue;
    occupied.set(reservation.time, (occupied.get(reservation.time) ?? 0) + reservation.partySize);
    if (reservation.status === "pending") {
      pending.set(reservation.time, (pending.get(reservation.time) ?? 0) + reservation.partySize);
    }
  }

  const slots = [...candidateTimes].sort().map((time): ReservationAvailabilitySlot => {
    const remaining = Math.max(0, settings.capacityPerSlot - (occupied.get(time) ?? 0));
    const pendingPeople = pending.get(time) ?? 0;
    return {
      time,
      remaining,
      pending: pendingPeople,
      status: remaining < requestedPartySize ? "full" : pendingPeople > 0 ? "pending" : "available",
    };
  });

  return {
    date,
    slots,
    hasAvailability: slots.some((slot) => slot.status !== "full"),
    settings,
  };
}

/**
 * @summary Carga en paralelo la configuración y ocupación necesarias para calcular disponibilidad.
 */
async function loadAvailabilityData({
  tenantId,
  branchId,
  from,
  to,
  excludeReservationId,
  database,
}: {
  tenantId: number;
  branchId: number;
  from: string;
  to: string;
  excludeReservationId?: number;
  database: ReservationDatabase;
}) {
  const [rawSettings, rawOpenings, rawBlocks, rawReservations] = await Promise.all([
    database.reservationSettings.findUnique({ where: { tenantId } }),
    database.openingHour.findMany({ where: { tenantId, branchId } }),
    database.reservationBlock.findMany({
      where: {
        tenantId,
        branchId,
        startDate: { lte: dateValue(to) },
        endDate: { gte: dateValue(from) },
      },
    }),
    database.reservation.findMany({
      where: {
        tenantId,
        branchId,
        ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
        deletedAt: null,
        reservationDate: { gte: dateValue(from), lte: dateValue(to) },
        status: { in: ["pending", "confirmed"] },
      },
      select: {
        reservationDate: true,
        reservationTime: true,
        partySize: true,
        status: true,
        sector: true,
      },
    }),
  ]);

  const settings: ReservationAvailabilitySettings = rawSettings
    ? {
        enabled: rawSettings.enabled,
        capacityPerSlot: rawSettings.capacityPerSlot,
        minimumLeadMinutes: rawSettings.minimumLeadMinutes,
        maximumAdvanceDays: rawSettings.maximumAdvanceDays,
        maximumPartySize: rawSettings.maximumPartySize,
        sectors: Array.isArray(rawSettings.sectors)
          ? rawSettings.sectors.filter((sector): sector is string => typeof sector === "string")
          : [],
        policy: rawSettings.policy,
        confirmationMode: rawSettings.confirmationMode,
        defaultDuration: rawSettings.defaultDuration,
      }
    : emptySettings();

  const openings: AvailabilityOpening[] = rawOpenings.map((opening) => ({
    dayOfWeek: opening.dayOfWeek,
    morningStartTime: orderTimeText(opening.morningStartTime),
    morningEndTime: orderTimeText(opening.morningEndTime),
    eveningStartTime: orderTimeText(opening.eveningStartTime),
    eveningEndTime: orderTimeText(opening.eveningEndTime),
  }));
  const blocks: AvailabilityBlock[] = rawBlocks.map((block) => ({
    startDate: block.startDate.toISOString().slice(0, 10),
    endDate: block.endDate.toISOString().slice(0, 10),
    startTime: orderTimeText(block.startTime),
    endTime: orderTimeText(block.endTime),
  }));
  const reservations: AvailabilityReservation[] = rawReservations.map((reservation) => ({
    date: reservation.reservationDate.toISOString().slice(0, 10),
    time: orderTimeText(reservation.reservationTime) ?? "00:00",
    partySize: reservation.partySize,
    status: reservation.status,
    sector: reservation.sector,
  }));
  return { settings, openings, blocks, reservations };
}

/** @summary Fuente única del servidor para calendario, formulario público y validación final. */
export async function getReservationAvailability({
  tenantId,
  branchId,
  date,
  partySize,
  sector,
  timeZone,
  now = new Date(),
  database = prisma,
  excludeReservationId,
}: {
  tenantId: number;
  branchId: number;
  date: string;
  partySize: number;
  sector?: string | null;
  timeZone: string;
  now?: Date;
  database?: ReservationDatabase;
  excludeReservationId?: number;
}) {
  const data = await loadAvailabilityData({
    tenantId,
    branchId,
    from: date,
    to: date,
    excludeReservationId,
    database,
  });
  return calculateReservationAvailability({ date, partySize, sector, timeZone, now, ...data });
}

/** @summary Resuelve los días seleccionables de un rango sin ejecutar una consulta por cada fecha. */
export async function getReservationAvailabilityRange({
  tenantId,
  branchId,
  from,
  to,
  partySize,
  sector,
  timeZone,
  now = new Date(),
  database = prisma,
  excludeReservationId,
}: {
  tenantId: number;
  branchId: number;
  from: string;
  to: string;
  partySize: number;
  sector?: string | null;
  timeZone: string;
  now?: Date;
  database?: ReservationDatabase;
  excludeReservationId?: number;
}) {
  const data = await loadAvailabilityData({ tenantId, branchId, from, to, excludeReservationId, database });
  const days: ReservationAvailability[] = [];
  for (let date = from; date <= to; date = addOrderDate(date, 1)) {
    days.push(calculateReservationAvailability({ date, partySize, sector, timeZone, now, ...data }));
  }
  return {
    availableDates: days.filter((day) => day.hasAvailability).map((day) => day.date),
    days,
    settings: data.settings,
  };
}

/**
 * @summary Normaliza una fecha de reserva para persistencia y comparación.
 */
export function reservationDateValue(date: string) {
  return dateValue(date);
}
