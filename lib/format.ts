/** @summary Convierte valores de Prisma (Decimal, Date, BigInt) en datos serializables para Client Components. */
export function serialize<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, item) => {
      if (typeof item === "bigint") return item.toString();
      if (item && typeof item === "object" && typeof item.toJSON === "function" && !(item instanceof Date)) return item.toJSON();
      return item;
    }),
  );
}

/** @summary Formatea un valor numérico con la moneda y región solicitadas. */
export function money(value: unknown, currency = "ARS", locale = "es-AR") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

/** @summary Convierte una fecha de horario en una cadena breve con horas y minutos. */
export function time(value: Date | null) {
  return value ? value.toISOString().slice(11, 16) : "—";
}
