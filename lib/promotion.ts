type PublicPromotionTiming = {
  startAt: Date | null;
  endAt: Date | null;
  startTime: Date | null;
  endTime: Date | null;
  daysOfWeek: unknown;
};

/** @summary Determina si una promoción se encuentra vigente para la fecha y el horario actuales. */
export function isPromotionActive(promotion: PublicPromotionTiming, now = new Date()) {
  if (promotion.startAt && now < promotion.startAt) return false;
  if (promotion.endAt && now > promotion.endAt) return false;

  const currentDay = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    weekday: "long",
  })
    .format(now)
    .toLocaleLowerCase("es");
  const applicableDays = Array.isArray(promotion.daysOfWeek)
    ? promotion.daysOfWeek.filter((day): day is string => typeof day === "string")
    : [];
  if (applicableDays.length && !applicableDays.includes(currentDay)) return false;

  const currentTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
  /** @summary Convierte una hora persistida en minutos para comparar franjas de promoción. */
  const timeValue = (value: Date) =>
    `${String(value.getUTCHours()).padStart(2, "0")}:${String(value.getUTCMinutes()).padStart(2, "0")}`;
  if (promotion.startTime && currentTime < timeValue(promotion.startTime)) return false;
  if (promotion.endTime && currentTime > timeValue(promotion.endTime)) return false;
  return true;
}

/** @summary Traduce el tipo interno de promoción a una etiqueta clara para el visitante. */
export function promotionTypeLabel(type: string) {
  const labels: Record<string, string> = {
    percentage: "Descuento",
    special_price: "Precio especial",
    two_for_one: "2 × 1",
    happy_hour: "Happy hour",
    combo: "Combo",
    day: "Beneficio del día",
    time: "Beneficio por horario",
    coupon: "Cupón",
    birthday: "Cumpleaños",
  };
  return labels[type] ?? "Promoción";
}

/** @summary Construye el beneficio principal que se destaca en una promoción pública. */
export function promotionBenefit(
  type: string,
  value: number | null,
  buy: number | null,
  receive: number | null,
) {
  if (type === "percentage" && value !== null) return `${value}% OFF`;
  if (type === "special_price" && value !== null)
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(value);
  if ((type === "two_for_one" || buy || receive) && buy && receive) return `${buy} × ${receive}`;
  return promotionTypeLabel(type);
}
