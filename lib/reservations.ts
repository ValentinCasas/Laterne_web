import { createHash, randomBytes } from "node:crypto";

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

/** @summary Genera una referencia breve que el cliente puede conservar para identificar su reserva. */
export function reservationReference(date = new Date()) {
  const day = date.toISOString().slice(2, 10).replaceAll("-", "");
  return `RES-${day}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

/** @summary Anonimiza una dirección de red para aplicar controles de abuso sin conservarla en claro. */
export function reservationAddressHash(address: string) {
  return createHash("sha256")
    .update(`${process.env.AUTH_SECRET ?? "development-only-change-me"}:reservation:${address}`)
    .digest("hex");
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
