import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { localModelUrl, modelOrientation, optionalMeasurement } from "@/lib/product-model";
import { uniqueProductSlug } from "@/lib/slug";

/**
 * Catálogo de productos: conceptos de operación simple al estilo Fudo.
 *
 * Un producto puede tener:
 * - Modificadores (variantes/extras): elecciones del cliente sobre el mismo producto.
 * - Combo: composición fija con otros productos vendibles (hamburguesa + papas + gaseosa).
 * - Receta: ingredientes con stock (productos reales con control de inventario).
 * - Listas de precio por canal: salón, mostrador, delivery y carta online.
 */

export const priceChannels = ["SALON", "MOSTRADOR", "DELIVERY", "ONLINE"] as const;
export type PriceChannel = (typeof priceChannels)[number];

export const priceChannelLabel: Record<PriceChannel, string> = {
  SALON: "Salón",
  MOSTRADOR: "Mostrador",
  DELIVERY: "Delivery",
  ONLINE: "Carta online",
};

export const productAvailabilityValues = ["disponible", "agotado"] as const;
export type ProductAvailability = (typeof productAvailabilityValues)[number];

export const productAvailabilityLabel: Record<ProductAvailability, string> = {
  disponible: "Disponible",
  agotado: "Agotado",
};

/** @summary Porcentaje de margen sobre el precio de venta (null si faltan datos válidos). */
export function marginPercent(cost: number | null | undefined, price: number | null | undefined) {
  if (cost == null || price == null || cost <= 0 || price <= 0) return null;
  return Math.round(((price - cost) / price) * 1000) / 10;
}

/** @summary Porcentaje de markup sobre el costo (null si faltan datos válidos). */
export function markupPercent(cost: number | null | undefined, price: number | null | undefined) {
  if (cost == null || price == null || cost <= 0) return null;
  return Math.round(((price - cost) / cost) * 1000) / 10;
}

/** @summary Normaliza un valor decimal de formulario a número o null. */
export function decimalOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/** @summary Normaliza un horario (HH:mm) a un valor de tiempo aislado para el modelo. */
export function timeOrNull(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const match = value.trim().match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  return new Date(`1970-01-01T${match[1]}:${match[2]}:00Z`);
}

/** @summary Convierte cualquier representación de formulario en booleano. */
function booleanValue(value: unknown): boolean {
  return value === true || value === "true" || value === "1" || value === "on";
}

/** @summary Convierte un valor en número con límites opcionales (null si está vacío). */
function numberOrNull(value: unknown, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) {
    throw new Error(`El valor debe estar entre ${minimum} y ${maximum}`);
  }
  return number;
}

/** @summary Convierte una cadena horaria HH:mm en una hora aislada, o null. */
function timeValue(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const match = value.trim().match(/^(\d{2}):(\d{2})$/);
  if (!match) throw new Error("El horario debe tener el formato HH:mm");
  return new Date(`1970-01-01T${match[1]}:${match[2]}:00Z`);
}

/** @summary Convierte una fecha ISO (date o datetime-local) en Date o null. */
function dateValue(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(parsed.getTime())) throw new Error("Fecha inválida");
  return parsed;
}

/** @summary Convierte un arreglo de días de la semana en Json (DbNull = todos los días). */
function daysValue(value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (value === null || value === undefined || value === "") return Prisma.DbNull;
  const list = Array.isArray(value) ? value : String(value).split(",");
  const days = list.map((day) => Number(day)).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
  return days.length ? (days as unknown as Prisma.InputJsonValue) : Prisma.DbNull;
}

/** @summary Unidades estándar de receta; el negocio puede sumar unidades propias vía conversiones. */
export const RECIPE_UNITS = ["unidad", "g", "kg", "ml", "l", "cucharada", "cucharadita", "taza"];

/**
 * @summary Normaliza y valida el payload completo del editor de productos.
 *
 * Devuelve los datos listos para persistir en una transacción: campos base,
 * categorías, grupos de modificadores (variantes/agregados), lista de precios
 * por canal, composición de combo, receta con ingredientes y disponibilidad
 * por sucursal. Valida que todas las referencias pertenezcan al tenant y al
 * alcance de sucursal activo antes de escribir.
 */
