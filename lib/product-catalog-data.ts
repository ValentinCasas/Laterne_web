import type { AuthorizationContext } from "@/lib/auth";
import { branchProductWhere, resourceScopedWhere } from "@/lib/branch";
import { prisma } from "@/lib/prisma";
import { marginPercent, markupPercent } from "@/lib/product-catalog";

/**
 * Carga los datos del catálogo de productos para el contexto autorizado.
 *
 * Product es el catálogo maestro del tenant; la publicación por sucursal vive en
 * BranchProduct y el stock en InventoryStock. El payload alimenta el listado
 * grande de productos y las opciones del editor guiado (categorías, sucursales,
 * estaciones y productos para combos/recetas). El aislamiento multi-sucursal es
 * estructural: si la URL indica una sucursal activa, solo se ven los productos
 * publicados en ella.
 */

export type CatalogProductRow = {
  id: number;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  status: string;
  availability: string | null;
  price: string | null;
  cost: string | null;
  promotionalPrice: string | null;
  margin: number | null;
  markup: number | null;
  favorite: boolean;
  featured: boolean;
  /** Identificador de la categoría efectiva (hija si existe, si no la categoría). */
  categoryId: number | null;
  /** Categoría padre cuando el producto cuelga de una subcategoría. */
  parentCategoryId: number | null;
  /** Breadcrumb legible "Categoría › Subcategoría". */
  categoryBreadcrumb: string;
  stationId: number | null;
  stationName: string | null;
  branchCount: number;
  activeBranchCount: number;
  /** Sucursales donde el producto está publicado (para filtrar por local). */
  branchIds: number[];
  /** Stock físico en la sucursal activa (null si no hay sucursal activa o no se controla). */
  stock: string | null;
  /** Unidades reservadas en la sucursal activa. */
  reserved: string | null;
  /** Disponible = físico − reservado en la sucursal activa. */
  available: string | null;
  /** Mínimo configurado en la sucursal activa (para alertas de stock bajo). */
  minimum: string | null;
  tracked: boolean;
  hasRecipe: boolean;
  hasCombo: boolean;
  hasModifiers: boolean;
  hasChannelPrices: boolean;
  hasImage: boolean;
  hasModel3d: boolean;
  arEnabled: boolean;
  /** Fecha de la última actualización para ordenar por "más reciente". */
  updatedAt: string;
};

export type CatalogCategoryOption = {
  id: number;
  name: string;
  parentId: number | null;
  parentName: string | null;
  sortOrder: number;
};

export type CatalogBranchOption = { id: number; name: string; slug: string };
export type CatalogStationOption = { id: number; name: string; type: string };

export type ProductCatalogPayload = {
  products: CatalogProductRow[];
  categories: CatalogCategoryOption[];
  branches: CatalogBranchOption[];
  stations: CatalogStationOption[];
  /** Productos disponibles (para armar combos y recetas dentro del editor). */
  menuProducts: Array<{ id: number; name: string; price: string | null }>;
  activeBranch: CatalogBranchOption | null;
  tenantName: string;
  currency: string;
};

