const DEFAULT_TIME_ZONE = "America/Argentina/Buenos_Aires";

type PromotionTiming = {
  startAt: Date | null;
  endAt: Date | null;
  startTime: Date | null;
  endTime: Date | null;
  daysOfWeek: unknown;
};

type PromotionActivable = PromotionTiming & {
  status?: string;
  publishAt?: Date | null;
};

/** @summary Promoción candidata para el motor de descuentos, con sus relaciones y reglas. */
export type PromotionCandidate = PromotionActivable & {
  id: number;
  name: string;
  type: string;
  discountValue: number | null;
  minimumPurchase: number | null;
  buyQuantity: number | null;
  receiveQuantity: number | null;
  code: string | null;
  priority: number;
  productIds: number[];
  categoryIds: number[];
};

/** @summary Línea del carrito normalizada para evaluar descuentos y alcance por producto. */
export type PromotionItem = {
  productId: number;
  categoryIds: number[];
  unitPrice: number;
  perUnit: number;
  linePrice: number;
  quantity: number;
};

const implementedTypes = new Set([
  "percentage",
  "fixed_amount",
  "special_price",
  "two_for_one",
  "happy_hour",
  "day",
  "time",
  "coupon",
]);

const dayIndexByEnglishName: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};
const dayIndexBySpanishName: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};

/** @summary Normaliza un día de la semana eliminando mayúsculas y tildes para compararlo. */
function normalizeDayName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** @summary Convierte los días configurados (JSON) en índices numéricos de domingo a sábado. */
export function storedDaysToNumbers(daysOfWeek: unknown): number[] {
  if (!Array.isArray(daysOfWeek)) return [];
  const numbers = new Set<number>();
  for (const day of daysOfWeek) {
    if (typeof day !== "string") continue;
    const key = normalizeDayName(day);
    const index = dayIndexBySpanishName[key] ?? dayIndexByEnglishName[key];
    if (index !== undefined) numbers.add(index);
  }
  return [...numbers];
}

/** @summary Obtiene el índice del día actual dentro del huso horario del local. */
function currentDayIndex(timeZone: string, now: Date) {
  const name = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long" }).format(now);
  return dayIndexByEnglishName[name.toLowerCase()] ?? -1;
}

