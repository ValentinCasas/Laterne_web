import { prisma } from "@/lib/prisma";
import { uniquePromotionSlug } from "@/lib/slug";

const promotionTypes = new Set([
  "percentage",
  "special_price",
  "two_for_one",
  "happy_hour",
  "combo",
  "day",
  "time",
  "coupon",
  "birthday",
]);
const publicationStatuses = new Set(["published", "draft", "scheduled", "hidden", "archived"]);
const validDays = new Set(["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]);

/** @summary Convierte una lista separada por comas en identificadores enteros únicos. */
function relationIds(value: string) {
  return [
    ...new Set(
      value
        .split(",")
        .map(Number)
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  ];
}

/** @summary Convierte una fecha opcional de formulario y rechaza valores imposibles. */
function optionalDate(value: string) {
  if (!value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Revisá las fechas de la promoción");
  return date;
}

/** @summary Convierte un horario opcional al tipo temporal utilizado por MySQL. */
function optionalTime(value: string) {
  if (!value.trim()) return null;
  if (!/^\d{2}:\d{2}$/.test(value)) throw new Error("Revisá los horarios de la promoción");
  return new Date(`1970-01-01T${value}:00Z`);
}

/** @summary Valida relaciones, vigencia y contenido de una promoción antes de persistirla. */
export async function promotionData(input: Record<string, string>, tenantId: number, excludeId?: number) {
  const name = input.name.trim();
  const description = input.description.trim();
  if (!name || !description) throw new Error("Completá el nombre y la descripción");
  const type = promotionTypes.has(input.type) ? input.type : "percentage";
  const status = publicationStatuses.has(input.status) ? input.status : "draft";
  const productIds = relationIds(input.productIds ?? "");
  const categoryIds = relationIds(input.categoryIds ?? "");
  const [validProducts, validCategories] = await Promise.all([
    prisma.product.count({ where: { tenantId, id: { in: productIds } } }),
    prisma.category.count({ where: { tenantId, id: { in: categoryIds } } }),
  ]);
  if (validProducts !== productIds.length || validCategories !== categoryIds.length) {
    throw new Error("Una de las relaciones seleccionadas no pertenece a este negocio");
  }

  const startAt = optionalDate(input.startAt ?? "");
  const endAt = optionalDate(input.endAt ?? "");
  if (startAt && endAt && startAt >= endAt) throw new Error("La finalización debe ser posterior al comienzo");
  const daysOfWeek = [
    ...new Set(
      (input.daysOfWeek ?? "")
        .split(",")
        .map((day) => day.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  if (daysOfWeek.some((day) => !validDays.has(day))) {
    throw new Error("Usá nombres de días completos separados por comas");
  }

  const imageUrl = input.imageUrl?.trim() || null;
  if (imageUrl && !/^[a-zA-Z0-9._-]+$/.test(imageUrl)) throw new Error("La imagen seleccionada no es válida");
  const discountValue = input.discountValue ? Number(input.discountValue) : null;
  if (discountValue !== null && (!Number.isFinite(discountValue) || discountValue < 0)) {
    throw new Error("El valor del beneficio no es válido");
  }

  return {
    tenantId,
    name,
    slug: await uniquePromotionSlug(tenantId, input.slug || name, excludeId),
    description,
    imageUrl,
    type,
    discountValue,
    buyQuantity: input.buyQuantity ? Math.max(1, Number(input.buyQuantity)) : null,
    receiveQuantity: input.receiveQuantity ? Math.max(1, Number(input.receiveQuantity)) : null,
    startAt,
    endAt,
    publishAt: optionalDate(input.publishAt ?? ""),
    startTime: optionalTime(input.startTime ?? ""),
    endTime: optionalTime(input.endTime ?? ""),
    daysOfWeek,
    conditions: input.conditions?.trim() || null,
    code: input.code?.trim().toUpperCase().slice(0, 80) || null,
    status,
    priority: Math.max(0, Number(input.priority || 0)),
    products: { create: productIds.map((productId) => ({ tenantId, productId })) },
    categories: { create: categoryIds.map((categoryId) => ({ tenantId, categoryId })) },
  };
}