export async function productWriteData(
  input: ProductWriteInput,
  tenantId: number,
  activeBranchId: number | undefined | null,
  options: { excludeId?: number; requirePrice?: boolean } = {},
) {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const description = typeof input.description === "string" ? input.description.trim() : "";
  if (!name || !description) throw new Error("Completá el nombre y la descripción del producto");

  const status = ["published", "scheduled", "draft", "hidden", "archived"].includes(input.status)
    ? input.status
    : "draft";
  const price = numberOrNull(input.price, 0);
  if (options.requirePrice && (price === null || price <= 0)) {
    throw new Error("Indicá un precio de venta mayor a cero");
  }
  const cost = numberOrNull(input.cost, 0);
  if (cost !== null && price !== null && cost > price) {
    throw new Error("El costo no puede ser mayor que el precio de venta");
  }
  const promotionalPrice = numberOrNull(input.promotionalPrice, 0);
  const previousPrice = numberOrNull(input.previousPrice, 0);
  const preparationMinutes = numberOrNull(input.preparationMinutes, 0, 1440);
  const spiceLevel = Math.min(3, Math.max(0, Math.round(Number(input.spiceLevel || 0))));

  // Categorías: todas deben pertenecer al tenant y al alcance de sucursal activo.
  const categoryIds = [...new Set((input.categoryIds ?? []).map(Number).filter(Number.isInteger))];
  if (!categoryIds.length) throw new Error("Elegí al menos una categoría de la carta");
  const validCategories = await prisma.category.findMany({
    where: {
      id: { in: categoryIds },
      tenantId,
      ...(activeBranchId && activeBranchId > 0 ? { branchId: activeBranchId } : {}),
    },
    select: { id: true },
  });
  if (validCategories.length !== categoryIds.length) {
    throw new Error("Alguna categoría seleccionada no pertenece a esta sucursal");
  }

  // Estación de preparación opcional, con alcance de tenant/sucursal.
  let stationId: number | null = null;
  if (input.stationId && String(input.stationId).trim() && Number(input.stationId) > 0) {
    const station = await prisma.kitchenStation.findFirst({
      where: {
        id: Number(input.stationId),
        tenantId,
        ...(activeBranchId && activeBranchId > 0 ? { branchId: activeBranchId } : {}),
      },
      select: { id: true },
    });
    if (!station) throw new Error("Elegí una estación de preparación válida");
    stationId = station.id;
  }

  // Disponibilidad por sucursal: las sucursales deben pertenecer a la membresía.
  const assignments = (input.branchAssignments ?? []).map((entry) => ({
    branchId: Number(entry.branchId),
    active: booleanValue(entry.active),
    priceOverride: entry.priceOverride ? numberOrNull(entry.priceOverride, 0) : null,
    availabilityOverride:
      typeof entry.availabilityOverride === "string" && entry.availabilityOverride
        ? entry.availabilityOverride
        : null,
    stockCurrent: entry.tracked ? numberOrNull(entry.stockCurrent, 0) : null,
    tracked: booleanValue(entry.tracked),
    minimum: entry.tracked ? numberOrNull(entry.minimum, 0) : null,
  }));
  const branchIds = [...new Set(assignments.map((entry) => entry.branchId))];
  if (branchIds.length) {
    const validBranches = await prisma.branch.findMany({
      where: { id: { in: branchIds }, tenantId },
      select: { id: true },
    });
    if (validBranches.length !== branchIds.length) {
      throw new Error("Alguna sucursal seleccionada no pertenece al negocio");
    }
  }

  // Grupos de modificadores (variantes y agregados) con sus ítems.
  const groups = (input.groups ?? []).map((group) => {
    const kind = group.kind === "extra" ? "extra" : "variant";
    const groupName = typeof group.name === "string" ? group.name.trim() : "";
    if (!groupName) throw new Error("Cada grupo de opciones necesita un nombre");
    const minSelections = Math.max(0, Math.round(Number(group.minSelections || 0)));
    const maxSelections = Math.max(minSelections, Math.round(Number(group.maxSelections || 1)));
    const items = (group.items ?? []).map((item) => {
      const itemName = typeof item.name === "string" ? item.name.trim() : "";
      if (!itemName) throw new Error("Cada opción o agregado necesita un nombre");
      const priceAdjustment =
        kind === "variant" ? numberOrNull(item.price, -999999, 999999) ?? 0 : numberOrNull(item.price, 0, 999999) ?? 0;
      return { name: itemName, price: priceAdjustment, active: booleanValue(item.active) };
    });
    if (!items.length) throw new Error(`El grupo "${groupName}" necesita al menos una opción`);
    return { kind, name: groupName, required: booleanValue(group.required), minSelections, maxSelections, items };
  });

  // Precios por canal, con vigencia/horario opcional.
  const priceLists = (input.priceLists ?? []).map((entry) => {
    if (!priceChannels.includes(entry.channel as PriceChannel)) {
      throw new Error("Canal de precio inválido");
    }
    const channelPrice = numberOrNull(entry.price, 0);
    if (channelPrice === null || channelPrice <= 0) {
      throw new Error("Cada lista de precio necesita un precio mayor a cero");
    }
    const validFrom = dateValue(entry.validFrom);
    const validUntil = dateValue(entry.validUntil);
    if (validFrom && validUntil && validUntil < validFrom) {
      throw new Error("La vigencia final no puede ser anterior a la inicial");
    }
    const startTime = timeValue(entry.startTime);
    const endTime = timeValue(entry.endTime);
    if (startTime && endTime && endTime <= startTime) {
      throw new Error("El horario final debe ser posterior al inicial");
    }
    return { channel: entry.channel, price: channelPrice, active: booleanValue(entry.active), validFrom, validUntil, startTime, endTime };
  });

  // Combo: composición fija con productos vendibles.
  const comboItems = (input.comboItems ?? []).map((item) => ({
    itemProductId: Number(item.itemProductId),
    quantity: numberOrNull(item.quantity, 0.001, 9999) ?? 1,
  }));
  if (comboItems.length) {
    const comboIds = [...new Set(comboItems.map((item) => item.itemProductId))];
    const validCombo = await prisma.product.findMany({
      where: { id: { in: comboIds }, tenantId },
      select: { id: true },
    });
    if (validCombo.length !== comboIds.length) {
      throw new Error("Algún producto del combo no pertenece al negocio");
    }
    if (options.excludeId && comboIds.includes(options.excludeId)) {
      throw new Error("Un producto no puede incluirse a sí mismo en su combo");
    }
  }

  // Receta: ingredientes con stock (productos reales con inventario).
  // La unidad puede ser estándar o personalizada del negocio; se valida el largo.
  const recipeIngredients = (input.recipeIngredients ?? []).map((item) => {
    const unit = typeof item.unit === "string" ? item.unit.trim() : "";
    return {
      ingredientProductId: Number(item.ingredientProductId),
      quantity: numberOrNull(item.quantity, 0.001, 9999) ?? 1,
      unit: unit && unit.length <= 40 ? unit : "unidad",
      // Rendimiento por defecto sin merma (100%); se conserva el explícito.
      yieldPercent: numberOrNull(item.yieldPercent, 0.001, 999) ?? 100,
    };
  });
  if (recipeIngredients.length) {
    const ingredientIds = [...new Set(recipeIngredients.map((item) => item.ingredientProductId))];
    const validIngredients = await prisma.product.findMany({
      where: { id: { in: ingredientIds }, tenantId },
      select: { id: true },
    });
    if (validIngredients.length !== ingredientIds.length) {
      throw new Error("Algún ingrediente de la receta no pertenece al negocio");
    }
    if (options.excludeId && ingredientIds.includes(options.excludeId)) {
      throw new Error("Un producto no puede usar su propia receta como ingrediente");
    }
  }

  const model3dUrl = localModelUrl(input.model3dUrl ?? "", tenantId, ["glb", "gltf"]);
  const usdzUrl = localModelUrl(input.usdzUrl ?? "", tenantId, ["usdz"]);
  const availability = ["disponible", "agotado"].includes(input.availability ?? "") ? input.availability : "disponible";

  return {
    base: {
      name,
      slug: await uniqueProductSlug(tenantId, typeof input.slug === "string" && input.slug.trim() ? input.slug : name, options.excludeId),
      description,
      availability,
      price,
      cost,
      promotionalPrice,
      previousPrice,
      status,
      publishAt: dateValue(input.publishAt),
      imageUrl: typeof input.imageUrl === "string" ? input.imageUrl : "",
      favorite: booleanValue(input.favorite),
      featured: booleanValue(input.featured),
      isNew: booleanValue(input.isNew),
      recommended: booleanValue(input.recommended),
      vegetarian: booleanValue(input.vegetarian),
      vegan: booleanValue(input.vegan),
      glutenFree: booleanValue(input.glutenFree),
      alcoholFree: booleanValue(input.alcoholFree),
      spiceLevel,
      preparationMinutes,
      stationId,
      availableDays: daysValue(input.availableDays),
      availableStartTime: timeValue(input.availableStartTime),
      availableEndTime: timeValue(input.availableEndTime),
      model3dUrl,
      usdzUrl,
      arEnabled: Boolean(model3dUrl) && booleanValue(input.arEnabled),
      arScale: optionalMeasurement(String(input.arScale ?? "1") || "1", 0.01, 20) ?? 1,
      modelWidthCm: optionalMeasurement(String(input.modelWidthCm ?? "")),
      modelHeightCm: optionalMeasurement(String(input.modelHeightCm ?? "")),
      modelDepthCm: optionalMeasurement(String(input.modelDepthCm ?? "")),
      modelOrientation: modelOrientation(input.modelOrientation ?? ""),
      arPlacement: input.arPlacement === "wall" ? "wall" : "floor",
      arAllowScale: booleanValue(input.arAllowScale),
      modelUpdatedAt: model3dUrl ? new Date() : null,
    } satisfies Prisma.ProductUncheckedUpdateInput,
    categoryIds,
    groups,
    priceLists,
    comboItems,
    recipeIngredients,
    branchAssignments: assignments,
  };
}