/** @summary Carga el payload del listado de productos y las opciones del editor. */
export async function loadProductCatalogData(context: AuthorizationContext): Promise<ProductCatalogPayload> {
  const activeId = context.activeBranchId && context.activeBranchId > 0 ? context.activeBranchId : null;
  const tenantId = context.tenant.id;

  const [products, categories, stations, menuProducts, tenant, activeBranch] = await Promise.all([
    prisma.product.findMany({
      where: branchProductWhere(tenantId, activeId),
      include: {
        categories: { include: { category: { include: { parent: { select: { name: true } } } } } },
        branchAssignments: { select: { branchId: true, active: true } },
        inventoryStocks: {
          select: { branchId: true, current: true, reserved: true, minimum: true, tracked: true },
        },
        station: { select: { id: true, name: true } },
        _count: {
          select: {
            recipeItems: true,
            comboParts: true,
            optionGroups: true,
            variants: true,
            extras: true,
            priceLists: true,
          },
        },
      },
      orderBy: [{ favorite: "desc" }, { name: "asc" }],
    }),
    prisma.category.findMany({
      where: resourceScopedWhere("category", tenantId, activeId),
      include: { parent: { select: { name: true } } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.kitchenStation.findMany({
      where: {
        tenantId,
        ...(activeId ? { branchId: activeId } : { branchId: { in: context.branches.map((branch) => branch.id) } }),
      },
      select: { id: true, name: true, type: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.product.findMany({
      where: { ...branchProductWhere(tenantId, activeId), status: { not: "archived" } },
      select: { id: true, name: true, price: true },
      orderBy: { name: "asc" },
      take: 800,
    }),
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { defaultCurrency: true, name: true },
    }),
    activeId
      ? prisma.branch.findFirst({
          where: { id: activeId, tenantId },
          select: { id: true, name: true, slug: true },
        })
      : Promise.resolve(null),
  ]);

  return {
    products: products.map((product) => {
      const category = product.categories[0]?.category ?? null;
      const parent = category?.parent ?? null;
      const stock = activeId
        ? product.inventoryStocks.find((entry) => entry.branchId === activeId) ?? null
        : null;
      const price = product.price !== null && product.price !== undefined ? Number(product.price) : null;
      const cost = product.cost !== null && product.cost !== undefined ? Number(product.cost) : null;
      const current = stock && stock.tracked ? Number(stock.current) : null;
      const reserved = stock && stock.tracked ? Number(stock.reserved ?? 0) : null;
      return {
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        imageUrl: product.imageUrl,
        status: product.status,
        availability: product.availability,
        price: price !== null ? String(price) : null,
        cost: cost !== null ? String(cost) : null,
        promotionalPrice:
          product.promotionalPrice !== null && product.promotionalPrice !== undefined
            ? String(Number(product.promotionalPrice))
            : null,
        margin: marginPercent(cost, price),
        markup: markupPercent(cost, price),
        favorite: product.favorite,
        featured: product.featured,
        categoryId: category?.id ?? null,
        parentCategoryId: category?.parentId ?? null,
        categoryBreadcrumb: [parent?.name, category?.name].filter(Boolean).join(" › "),
        stationId: product.stationId ?? null,
        stationName: product.station?.name ?? null,
        branchCount: product.branchAssignments.length,
        activeBranchCount: product.branchAssignments.filter((entry) => entry.active).length,
        branchIds: product.branchAssignments.map((entry) => entry.branchId),
        stock: current !== null ? String(current) : null,
        reserved: reserved !== null ? String(reserved) : null,
        available: current !== null ? String(Math.max(0, current - (reserved ?? 0))) : null,
        minimum: stock?.tracked ? String(Number(stock.minimum ?? 0)) : null,
        tracked: stock?.tracked ?? false,
        hasRecipe: product._count.recipeItems > 0,
        hasCombo: product._count.comboParts > 0,
        hasModifiers:
          product._count.optionGroups > 0 || product._count.variants > 0 || product._count.extras > 0,
        hasChannelPrices: product._count.priceLists > 0,
        hasImage: product.imageUrl.trim() !== "",
        hasModel3d: Boolean(product.model3dUrl && product.model3dUrl.trim() !== ""),
        arEnabled: product.arEnabled,
        updatedAt: product.updatedAt.toISOString(),
      };
    }),
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      parentId: category.parentId,
      parentName: category.parent?.name ?? null,
      sortOrder: category.sortOrder,
    })),
    stations: stations.map((station) => ({ id: station.id, name: station.name, type: station.type })),
    menuProducts: menuProducts.map((product) => ({
      id: product.id,
      name: product.name,
      price: product.price !== null && product.price !== undefined ? String(Number(product.price)) : null,
    })),
    branches: context.branches
      .filter((branch) => branch.active && branch.status === "active")
      .map((branch) => ({ id: branch.id, name: branch.name, slug: branch.slug })),
    activeBranch: activeBranch ? { id: activeBranch.id, name: activeBranch.name, slug: activeBranch.slug } : null,
    tenantName: tenant?.name ?? context.tenant.name,
    currency: tenant?.defaultCurrency ?? "ARS",
  };
}

export type ProductDetailGroupItem = {
  id: number;
  name: string;
  /** Ajuste de precio para variante o precio del agregado (según el kind del grupo). */
  price: string | null;
  active: boolean;
};

export type ProductDetailGroup = {
  id: number;
  kind: string;
  name: string;
  required: boolean;
  minSelections: number;
  maxSelections: number;
  sortOrder: number;
  items: ProductDetailGroupItem[];
};

export type ProductDetailPriceEntry = {
  id: number;
  channel: string;
  price: string;
  active: boolean;
  validFrom: string | null;
  validUntil: string | null;
  startTime: string | null;
  endTime: string | null;
};

export type ProductDetailComboItem = {
  id: number;
  itemProductId: number;
  itemProductName: string;
  quantity: string;
};

export type ProductDetailRecipeIngredient = {
  id: number;
  ingredientProductId: number;
  ingredientProductName: string;
  quantity: string;
  unit: string;
  yieldPercent: string;
};

export type ProductDetailBranchAssignment = {
  branchId: number;
  branchName: string;
  active: boolean;
  priceOverride: string | null;
  availabilityOverride: string | null;
  stockCurrent: string | null;
  tracked: boolean;
  minimum: string | null;
};

export type ProductDetail = {
  id: number;
  name: string;
  slug: string;
  description: string;
  availability: string | null;
  price: string | null;
  cost: string | null;
  promotionalPrice: string | null;
  previousPrice: string | null;
  status: string;
  publishAt: string | null;
  featured: boolean;
  isNew: boolean;
  recommended: boolean;
  vegetarian: boolean;
  vegan: boolean;
  glutenFree: boolean;
  alcoholFree: boolean;
  spiceLevel: number;
  preparationMinutes: number | null;
  imageUrl: string;
  stationId: number | null;
  favorite: boolean;
  availableDays: number[] | null;
  availableStartTime: string | null;
  availableEndTime: string | null;
  model3dUrl: string | null;
  usdzUrl: string | null;
  arEnabled: boolean;
  arScale: string | null;
  modelWidthCm: string | null;
  modelHeightCm: string | null;
  modelDepthCm: string | null;
  modelOrientation: string;
  arPlacement: string;
  arAllowScale: boolean;
  categoryIds: number[];
  groups: ProductDetailGroup[];
  priceLists: ProductDetailPriceEntry[];
  comboItems: ProductDetailComboItem[];
  recipeIngredients: ProductDetailRecipeIngredient[];
  branchAssignments: ProductDetailBranchAssignment[];
};

/** @summary Convierte un valor decimal de Prisma en una cadena segura o null. */
function decimalString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? String(number) : null;
}