/** @summary Convierte la hora local actual en minutos desde la medianoche del local. */
function currentMinutes(timeZone: string, now: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

/** @summary Convierte un horario persistido (tipo Time de MySQL) en minutos desde la medianoche. */
function timeToMinutes(value: Date | null) {
  if (!value) return null;
  return value.getUTCHours() * 60 + value.getUTCMinutes();
}

/** @summary Determina si una promoción se encuentra vigente para la fecha y el horario actuales. */
export function isPromotionActive(
  promotion: PromotionActivable,
  now = new Date(),
  timeZone = DEFAULT_TIME_ZONE,
) {
  const status = promotion.status;
  if (status === "draft" || status === "hidden" || status === "archived") return false;
  if (status === "scheduled" && (!promotion.publishAt || promotion.publishAt > now)) return false;
  if (promotion.startAt && now < promotion.startAt) return false;
  if (promotion.endAt && now > promotion.endAt) return false;

  const days = storedDaysToNumbers(promotion.daysOfWeek);
  if (days.length > 0 && !days.includes(currentDayIndex(timeZone, now))) return false;

  const start = timeToMinutes(promotion.startTime);
  const end = timeToMinutes(promotion.endTime);
  const current = currentMinutes(timeZone, now);
  if (start !== null && end !== null) {
    const inside = start <= end ? current >= start && current <= end : current >= start || current <= end;
    if (!inside) return false;
  } else if (start !== null && current < start) {
    return false;
  } else if (end !== null && current > end) {
    return false;
  }
  return true;
}

/** @summary Indica si el tipo de promoción ya puede aplicarse automáticamente al pedido. */
export function isPromotionImplemented(type: string) {
  return implementedTypes.has(type);
}

/** @summary Traduce el tipo interno de promoción a una etiqueta clara para el visitante. */
export function promotionTypeLabel(type: string) {
  const labels: Record<string, string> = {
    percentage: "Descuento",
    fixed_amount: "Descuento fijo",
    special_price: "Precio especial",
    two_for_one: "Dos por uno",
    happy_hour: "Happy hour",
    combo: "Combo",
    day: "Por día",
    time: "Por horario",
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
  currency = "ARS",
) {
  if (
    (type === "percentage" ||
      type === "happy_hour" ||
      type === "day" ||
      type === "time" ||
      type === "coupon") &&
    value !== null
  ) {
    return `${value}% OFF`;
  }
  if ((type === "fixed_amount" || type === "special_price") && value !== null) {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  }
  if ((type === "two_for_one" || buy || receive) && buy && receive) return `${buy} × ${receive}`;
  return promotionTypeLabel(type);
}

/** @summary Indica si una línea del carrito participa del alcance de la promoción. */
function itemAffected(item: PromotionItem, candidate: PromotionCandidate) {
  return (
    candidate.productIds.includes(item.productId) ||
    item.categoryIds.some((categoryId) => candidate.categoryIds.includes(categoryId))
  );
}

/** @summary Calcula el descuento concreto que aplica una promoción a un carrito. */
export function promotionDiscount(
  candidate: PromotionCandidate,
  items: PromotionItem[],
  subtotal: number,
  now = new Date(),
  timeZone = DEFAULT_TIME_ZONE,
) {
  if (!isPromotionActive(candidate, now, timeZone)) return 0;
  if (!isPromotionImplemented(candidate.type)) return 0;
  if (
    candidate.minimumPurchase !== null &&
    candidate.minimumPurchase > 0 &&
    subtotal < candidate.minimumPurchase
  ) {
    return 0;
  }

  const scoped = candidate.productIds.length > 0 || candidate.categoryIds.length > 0;
  const affected = scoped ? items.filter((item) => itemAffected(item, candidate)) : items;
  const affectedSubtotal = affected.reduce((sum, item) => sum + item.linePrice, 0);
  if (affected.length === 0) return 0;
  const limit = (value: number) => Math.max(0, Math.min(subtotal, value));

  switch (candidate.type) {
    case "percentage":
    case "happy_hour":
    case "day":
    case "time":
    case "coupon":
      if (candidate.discountValue === null || candidate.discountValue <= 0) return 0;
      return limit(affectedSubtotal * (candidate.discountValue / 100));
    case "fixed_amount":
      if (candidate.discountValue === null || candidate.discountValue <= 0) return 0;
      return limit(Math.min(candidate.discountValue, affectedSubtotal));
    case "special_price": {
      if (candidate.discountValue === null || candidate.discountValue <= 0) return 0;
      let discount = 0;
      for (const item of affected) {
        const perUnit = item.unitPrice - candidate.discountValue;
        if (perUnit > 0) discount += perUnit * item.quantity;
      }
      return limit(discount);
    }
    case "two_for_one": {
      const buy = Math.max(1, candidate.buyQuantity ?? 1);
      const receive = Math.max(1, candidate.receiveQuantity ?? 1);
      const group = buy + receive;
      let discount = 0;
      for (const item of affected) {
        const freeUnits = Math.floor(item.quantity / group) * receive;
        if (freeUnits > 0) discount += freeUnits * item.perUnit;
      }
      return limit(discount);
    }
    default:
      return 0;
  }
}

/** @summary Describe la promoción aplicada a un pedido para mostrarla en el seguimiento. */
export function promotionResultLabel(candidate: PromotionCandidate, currency = "ARS") {
  const benefit = promotionBenefit(
    candidate.type,
    candidate.discountValue,
    candidate.buyQuantity,
    candidate.receiveQuantity,
    currency,
  );
  return `${candidate.name} · ${benefit}`;
}

/** @summary Elige la mejor promoción vigente para el carrito (código o automática) por prioridad. */
export function resolveOrderPromotion(
  candidates: PromotionCandidate[],
  items: PromotionItem[],
  subtotal: number,
  code: string | null | undefined,
  now = new Date(),
  timeZone = DEFAULT_TIME_ZONE,
  currency = "ARS",
) {
  const normalizedCode = code?.trim().toUpperCase() || null;
  const applicable: { candidate: PromotionCandidate; discount: number }[] = [];
  for (const candidate of candidates) {
    const candidateCode = candidate.code?.trim().toUpperCase() || null;
    const matchesCode = normalizedCode !== null && candidateCode !== null && candidateCode === normalizedCode;
    const isAutomatic = normalizedCode === null && candidateCode === null;
    if (!matchesCode && !isAutomatic) continue;
    const discount = promotionDiscount(candidate, items, subtotal, now, timeZone);
    if (discount > 0) applicable.push({ candidate, discount });
  }
  if (applicable.length === 0) {
    return { promotionId: null, promotionCode: null, promotionLabel: null, discount: 0 };
  }
  applicable.sort((a, b) => b.candidate.priority - a.candidate.priority || b.discount - a.discount);
  const best = applicable[0];
  return {
    promotionId: best.candidate.id,
    promotionCode: best.candidate.code?.trim().toUpperCase() || null,
    promotionLabel: promotionResultLabel(best.candidate, currency),
    discount: best.discount,
  };
}