export type ProductWriteInput = {
  name: string;
  slug?: string;
  description: string;
  availability?: string;
  price?: string | number | null;
  cost?: string | number | null;
  promotionalPrice?: string | number | null;
  previousPrice?: string | number | null;
  status: string;
  publishAt?: string | null;
  imageUrl?: string;
  stationId?: string | number | null;
  favorite?: boolean;
  featured?: boolean;
  isNew?: boolean;
  recommended?: boolean;
  vegetarian?: boolean;
  vegan?: boolean;
  glutenFree?: boolean;
  alcoholFree?: boolean;
  spiceLevel?: string | number;
  preparationMinutes?: string | number | null;
  availableDays?: unknown;
  availableStartTime?: string | null;
  availableEndTime?: string | null;
  model3dUrl?: string | null;
  usdzUrl?: string | null;
  arEnabled?: boolean;
  arScale?: string | number;
  modelWidthCm?: string | number | null;
  modelHeightCm?: string | number | null;
  modelDepthCm?: string | number | null;
  modelOrientation?: string | null;
  arPlacement?: string;
  arAllowScale?: boolean;
  categoryIds: number[];
  priceLists?: Array<{
    channel: string;
    price: string | number;
    active: boolean;
    validFrom?: string | null;
    validUntil?: string | null;
    startTime?: string | null;
    endTime?: string | null;
  }>;
  groups?: Array<{
    kind: string;
    name: string;
    required: boolean;
    minSelections: number;
    maxSelections: number;
    items: Array<{ name: string; price?: string | number | null; active?: boolean }>;
  }>;
  comboItems?: Array<{ itemProductId: number; quantity: string | number }>;
  recipeIngredients?: Array<{
    ingredientProductId: number;
    quantity: string | number;
    unit?: string;
    yieldPercent?: string | number;
  }>;
  branchAssignments?: Array<{
    branchId: number;
    active: boolean;
    priceOverride?: string | number | null;
    availabilityOverride?: string | null;
    stockCurrent?: string | number | null;
    tracked?: boolean;
    minimum?: string | number | null;
  }>;
};