/** @summary Convierte una hora Time de Prisma en "HH:mm" o null. */
function timeString(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(11, 16) : null;
}

/** @summary Carga el detalle completo de un producto para el editor guiado. */
export async function loadProductDetail(
  context: AuthorizationContext,
  productId: number,
): Promise<ProductDetail | null> {
  const activeId = context.activeBranchId && context.activeBranchId > 0 ? context.activeBranchId : null;
  const product = await prisma.product.findFirst({
    where: { ...branchProductWhere(context.tenant.id, activeId), id: productId },
    include: {
      categories: { select: { categoryId: true } },
      variants: { include: { group: { select: { id: true, kind: true } } } },
      extras: { include: { group: { select: { id: true, kind: true } } } },
      optionGroups: {
        include: {
          variants: { orderBy: { sortOrder: "asc" } },
          extras: { orderBy: { sortOrder: "asc" } },
        },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      },
      comboParts: { include: { item: { select: { name: true } } }, orderBy: { sortOrder: "asc" } },
      recipeItems: {
        include: { ingredient: { select: { name: true } } },
        orderBy: { sortOrder: "asc" },
      },
      priceLists: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
      branchAssignments: {
        include: { branch: { select: { name: true } } },
        orderBy: { branchId: "asc" },
      },
      inventoryStocks: true,
    },
  });
  if (!product) return null;

  // Agrupa variantes y agregados por grupo para conservar el agrupamiento existente.
  const grouped = new Map<
    number,
    { id: number; kind: string; name: string; required: boolean; minSelections: number; maxSelections: number; sortOrder: number }
  >();
  for (const group of product.optionGroups) {
    grouped.set(group.id, {
      id: group.id,
      kind: group.kind,
      name: group.name,
      required: group.required,
      minSelections: group.minSelections,
      maxSelections: group.maxSelections,
      sortOrder: group.sortOrder,
    });
  }

  const groups: ProductDetailGroup[] = product.optionGroups.map((group) => {
    const variantItems: ProductDetailGroupItem[] = group.variants.map((variant) => ({
      id: variant.id,
      name: variant.name,
      price: decimalString(variant.priceAdjustment),
      active: variant.active,
    }));
    const extraItems: ProductDetailGroupItem[] = group.extras.map((extra) => ({
      id: extra.id,
      name: extra.name,
      price: decimalString(extra.price),
      active: extra.active,
    }));
    return {
      id: group.id,
      kind: group.kind,
      name: group.name,
      required: group.required,
      minSelections: group.minSelections,
      maxSelections: group.maxSelections,
      sortOrder: group.sortOrder,
      items: group.kind === "variant" ? variantItems : extraItems,
    };
  });

  // Variantes y agregados sin grupo (legado) se muestran como grupo implícito.
  const orphanVariants = product.variants.filter((variant) => !variant.groupId);
  const orphanExtras = product.extras.filter((extra) => !extra.groupId);
  if (orphanVariants.length) {
    groups.push({
      id: -1,
      kind: "variant",
      name: "Opciones",
      required: false,
      minSelections: 0,
      maxSelections: 1,
      sortOrder: groups.length,
      items: orphanVariants.map((variant) => ({
        id: variant.id,
        name: variant.name,
        price: decimalString(variant.priceAdjustment),
        active: variant.active,
      })),
    });
  }
  if (orphanExtras.length) {
    groups.push({
      id: -2,
      kind: "extra",
      name: "Agregados",
      required: false,
      minSelections: 0,
      maxSelections: 99,
      sortOrder: groups.length,
      items: orphanExtras.map((extra) => ({
        id: extra.id,
        name: extra.name,
        price: decimalString(extra.price),
        active: extra.active,
      })),
    });
  }

  const assignments = product.branchAssignments.map((assignment) => {
    const stock = product.inventoryStocks.find((entry) => entry.branchId === assignment.branchId) ?? null;
    return {
      branchId: assignment.branchId,
      branchName: assignment.branch.name,
      active: assignment.active,
      priceOverride: decimalString(assignment.priceOverride),
      availabilityOverride: assignment.availabilityOverride,
      stockCurrent: stock ? decimalString(stock.current) : null,
      tracked: stock?.tracked ?? false,
      minimum: stock ? decimalString(stock.minimum) : null,
    };
  });

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    availability: product.availability,
    price: decimalString(product.price),
    cost: decimalString(product.cost),
    promotionalPrice: decimalString(product.promotionalPrice),
    previousPrice: decimalString(product.previousPrice),
    status: product.status,
    publishAt: product.publishAt ? product.publishAt.toISOString().slice(0, 16) : null,
    featured: product.featured,
    isNew: product.isNew,
    recommended: product.recommended,
    vegetarian: product.vegetarian,
    vegan: product.vegan,
    glutenFree: product.glutenFree,
    alcoholFree: product.alcoholFree,
    spiceLevel: product.spiceLevel,
    preparationMinutes: product.preparationMinutes,
    imageUrl: product.imageUrl,
    stationId: product.stationId,
    favorite: product.favorite,
    availableDays: Array.isArray(product.availableDays)
      ? (product.availableDays as unknown[]).map(Number)
      : null,
    availableStartTime: timeString(product.availableStartTime),
    availableEndTime: timeString(product.availableEndTime),
    model3dUrl: product.model3dUrl,
    usdzUrl: product.usdzUrl,
    arEnabled: product.arEnabled,
    arScale: decimalString(product.arScale),
    modelWidthCm: decimalString(product.modelWidthCm),
    modelHeightCm: decimalString(product.modelHeightCm),
    modelDepthCm: decimalString(product.modelDepthCm),
    modelOrientation: product.modelOrientation,
    arPlacement: product.arPlacement,
    arAllowScale: product.arAllowScale,
    categoryIds: product.categories.map((entry) => entry.categoryId),
    groups,
    priceLists: product.priceLists.map((entry) => ({
      id: entry.id,
      channel: entry.channel,
      price: decimalString(entry.price) ?? "0",
      active: entry.active,
      validFrom: entry.validFrom ? entry.validFrom.toISOString().slice(0, 10) : null,
      validUntil: entry.validUntil ? entry.validUntil.toISOString().slice(0, 10) : null,
      startTime: timeString(entry.startTime),
      endTime: timeString(entry.endTime),
    })),
    comboItems: product.comboParts.map((item) => ({
      id: item.id,
      itemProductId: item.itemProductId,
      itemProductName: item.item.name,
      quantity: decimalString(item.quantity) ?? "1",
    })),
    recipeIngredients: product.recipeItems.map((item) => ({
      id: item.id,
      ingredientProductId: item.ingredientProductId,
      ingredientProductName: item.ingredient.name,
      quantity: decimalString(item.quantity) ?? "1",
      unit: item.unit,
      yieldPercent: decimalString(item.yieldPercent) ?? "100",
    })),
    branchAssignments: assignments,
  };
}

