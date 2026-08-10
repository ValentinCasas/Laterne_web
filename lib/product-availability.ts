/** @summary Comprueba días y franja horaria en la zona del negocio, incluso cuando cruzan medianoche. */
export function productAvailableAt(
  days: unknown,
  start: Date | null,
  end: Date | null,
  now = new Date(),
  timeZone = "America/Argentina/Buenos_Aires",
) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const weekDays: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const currentDay = weekDays[values.weekday] ?? now.getDay();
  if (Array.isArray(days) && days.length > 0 && !days.map(Number).includes(currentDay)) return false;
  if (!start || !end) return true;
  const currentMinutes = Number(values.hour) * 60 + Number(values.minute);
  const startMinutes = start.getUTCHours() * 60 + start.getUTCMinutes();
  const endMinutes = end.getUTCHours() * 60 + end.getUTCMinutes();
  return startMinutes <= endMinutes
    ? currentMinutes >= startMinutes && currentMinutes <= endMinutes
    : currentMinutes >= startMinutes || currentMinutes <= endMinutes;
}