/**
 * @summary Aplica la estructura completa de un producto dentro de una transacción.
 *
 * Reemplaza categorías, grupos de modificadores, listas de precio, combo y
 * receta; y sincroniza la disponibilidad por sucursal (upsert) junto con el
 * stock de cada local.
 */
export async function applyProductWrite(
  transaction: Prisma.TransactionClient,
  tenantId: number,
  productId: number,
  write: Awaited<ReturnType<typeof productWriteData>>,
) {
  await transaction.product.update({ where: { id: productId }, data: write.base });

  await transaction.productCategory.deleteMany({ where: { productId, tenantId } });
  if (write.categoryIds.length) {
    await transaction.productCategory.createMany({
      data: write.categoryIds.map((categoryId) => ({ tenantId, productId, categoryId })),
    });
  }

  await transaction.productVariant.deleteMany({ where: { productId, tenantId } });
  await transaction.productExtra.deleteMany({ where: { productId, tenantId } });
  await transaction.productOptionGroup.deleteMany({ where: { productId, tenantId } });
  for (const [index, group] of write.groups.entries()) {
    const created = await transaction.productOptionGroup.create({
      data: {
        tenantId,
        productId,
        kind: group.kind,
        name: group.name,
        required: group.required,
        minSelections: group.minSelections,
        maxSelections: group.maxSelections,
        sortOrder: index,
      },
    });
    if (group.kind === "variant") {
      await transaction.productVariant.createMany({
        data: group.items.map((item, itemIndex) => ({
          tenantId,
          productId,
          name: item.name,
          priceAdjustment: item.price,
          active: item.active,
          sortOrder: itemIndex,
          groupId: created.id,
        })),
      });
    } else {
      await transaction.productExtra.createMany({
        data: group.items.map((item, itemIndex) => ({
          tenantId,
          productId,
          name: item.name,
          price: item.price,
          active: item.active,
          sortOrder: itemIndex,
          groupId: created.id,
        })),
      });
    }
  }

  await transaction.productPrice.deleteMany({ where: { productId, tenantId } });
  if (write.priceLists.length) {
    await transaction.productPrice.createMany({
      data: write.priceLists.map((entry, index) => ({
        tenantId,
        productId,
        channel: entry.channel,
        price: entry.price,
        active: entry.active,
        validFrom: entry.validFrom,
        validUntil: entry.validUntil,
        startTime: entry.startTime,
        endTime: entry.endTime,
        sortOrder: index,
      })),
    });
  }

  await transaction.productComboItem.deleteMany({ where: { productId, tenantId } });
  if (write.comboItems.length) {
    await transaction.productComboItem.createMany({
      data: write.comboItems.map((item, index) => ({
        tenantId,
        productId,
        itemProductId: item.itemProductId,
        quantity: item.quantity,
        sortOrder: index,
      })),
    });
  }

  await transaction.recipeIngredient.deleteMany({ where: { productId, tenantId } });
  if (write.recipeIngredients.length) {
    await transaction.recipeIngredient.createMany({
      data: write.recipeIngredients.map((item, index) => ({
        tenantId,
        productId,
        ingredientProductId: item.ingredientProductId,
        quantity: item.quantity,
        unit: item.unit,
        yieldPercent: item.yieldPercent,
        sortOrder: index,
      })),
    });
  }

  for (const assignment of write.branchAssignments) {
    await transaction.branchProduct.upsert({
      where: { branchId_productId: { branchId: assignment.branchId, productId } },
      create: {
        tenantId,
        branchId: assignment.branchId,
        productId,
        active: assignment.active,
        priceOverride: assignment.priceOverride,
        availabilityOverride: assignment.availabilityOverride,
      },
      update: {
        active: assignment.active,
        priceOverride: assignment.priceOverride,
        availabilityOverride: assignment.availabilityOverride,
      },
    });
    await transaction.inventoryStock.upsert({
      where: { branchId_productId: { branchId: assignment.branchId, productId } },
      create: {
        tenantId,
        branchId: assignment.branchId,
        productId,
        tracked: assignment.tracked,
        current: assignment.stockCurrent ?? 0,
        minimum: assignment.minimum ?? 0,
      },
      update: {
        tracked: assignment.tracked,
        current: assignment.stockCurrent ?? 0,
        minimum: assignment.minimum ?? 0,
      },
    });
  }
}

