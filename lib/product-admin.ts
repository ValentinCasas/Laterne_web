import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { localModelUrl, modelOrientation, optionalMeasurement } from "@/lib/product-model";
import { uniqueProductSlug } from "@/lib/slug";

/**
 * @summary Interpreta valores de formulario como booleanos consistentes.
 */
function booleanValue(value: string) {
  return value === "true" || value === "1" || value === "on";
}

/**
 * @summary Extrae los campos permitidos de un formulario administrativo.
 */
function selectFields(input: Record<string, string>, fields: string[]) {
  return Object.fromEntries(fields.map((field) => [field, input[field] ?? ""]));
}

/**
 * @summary Normaliza los datos de un producto antes de persistirlos.
 *
 * Datos admin para crear/actualizar un Product.
 *
 * Product es el catálogo maestro del Tenant: no lleva branchId directo. Su
 * publicación por sucursal vive en BranchProduct (branchAssignments) y el stock
 * en InventoryStock. Esta normalización devuelve además branchId/categoryId
 * objetivos para que el llamador cree la asignación y la categoría correctas.
 */
export async function productAdminData(
  input: Record<string, string>,
  tenantId: number,
  activeBranchId: number | undefined,
  options: { excludeId?: number } = {},
): Promise<{ targetBranchId: number; categoryId: number; data: Prisma.ProductUncheckedCreateInput }> {
  const categoryId = Number(input.categoryId);
  const category = await prisma.category.findFirst({
    where: {
      id: categoryId,
      tenantId,
      ...(activeBranchId && activeBranchId > 0 ? { branchId: activeBranchId } : {}),
    },
  });
  if (!category) throw new Error("Seleccioná una categoría válida");

  // Estación de cocina opcional: debe pertenecer al tenant y, si hay sucursal
  // activa, a esa sucursal. Vacío significa "sin estación" (no se rutea).
  let stationId: number | null = null;
  if (input.stationId && input.stationId.trim()) {
    const station = await prisma.kitchenStation.findFirst({
      where: {
        id: Number(input.stationId),
        tenantId,
        ...(activeBranchId && activeBranchId > 0 ? { branchId: activeBranchId } : {}),
      },
      select: { id: true },
    });
    if (!station) throw new Error("Elegí una estación de cocina válida");
    stationId = station.id;
  }
  const targetBranchId = activeBranchId && activeBranchId > 0 ? activeBranchId : category.branchId;
  if (!targetBranchId) throw new Error("Indicá la sucursal del producto");

  const fields = selectFields(input, ["name", "description", "availability", "imageUrl", "status"]) as {
    name: string;
    description: string;
    availability: string;
    imageUrl: string;
    status: string;
  };
  if (!fields.name.trim() || !fields.description.trim())
    throw new Error("Completá el nombre y la descripción");
  const model3dUrl = localModelUrl(input.model3dUrl ?? "", tenantId, ["glb", "gltf"]);
  const usdzUrl = localModelUrl(input.usdzUrl ?? "", tenantId, ["usdz"]);

  return {
    targetBranchId,
    categoryId,
    data: {
      ...fields,
      tenantId,
      status: fields.status || "published",
      slug: await uniqueProductSlug(tenantId, input.slug || fields.name, options.excludeId),
      publishAt: input.publishAt ? new Date(input.publishAt) : null,
      price: input.price ? Number(input.price) : undefined,
      promotionalPrice: input.promotionalPrice ? Number(input.promotionalPrice) : undefined,
      previousPrice: input.previousPrice ? Number(input.previousPrice) : undefined,
      preparationMinutes: input.preparationMinutes ? Number(input.preparationMinutes) : undefined,
      stationId,
      spiceLevel: Math.min(3, Math.max(0, Number(input.spiceLevel || 0))),
      featured: booleanValue(input.featured),
      isNew: booleanValue(input.isNew),
      recommended: booleanValue(input.recommended),
      vegetarian: booleanValue(input.vegetarian),
      vegan: booleanValue(input.vegan),
      glutenFree: booleanValue(input.glutenFree),
      alcoholFree: booleanValue(input.alcoholFree),
      model3dUrl,
      usdzUrl,
      arEnabled: Boolean(model3dUrl) && booleanValue(input.arEnabled),
      arScale: optionalMeasurement(input.arScale || "1", 0.01, 20) ?? 1,
      modelWidthCm: optionalMeasurement(input.modelWidthCm ?? ""),
      modelHeightCm: optionalMeasurement(input.modelHeightCm ?? ""),
      modelDepthCm: optionalMeasurement(input.modelDepthCm ?? ""),
      modelOrientation: modelOrientation(input.modelOrientation ?? ""),
      arPlacement: input.arPlacement === "wall" ? "wall" : "floor",
      arAllowScale: booleanValue(input.arAllowScale),
      availableDays: input.availableDays
        ? input.availableDays
            .split(",")
            .map(Number)
            .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
        : Prisma.DbNull,
      availableStartTime: input.availableStartTime
        ? new Date(`1970-01-01T${input.availableStartTime}:00Z`)
        : null,
      availableEndTime: input.availableEndTime ? new Date(`1970-01-01T${input.availableEndTime}:00Z`) : null,
      modelUpdatedAt: model3dUrl ? new Date() : null,
      categories: {
        create: { tenantId, categoryId: category.id },
      },
    },
  };
}
