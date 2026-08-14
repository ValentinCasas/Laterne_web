export const reservationStatuses = [
  "pending",
  "confirmed",
  "rejected",
  "cancelled",
  "completed",
  "no_show",
] as const;

export type ReservationStatus = (typeof reservationStatuses)[number];

/** @summary Traduce un estado interno de reserva a una etiqueta comprensible. */
export function reservationStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: "Pendiente",
    confirmed: "Confirmada",
    rejected: "Rechazada",
    cancelled: "Cancelada",
    completed: "Finalizada",
    no_show: "Ausente",
  };
  return labels[status] ?? status;
}

/** @summary Convierte un horario HH:mm al valor temporal compatible con Prisma y MySQL. */
export function reservationTime(value: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error("Seleccioná un horario válido");
  return new Date(`1970-01-01T${value}:00Z`);
}

/** @summary Devuelve la representación HH:mm de un valor temporal almacenado en la base. */
export function timeText(value: Date) {
  return `${String(value.getUTCHours()).padStart(2, "0")}:${String(value.getUTCMinutes()).padStart(2, "0")}`;
}

export const defaultReservationTimeZone = "America/Argentina/Buenos_Aires";

/** @summary Devuelve el desfase ±HH:mm vigente de una zona IANA en un instante determinado. */
export function zoneOffset(timeZone: string, date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
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
  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );
  const minutes = Math.round((asUtc - date.getTime()) / 60_000);
  const sign = minutes < 0 ? "-" : "+";
  const absolute = Math.abs(minutes);
  return `${sign}${String(Math.floor(absolute / 60)).padStart(2, "0")}:${String(absolute % 60).padStart(2, "0")}`;
}

/** @summary Devuelve la fecha actual (AAAA-MM-DD) en la zona horaria del negocio. */
export function businessDateInZone(timeZone: string, date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** @summary Construye franjas regulares entre una apertura y un cierre determinados. */
export function buildTimeSlots(start: string, end: string, interval: number) {
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  const startTotal = startHour * 60 + startMinute;
  let endTotal = endHour * 60 + endMinute;
  if (endTotal <= startTotal) endTotal += 24 * 60;
  const slots: string[] = [];

  for (let minute = startTotal; minute < endTotal; minute += interval) {
    const normalized = minute % (24 * 60);
    slots.push(
      `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`,
    );
  }
  return slots;
}