/** @summary Elimina la publicación de un producto en una sucursal sin tocar el maestro. */
export async function removeProductFromBranch(tenantId: number, productId: number, branchId: number) {
  return prisma.$transaction([
    prisma.productCategory.deleteMany({ where: { productId, tenantId, category: { branchId } } }),
    prisma.branchProduct.deleteMany({ where: { productId, branchId, tenantId } }),
    prisma.inventoryStock.deleteMany({ where: { productId, branchId, tenantId } }),
  ]);
}

/** @summary Elimina el producto maestro y sus relaciones (falla si tiene pedidos asociados). */
export async function removeProductEntirely(tenantId: number, productId: number) {
  return prisma.$transaction([
    prisma.productCategory.deleteMany({ where: { productId, tenantId } }),
    prisma.branchProduct.deleteMany({ where: { productId, tenantId } }),
    prisma.inventoryStock.deleteMany({ where: { productId, tenantId } }),
    prisma.product.delete({ where: { id: productId } }),
  ]);
}

/**
 * @summary Duplica un producto de forma segura conservando su configuración.
 *
 * Copia categoría, variantes, agregados, grupos, combo, receta, precios por canal,
 * asignaciones de sucursal y archivos 3D/AR. El stock de cada sucursal se crea en
 * cero (cada local administra su propio inventario) y el copia queda en borrador
 * para revisarla antes de publicar.
 */
export async function duplicateProduct(tenantId: number, productId: number) {
  const source = await prisma.product.findFirst({
    where: { id: productId, tenantId },
    include: {
      categories: { select: { categoryId: true } },
      variants: true,
      extras: true,
      optionGroups: true,
      comboParts: true,
      recipeItems: true,
      priceLists: true,
      branchAssignments: {
        select: { branchId: true, active: true, priceOverride: true, availabilityOverride: true },
      },
    },
  });
  if (!source) throw new Error("Producto no encontrado");

  const slug = await uniqueProductSlug(tenantId, `${source.name} · copia`);
  return prisma.$transaction(async (transaction) => {
    const created = await transaction.product.create({
      data: {
        tenantId,
        name: `${source.name} · copia`,
        slug,
        description: source.description,
        availability: source.availability,
        price: source.price,
        promotionalPrice: source.promotionalPrice,
        previousPrice: source.previousPrice,
        cost: source.cost,
        imageUrl: source.imageUrl,
        status: "draft",
        featured: source.featured,
        isNew: false,
        recommended: source.recommended,
        vegetarian: source.vegetarian,
        vegan: source.vegan,
        glutenFree: source.glutenFree,
        alcoholFree: source.alcoholFree,
        spiceLevel: source.spiceLevel,
        preparationMinutes: source.preparationMinutes,
        availableDays: (source.availableDays ?? Prisma.DbNull) as Prisma.InputJsonValue,
        availableStartTime: source.availableStartTime,
        availableEndTime: source.availableEndTime,
        stationId: source.stationId,
        favorite: source.favorite,
        model3dUrl: source.model3dUrl,
        usdzUrl: source.usdzUrl,
        modelPosterUrl: source.modelPosterUrl,
        arEnabled: source.arEnabled,
        arScale: source.arScale,
        modelWidthCm: source.modelWidthCm,
        modelHeightCm: source.modelHeightCm,
        modelDepthCm: source.modelDepthCm,
        modelOrientation: source.modelOrientation,
        arPlacement: source.arPlacement,
        arAllowScale: source.arAllowScale,
        modelUpdatedAt: source.modelUpdatedAt,
      } satisfies Prisma.ProductUncheckedCreateInput,
    });

    await transaction.productCategory.createMany({
      data: source.categories.map((entry) => ({
        tenantId,
        productId: created.id,
        categoryId: entry.categoryId,
      })),
    });

    // Los grupos se recrean primero para conservar el agrupamiento de opciones.
    const groupIdMap = new Map<number, number>();
    for (const group of source.optionGroups) {
      const copy = await transaction.productOptionGroup.create({
        data: {
          tenantId,
          productId: created.id,
          kind: group.kind,
          name: group.name,
          required: group.required,
          minSelections: group.minSelections,
          maxSelections: group.maxSelections,
          sortOrder: group.sortOrder,
          active: group.active,
        },
      });
      groupIdMap.set(group.id, copy.id);
    }
    if (source.variants.length) {
      await transaction.productVariant.createMany({
        data: source.variants.map((variant) => ({
          tenantId,
          productId: created.id,
          name: variant.name,
          priceAdjustment: variant.priceAdjustment,
          active: variant.active,
          sortOrder: variant.sortOrder,
          groupId: variant.groupId ? (groupIdMap.get(variant.groupId) ?? null) : null,
        })),
      });
    }
    if (source.extras.length) {
      await transaction.productExtra.createMany({
        data: source.extras.map((extra) => ({
          tenantId,
          productId: created.id,
          name: extra.name,
          price: extra.price,
          active: extra.active,
          sortOrder: extra.sortOrder,
          groupId: extra.groupId ? (groupIdMap.get(extra.groupId) ?? null) : null,
        })),
      });
    }
    if (source.comboParts.length) {
      await transaction.productComboItem.createMany({
        data: source.comboParts.map((item) => ({
          tenantId,
          productId: created.id,
          itemProductId: item.itemProductId,
          quantity: item.quantity,
          sortOrder: item.sortOrder,
        })),
      });
    }
    if (source.recipeItems.length) {
      await transaction.recipeIngredient.createMany({
        data: source.recipeItems.map((item) => ({
          tenantId,
          productId: created.id,
          ingredientProductId: item.ingredientProductId,
          quantity: item.quantity,
          unit: item.unit,
          yieldPercent: item.yieldPercent,
          sortOrder: item.sortOrder,
        })),
      });
    }
    if (source.priceLists.length) {
      await transaction.productPrice.createMany({
        data: source.priceLists.map((entry) => ({
          tenantId,
          productId: created.id,
          channel: entry.channel,
          price: entry.price,
          active: entry.active,
          validFrom: entry.validFrom,
          validUntil: entry.validUntil,
          startTime: entry.startTime,
          endTime: entry.endTime,
          daysOfWeek: (entry.daysOfWeek ?? Prisma.DbNull) as Prisma.InputJsonValue,
          sortOrder: entry.sortOrder,
        })),
      });
    }

    // Disponibilidad por sucursal: se copian las asignaciones, pero cada local
    // arranca con stock en cero para no arrastrar inventario del producto original.
    for (const assignment of source.branchAssignments) {
      await transaction.branchProduct.create({
        data: {
          tenantId,
          branchId: assignment.branchId,
          productId: created.id,
          active: assignment.active,
          priceOverride: assignment.priceOverride,
          availabilityOverride: assignment.availabilityOverride,
        },
      });
      await transaction.inventoryStock.create({
        data: {
          tenantId,
          branchId: assignment.branchId,
          productId: created.id,
          tracked: false,
          current: 0,
          minimum: 0,
        },
      });
    }

    return created;
  });
}
