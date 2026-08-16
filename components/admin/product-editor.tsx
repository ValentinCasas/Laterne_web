"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";
import { scopedFetch } from "@/lib/client-routing";
import { PRODUCT_IMAGE_FALLBACK } from "@/lib/image-fallback";
import {
  marginPercent,
  markupPercent,
  priceChannelLabel,
  priceChannels,
  type PriceChannel,
} from "@/lib/product-catalog";
import type {
  CatalogBranchOption,
  CatalogCategoryOption,
  CatalogStationOption,
  ProductDetail,
} from "@/lib/product-catalog-data";

/**
 * Editor guiado de productos de MenuClick.
 *
 * Ordena el alta/edición en pasos claros para que una persona no técnica sepa
 * distinguir: datos básicos, precios y costo/margen, disponibilidad por
 * sucursal, preparación (modificadores = elección del cliente, combo =
 * composición con otros productos vendibles, receta = ingredientes con stock)
 * e imagen/3D. Guarda la estructura completa en una sola operación.
 */

type GroupItemDraft = { key: string; name: string; price: string };
type GroupDraft = {
  key: string;
  kind: "variant" | "extra";
  name: string;
  required: boolean;
  minSelections: string;
  maxSelections: string;
  items: GroupItemDraft[];
};
type PriceDraft = {
  channel: string;
  price: string;
  active: boolean;
  validFrom: string;
  validUntil: string;
  startTime: string;
  endTime: string;
};
type ComboDraft = { itemProductId: number; name: string; quantity: string };
type RecipeDraft = { ingredientProductId: number; name: string; quantity: string; unit: string };
type BranchDraft = {
  branchId: number;
  name: string;
  active: boolean;
  priceOverride: string;
  availabilityOverride: string;
  tracked: boolean;
  stockCurrent: string;
  minimum: string;
};

type Draft = {
  name: string;
  slug: string;
  description: string;
  availability: string;
  price: string;
  cost: string;
  promotionalPrice: string;
  previousPrice: string;
  status: string;
  publishAt: string;
  imageUrl: string;
  stationId: string;
  favorite: boolean;
  featured: boolean;
  isNew: boolean;
  recommended: boolean;
  vegetarian: boolean;
  vegan: boolean;
  glutenFree: boolean;
  alcoholFree: boolean;
  spiceLevel: string;
  preparationMinutes: string;
  availableDays: number[];
  availableStartTime: string;
  availableEndTime: string;
  model3dUrl: string;
  usdzUrl: string;
  arEnabled: boolean;
  arScale: string;
  modelWidthCm: string;
  modelHeightCm: string;
  modelDepthCm: string;
  modelOrientation: string;
  arPlacement: string;
  arAllowScale: boolean;
  categoryId: string;
  subcategoryId: string;
  groups: GroupDraft[];
  priceLists: PriceDraft[];
  comboItems: ComboDraft[];
  recipeIngredients: RecipeDraft[];
  branchAssignments: BranchDraft[];
};

export type ProductEditorOptions = {
  categories: CatalogCategoryOption[];
  branches: CatalogBranchOption[];
  stations: CatalogStationOption[];
  menuProducts: Array<{ id: number; name: string; price: string | null }>;
  currency: string;
};

const STEPS = ["Datos básicos", "Precio y costos", "Sucursales y stock", "Preparación", "Imagen y 3D/AR"];

const DAY_LABELS = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mié" },
  { value: 4, label: "Jue" },
  { value: 5, label: "Vie" },
  { value: 6, label: "Sáb" },
];

const RECIPE_UNITS = ["unidad", "g", "kg", "ml", "l", "cucharada", "cucharadita", "taza"];

let uidCounter = 0;
function uid() {
  uidCounter += 1;
  return `item-${uidCounter}-${Date.now().toString(36)}`;
}

/** @summary Devuelve un borrador vacío listo para un producto nuevo. */
function emptyDraft(options: ProductEditorOptions): Draft {
  return {
    name: "",
    slug: "",
    description: "",
    availability: "disponible",
    price: "",
    cost: "",
    promotionalPrice: "",
    previousPrice: "",
    status: "published",
    publishAt: "",
    imageUrl: "",
    stationId: "",
    favorite: false,
    featured: false,
    isNew: false,
    recommended: false,
    vegetarian: false,
    vegan: false,
    glutenFree: false,
    alcoholFree: false,
    spiceLevel: "0",
    preparationMinutes: "",
    availableDays: [],
    availableStartTime: "",
    availableEndTime: "",
    model3dUrl: "",
    usdzUrl: "",
    arEnabled: false,
    arScale: "1",
    modelWidthCm: "",
    modelHeightCm: "",
    modelDepthCm: "",
    modelOrientation: "0deg 0deg 0deg",
    arPlacement: "floor",
    arAllowScale: true,
    categoryId: "",
    subcategoryId: "",
    groups: [],
    priceLists: priceChannels.map((channel) => ({
      channel,
      price: "",
      active: false,
      validFrom: "",
      validUntil: "",
      startTime: "",
      endTime: "",
    })),
    comboItems: [],
    recipeIngredients: [],
    branchAssignments: options.branches.map((branch) => ({
      branchId: branch.id,
      name: branch.name,
      active: true,
      priceOverride: "",
      availabilityOverride: "",
      tracked: false,
      stockCurrent: "",
      minimum: "",
    })),
  };
}

/** @summary Construye un borrador desde el detalle de un producto existente. */
function draftFromDetail(detail: ProductDetail, options: ProductEditorOptions): Draft {
  const base = emptyDraft(options);
  const priceListMap = new Map(detail.priceLists.map((entry) => [entry.channel, entry]));
  const categories = options.categories;
  const categoryId = detail.categoryIds[0] ?? "";
  const primary = categories.find((category) => category.id === Number(categoryId));
  const isSubcategory = primary && primary.parentId !== null;
  const parentId = isSubcategory && primary ? String(primary.parentId) : primary ? String(primary.id) : "";
  const subcategoryId = isSubcategory && primary ? String(primary.id) : "";

  const branchById = new Map(detail.branchAssignments.map((entry) => [entry.branchId, entry]));
  const assignments: BranchDraft[] = options.branches.map((branch) => {
    const existing = branchById.get(branch.id);
    return {
      branchId: branch.id,
      name: branch.name,
      active: existing?.active ?? true,
      priceOverride: existing?.priceOverride ?? "",
      availabilityOverride: existing?.availabilityOverride ?? "",
      tracked: existing?.tracked ?? false,
      stockCurrent: existing?.stockCurrent ?? "",
      minimum: existing?.minimum ?? "",
    };
  });

  return {
    ...base,
    name: detail.name,
    slug: detail.slug,
    description: detail.description,
    availability: detail.availability ?? "disponible",
    price: detail.price ?? "",
    cost: detail.cost ?? "",
    promotionalPrice: detail.promotionalPrice ?? "",
    previousPrice: detail.previousPrice ?? "",
    status: detail.status,
    publishAt: detail.publishAt ?? "",
    imageUrl: detail.imageUrl,
    stationId: detail.stationId ? String(detail.stationId) : "",
    favorite: detail.favorite,
    featured: detail.featured,
    isNew: detail.isNew,
    recommended: detail.recommended,
    vegetarian: detail.vegetarian,
    vegan: detail.vegan,
    glutenFree: detail.glutenFree,
    alcoholFree: detail.alcoholFree,
    spiceLevel: String(detail.spiceLevel),
    preparationMinutes: detail.preparationMinutes !== null ? String(detail.preparationMinutes) : "",
    availableDays: detail.availableDays ?? [],
    availableStartTime: detail.availableStartTime ?? "",
    availableEndTime: detail.availableEndTime ?? "",
    model3dUrl: detail.model3dUrl ?? "",
    usdzUrl: detail.usdzUrl ?? "",
    arEnabled: detail.arEnabled,
    arScale: detail.arScale ?? "1",
    modelWidthCm: detail.modelWidthCm ?? "",
    modelHeightCm: detail.modelHeightCm ?? "",
    modelDepthCm: detail.modelDepthCm ?? "",
    modelOrientation: detail.modelOrientation,
    arPlacement: detail.arPlacement,
    arAllowScale: detail.arAllowScale,
    categoryId: parentId,
    subcategoryId,
    groups: detail.groups.map((group) => ({
      key: uid(),
      kind: group.kind === "extra" ? "extra" : "variant",
      name: group.name,
      required: group.required,
      minSelections: String(group.minSelections),
      maxSelections: String(group.maxSelections),
      items: group.items.map((item) => ({ key: uid(), name: item.name, price: item.price ?? "" })),
    })),
    priceLists: priceChannels.map((channel) => {
      const existing = priceListMap.get(channel);
      return {
        channel,
        price: existing?.price ?? "",
        active: existing?.active ?? false,
        validFrom: existing?.validFrom ?? "",
        validUntil: existing?.validUntil ?? "",
        startTime: existing?.startTime ?? "",
        endTime: existing?.endTime ?? "",
      };
    }),
    comboItems: detail.comboItems.map((item) => ({
      itemProductId: item.itemProductId,
      name: item.itemProductName,
      quantity: item.quantity,
    })),
    recipeIngredients: detail.recipeIngredients.map((item) => ({
      ingredientProductId: item.ingredientProductId,
      name: item.ingredientProductName,
      quantity: item.quantity,
      unit: item.unit,
    })),
    branchAssignments: assignments,
  };
}

/** @summary Cabecera compartida de las secciones del formulario. */
function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-xl font-black">{title}</h2>
      {hint && <p className="mt-1 text-sm text-[var(--admin-muted)]">{hint}</p>}
    </div>
  );
}

/** @summary Editor guiado de productos en un panel modal. */
export function ProductEditor({
  productId,
  options,
  onClose,
  onSaved,
}: {
  productId: number | null;
  options: ProductEditorOptions;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const [draft, setDraft] = useState<Draft | null>(() => (productId === null ? emptyDraft(options) : null));
  const [loading, setLoading] = useState(productId !== null);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (productId === null) return;
    let cancelled = false;
    scopedFetch(`/api/admin/products/${productId}`)
      .then((response) => response.json())
      .then((body) => {
        if (cancelled) return;
        if (body.error) throw new Error(body.error);
        setDraft(draftFromDetail(body.product as ProductDetail, options));
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "No se pudo cargar el producto");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productId, options]);

  /** @summary Actualiza una propiedad simple del borrador. */
  const patch = useCallback((values: Partial<Draft>) => {
    setDraft((current) => (current ? { ...current, ...values } : current));
  }, []);

  const price = draft && draft.price !== "" ? Number(draft.price) : null;
  const cost = draft && draft.cost !== "" ? Number(draft.cost) : null;
  const margin = marginPercent(cost ?? null, price);
  const markup = markupPercent(cost ?? null, price);

  /** @summary Busca productos disponibles para armar combos/recetas. */
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerMode, setPickerMode] = useState<"combo" | "recipe" | null>(null);
  const pickerResults = useMemo(() => {
    const query = pickerSearch.trim().toLocaleLowerCase("es");
    const used =
      pickerMode === "combo"
        ? new Set(draft?.comboItems.map((item) => item.itemProductId) ?? [])
        : new Set(draft?.recipeIngredients.map((item) => item.ingredientProductId) ?? []);
    return options.menuProducts
      .filter((product) => !used.has(product.id))
      .filter((product) => !query || product.name.toLocaleLowerCase("es").includes(query))
      .slice(0, 30);
  }, [pickerSearch, pickerMode, options.menuProducts, draft?.comboItems, draft?.recipeIngredients]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
        <div className="animate-pulse rounded-[1.5rem] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-10 py-8 text-center">
          <p className="text-lg font-bold">Cargando producto…</p>
        </div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-[1.5rem] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
          <p className="font-bold text-rose-400">{error || "No se pudo cargar el producto"}</p>
          <button className="btn btn-secondary mt-4 w-full" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    );
  }

  /** @summary Agrega un ítem al combo o a la receta desde el buscador. */
  const addPicked = (product: { id: number; name: string }) => {
    if (pickerMode === "combo") {
      patch({
        comboItems: [...draft.comboItems, { itemProductId: product.id, name: product.name, quantity: "1" }],
      });
    } else if (pickerMode === "recipe") {
      patch({
        recipeIngredients: [
          ...draft.recipeIngredients,
          { ingredientProductId: product.id, name: product.name, quantity: "1", unit: "unidad" },
        ],
      });
    }
    setPickerMode(null);
    setPickerSearch("");
  };

  /** @summary Arma el payload del guardado y lo envía (alta o actualización). */
  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const selectedCategory = draft.subcategoryId ? Number(draft.subcategoryId) : Number(draft.categoryId);
      const payload = {
        name: draft.name,
        slug: draft.slug,
        description: draft.description,
        availability: draft.availability,
        price: draft.price,
        cost: draft.cost,
        promotionalPrice: draft.promotionalPrice,
        previousPrice: draft.previousPrice,
        status: draft.status,
        publishAt: draft.publishAt,
        imageUrl: draft.imageUrl,
        stationId: draft.stationId,
        favorite: draft.favorite,
        featured: draft.featured,
        isNew: draft.isNew,
        recommended: draft.recommended,
        vegetarian: draft.vegetarian,
        vegan: draft.vegan,
        glutenFree: draft.glutenFree,
        alcoholFree: draft.alcoholFree,
        spiceLevel: draft.spiceLevel,
        preparationMinutes: draft.preparationMinutes,
        availableDays: draft.availableDays,
        availableStartTime: draft.availableStartTime,
        availableEndTime: draft.availableEndTime,
        model3dUrl: draft.model3dUrl,
        usdzUrl: draft.usdzUrl,
        arEnabled: draft.arEnabled,
        arScale: draft.arScale,
        modelWidthCm: draft.modelWidthCm,
        modelHeightCm: draft.modelHeightCm,
        modelDepthCm: draft.modelDepthCm,
        modelOrientation: draft.modelOrientation,
        arPlacement: draft.arPlacement,
        arAllowScale: draft.arAllowScale,
        categoryIds: [selectedCategory].filter(Boolean),
        groups: draft.groups.map((group) => ({
          kind: group.kind,
          name: group.name,
          required: group.required,
          minSelections: group.minSelections,
          maxSelections: group.maxSelections,
          items: group.items.map((item) => ({ name: item.name, price: item.price, active: true })),
        })),
        priceLists: draft.priceLists
          .filter((entry) => entry.price !== "")
          .map((entry) => ({
            channel: entry.channel,
            price: entry.price,
            active: entry.active,
            validFrom: entry.validFrom || null,
            validUntil: entry.validUntil || null,
            startTime: entry.startTime || null,
            endTime: entry.endTime || null,
          })),
        comboItems: draft.comboItems.map((item) => ({
          itemProductId: item.itemProductId,
          quantity: item.quantity,
        })),
        recipeIngredients: draft.recipeIngredients.map((item) => ({
          ingredientProductId: item.ingredientProductId,
          quantity: item.quantity,
          unit: item.unit,
        })),
        branchAssignments: draft.branchAssignments.map((assignment) => ({
          branchId: assignment.branchId,
          active: assignment.active,
          priceOverride: assignment.priceOverride,
          availabilityOverride: assignment.availabilityOverride,
          tracked: assignment.tracked,
          stockCurrent: assignment.stockCurrent,
          minimum: assignment.minimum,
        })),
      };
      const response = await scopedFetch(productId ? `/api/admin/products/${productId}` : "/api/admin/products", {
        method: productId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "No se pudo guardar el producto");
      await Swal.fire({
        title: productId ? "Producto actualizado" : "Producto creado",
        text: "Los cambios ya están en la carta.",
        icon: "success",
        background: "#18181b",
        color: "#fafafa",
        timer: 1800,
        showConfirmButton: false,
      });
      await onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar el producto");
    } finally {
      setSaving(false);
    }
  };

  const parentCategories = options.categories.filter((category) => !category.parentId);
  const subcategories = options.categories.filter((category) => category.parentId === Number(draft.categoryId));

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/70 p-0 backdrop-blur-sm sm:p-4">
      <div
        ref={panelRef}
        className="flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-none border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-2xl sm:rounded-[1.5rem]"
      >
        {/* Cabecera del editor */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-border)] px-5 py-4">
          <div>
            <h2 className="text-2xl font-black">{productId ? "Editar producto" : "Nuevo producto"}</h2>
            <p className="text-sm text-[var(--admin-muted)]">
              {productId ? draft.name : "Completá los pasos en orden; podés guardar en cualquier momento."}
            </p>
          </div>
          <button onClick={onClose} className="btn btn-secondary" disabled={saving}>✕ Cerrar</button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* Pasos */}
          <nav className="flex shrink-0 flex-row gap-1 overflow-x-auto border-b border-[var(--admin-border)] p-3 lg:w-64 lg:flex-col lg:border-b-0 lg:border-r">
            {STEPS.map((label, index) => (
              <button
                key={label}
                onClick={() => setStep(index)}
                className={`shrink-0 rounded-xl px-4 py-2.5 text-left text-sm font-bold transition-colors ${
                  step === index
                    ? "bg-white/10 text-white"
                    : "text-[var(--admin-muted)] hover:bg-white/5"
                }`}
              >
                <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-xs">
                  {index + 1}
                </span>
                {label}
              </button>
            ))}
          </nav>

          {/* Contenido del paso */}
          <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-7">
            {error && (
              <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-300">
                {error}
              </div>
            )}

            {/* PASO 1: Datos básicos */}
            {step === 0 && (
              <div className="space-y-5">
                <SectionTitle
                  title="Lo básico"
                  hint="Nombre, categoría, imagen y estado. Con esto ya podés vender."
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className="block text-sm font-semibold text-[var(--admin-muted)]">Nombre del producto</span>
                    <input
                      className="input"
                      value={draft.name}
                      onChange={(event) => patch({ name: event.target.value })}
                      placeholder="Ej. Café con 2 medialunas"
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="block text-sm font-semibold text-[var(--admin-muted)]">Descripción (lo que ve el cliente)</span>
                    <textarea
                      className="input min-h-20 resize-y"
                      value={draft.description}
                      onChange={(event) => patch({ description: event.target.value })}
                      placeholder="Ej. Café expreso con dos medialunas recién horneadas."
                    />
                  </label>
                  <label className="block">
                    <span className="block text-sm font-semibold text-[var(--admin-muted)]">Categoría de la carta</span>
                    <select
                      className="input"
                      value={draft.categoryId}
                      onChange={(event) => patch({ categoryId: event.target.value, subcategoryId: "" })}
                    >
                      <option value="">Elegí una categoría…</option>
                      {parentCategories.map((category) => (
                        <option key={category.id} value={String(category.id)}>{category.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="block text-sm font-semibold text-[var(--admin-muted)]">Subcategoría (opcional)</span>
                    <select
                      className="input"
                      value={draft.subcategoryId}
                      onChange={(event) => patch({ subcategoryId: event.target.value })}
                      disabled={!draft.categoryId || subcategories.length === 0}
                    >
                      <option value="">Sin subcategoría</option>
                      {subcategories.map((category) => (
                        <option key={category.id} value={String(category.id)}>{category.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="block text-sm font-semibold text-[var(--admin-muted)]">Publicación</span>
                    <select
                      className="input"
                      value={draft.status}
                      onChange={(event) => patch({ status: event.target.value })}
                    >
                      <option value="published">Publicado (visible en la carta)</option>
                      <option value="draft">Borrador (aún no se ve)</option>
                      <option value="scheduled">Programado</option>
                      <option value="hidden">Oculto</option>
                      <option value="archived">Archivado</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="block text-sm font-semibold text-[var(--admin-muted)]">Disponibilidad</span>
                    <select
                      className="input"
                      value={draft.availability}
                      onChange={(event) => patch({ availability: event.target.value })}
                    >
                      <option value="disponible">Disponible</option>
                      <option value="agotado">Agotado</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="block text-sm font-semibold text-[var(--admin-muted)]">Estación de preparación (opcional)</span>
                    <select
                      className="input"
                      value={draft.stationId}
                      onChange={(event) => patch({ stationId: event.target.value })}
                    >
                      <option value="">Sin estación</option>
                      {options.stations.map((station) => (
                        <option key={station.id} value={String(station.id)}>
                          {station.type === "BAR" ? "🍸 " : station.type === "COFFEE" ? "☕ " : "🍳 "}
                          {station.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="block text-sm font-semibold text-[var(--admin-muted)]">Imagen del producto</span>
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={draft.imageUrl ? `/images/images_product/${draft.imageUrl}` : PRODUCT_IMAGE_FALLBACK}
                        alt="Vista previa"
                        className="h-16 w-16 shrink-0 rounded-xl border border-[var(--admin-border)] object-cover"
                      />
                      <input
                        className="input"
                        value={draft.imageUrl}
                        onChange={(event) => patch({ imageUrl: event.target.value })}
                        placeholder="Nombre del archivo cargado en Archivos"
                      />
                    </div>
                  </label>
                </div>

                <div>
                  <span className="block text-sm font-semibold text-[var(--admin-muted)]">Etiquetas y opciones</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[
                      { key: "favorite", label: "★ Favorito (operación/POS)" },
                      { key: "featured", label: "Destacado en la carta" },
                      { key: "isNew", label: "Nuevo" },
                      { key: "recommended", label: "Recomendado" },
                      { key: "vegetarian", label: "Vegetariano" },
                      { key: "vegan", label: "Vegano" },
                      { key: "glutenFree", label: "Sin gluten" },
                      { key: "alcoholFree", label: "Sin alcohol" },
                    ].map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => patch({ [option.key]: !draft[option.key as keyof Draft] } as Partial<Draft>)}
                        className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                          draft[option.key as keyof Draft]
                            ? "bg-pink-500/20 text-pink-300"
                            : "border border-[var(--admin-border)] bg-white/5 text-[var(--admin-muted)]"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="block">
                    <span className="block text-sm font-semibold text-[var(--admin-muted)]">Nivel de picante</span>
                    <select
                      className="input"
                      value={draft.spiceLevel}
                      onChange={(event) => patch({ spiceLevel: event.target.value })}
                    >
                      <option value="0">Sin picante</option>
                      <option value="1">Suave</option>
                      <option value="2">Medio</option>
                      <option value="3">Intenso</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="block text-sm font-semibold text-[var(--admin-muted)]">Preparación estimada (minutos)</span>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      value={draft.preparationMinutes}
                      onChange={(event) => patch({ preparationMinutes: event.target.value })}
                    />
                  </label>
                  <label className="block">
                    <span className="block text-sm font-semibold text-[var(--admin-muted)]">Disponible solo en horario</span>
                    <div className="flex items-center gap-2">
                      <input
                        className="input"
                        type="time"
                        value={draft.availableStartTime}
                        onChange={(event) => patch({ availableStartTime: event.target.value })}
                      />
                      <span className="text-[var(--admin-muted)]">a</span>
                      <input
                        className="input"
                        type="time"
                        value={draft.availableEndTime}
                        onChange={(event) => patch({ availableEndTime: event.target.value })}
                      />
                    </div>
                  </label>
                </div>

                <div>
                  <span className="block text-sm font-semibold text-[var(--admin-muted)]">Días disponibles (vacío = todos)</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {DAY_LABELS.map((day) => {
                      const active = draft.availableDays.includes(day.value);
                      return (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() =>
                            patch({
                              availableDays: active
                                ? draft.availableDays.filter((value) => value !== day.value)
                                : [...draft.availableDays, day.value].sort(),
                            })
                          }
                          className={`w-14 rounded-full px-2 py-2 text-sm font-bold transition-colors ${
                            active
                              ? "bg-pink-500/20 text-pink-300"
                              : "border border-[var(--admin-border)] bg-white/5 text-[var(--admin-muted)]"
                          }`}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* PASO 2: Precio y costos */}
            {step === 1 && (
              <div className="space-y-6">
                <SectionTitle
                  title="Precio y costos"
                  hint="El precio base es el que se usa en la carta. Podés diferenciar por canal y, si cargás el costo, vemos el margen."
                />
                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="block">
                    <span className="block text-sm font-semibold text-[var(--admin-muted)]">Precio de venta</span>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      step="0.01"
                      value={draft.price}
                      onChange={(event) => patch({ price: event.target.value })}
                      placeholder="0"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-sm font-semibold text-[var(--admin-muted)]">Costo (opcional)</span>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      step="0.01"
                      value={draft.cost}
                      onChange={(event) => patch({ cost: event.target.value })}
                      placeholder="0"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-sm font-semibold text-[var(--admin-muted)]">Precio promocional (opcional)</span>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      step="0.01"
                      value={draft.promotionalPrice}
                      onChange={(event) => patch({ promotionalPrice: event.target.value })}
                      placeholder="0"
                    />
                  </label>
                </div>

                {margin !== null && (
                  <div className="flex flex-wrap gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm">
                    <span className="font-bold text-emerald-300">Margen: {margin.toFixed(1)}%</span>
                    <span className="text-[var(--admin-muted)]">
                      Markup sobre costo: {markup !== null ? `${markup.toFixed(1)}%` : "—"}
                    </span>
                    <span className="text-[var(--admin-muted)]">
                      Ganancia por unidad: {((price ?? 0) - (cost ?? 0)).toFixed(2)} {options.currency}
                    </span>
                  </div>
                )}
                {cost !== null && price === null && (
                  <p className="text-sm text-[var(--admin-muted)]">
                    Cargá el precio de venta para ver el margen.
                  </p>
                )}

                <div>
                  <h3 className="mb-3 text-lg font-black">Precios por canal</h3>
                  <p className="mb-4 text-sm text-[var(--admin-muted)]">
                    Si un canal no tiene precio, se usa el precio de venta base.
                  </p>
                  <div className="space-y-3">
                    {draft.priceLists.map((entry) => (
                      <div
                        key={entry.channel}
                        className="rounded-xl border border-[var(--admin-border)] bg-white/[0.02] p-4"
                      >
                        <div className="flex flex-wrap items-center gap-3">
                          <label className="flex items-center gap-2 text-sm font-bold">
                            <input
                              type="checkbox"
                              checked={entry.active}
                              onChange={(event) =>
                                patch({
                                  priceLists: draft.priceLists.map((item) =>
                                    item.channel === entry.channel ? { ...item, active: event.target.checked } : item,
                                  ),
                                })
                              }
                            />
                            {priceChannelLabel[entry.channel as PriceChannel]}
                          </label>
                          <input
                            className="input w-36"
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder="Precio"
                            value={entry.price}
                            onChange={(event) =>
                              patch({
                                priceLists: draft.priceLists.map((item) =>
                                  item.channel === entry.channel ? { ...item, price: event.target.value } : item,
                                ),
                              })
                            }
                          />
                          <input
                            className="input w-40"
                            type="date"
                            value={entry.validFrom}
                            onChange={(event) =>
                              patch({
                                priceLists: draft.priceLists.map((item) =>
                                  item.channel === entry.channel ? { ...item, validFrom: event.target.value } : item,
                                ),
                              })
                            }
                          />
                          <span className="text-xs text-[var(--admin-muted)]">hasta</span>
                          <input
                            className="input w-40"
                            type="date"
                            value={entry.validUntil}
                            onChange={(event) =>
                              patch({
                                priceLists: draft.priceLists.map((item) =>
                                  item.channel === entry.channel ? { ...item, validUntil: event.target.value } : item,
                                ),
                              })
                            }
                          />
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-xs text-[var(--admin-muted)]">
                          <span>Horario (opcional):</span>
                          <input
                            className="input w-32"
                            type="time"
                            value={entry.startTime}
                            onChange={(event) =>
                              patch({
                                priceLists: draft.priceLists.map((item) =>
                                  item.channel === entry.channel ? { ...item, startTime: event.target.value } : item,
                                ),
                              })
                            }
                          />
                          <span>a</span>
                          <input
                            className="input w-32"
                            type="time"
                            value={entry.endTime}
                            onChange={(event) =>
                              patch({
                                priceLists: draft.priceLists.map((item) =>
                                  item.channel === entry.channel ? { ...item, endTime: event.target.value } : item,
                                ),
                              })
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* PASO 3: Sucursales y stock */}
            {step === 2 && (
              <div className="space-y-5">
                <SectionTitle
                  title="Disponibilidad por sucursal"
                  hint="Elegí en qué locales se vende este producto y controlá stock si lo necesitás."
                />
                {draft.branchAssignments.length === 0 && (
                  <p className="text-sm text-[var(--admin-muted)]">
                    No hay sucursales activas para configurar.
                  </p>
                )}
                <div className="space-y-3">
                  {draft.branchAssignments.map((assignment) => (
                    <div
                      key={assignment.branchId}
                      className={`rounded-xl border p-4 transition-colors ${
                        assignment.active
                          ? "border-emerald-500/20 bg-emerald-500/[0.03]"
                          : "border-[var(--admin-border)] bg-white/[0.02] opacity-70"
                      }`}
                    >
                      <label className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={assignment.active}
                            onChange={(event) =>
                              patch({
                                branchAssignments: draft.branchAssignments.map((item) =>
                                  item.branchId === assignment.branchId
                                    ? { ...item, active: event.target.checked }
                                    : item,
                                ),
                              })
                            }
                          />
                          <span className="text-base font-bold">{assignment.name}</span>
                          {assignment.branchId === options.branches[0]?.id && (
                            <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs font-bold text-zinc-300">
                              Principal
                            </span>
                          )}
                        </span>
                      </label>
                      {assignment.active && (
                        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <label className="block">
                            <span className="block text-sm font-semibold text-[var(--admin-muted)]">Precio propio (opcional)</span>
                            <input
                              className="input"
                              type="number"
                              min={0}
                              step="0.01"
                              placeholder="Usa el precio base"
                              value={assignment.priceOverride}
                              onChange={(event) =>
                                patch({
                                  branchAssignments: draft.branchAssignments.map((item) =>
                                    item.branchId === assignment.branchId
                                      ? { ...item, priceOverride: event.target.value }
                                      : item,
                                  ),
                                })
                              }
                            />
                          </label>
                          <label className="block">
                            <span className="block text-sm font-semibold text-[var(--admin-muted)]">Disponibilidad en este local</span>
                            <select
                              className="input"
                              value={assignment.availabilityOverride}
                              onChange={(event) =>
                                patch({
                                  branchAssignments: draft.branchAssignments.map((item) =>
                                    item.branchId === assignment.branchId
                                      ? { ...item, availabilityOverride: event.target.value }
                                      : item,
                                  ),
                                })
                              }
                            >
                              <option value="">Hereda del producto</option>
                              <option value="disponible">Disponible</option>
                              <option value="agotado">Agotado</option>
                            </select>
                          </label>
                          <label className="block sm:col-span-2 lg:col-span-2">
                            <span className="block text-sm font-semibold text-[var(--admin-muted)]">Control de stock</span>
                            <div className="flex flex-wrap items-center gap-3">
                              <label className="flex items-center gap-2 text-sm font-semibold">
                                <input
                                  type="checkbox"
                                  checked={assignment.tracked}
                                  onChange={(event) =>
                                    patch({
                                      branchAssignments: draft.branchAssignments.map((item) =>
                                        item.branchId === assignment.branchId
                                          ? { ...item, tracked: event.target.checked }
                                          : item,
                                      ),
                                    })
                                  }
                                />
                                Controlar existencias
                              </label>
                              {assignment.tracked && (
                                <>
                                  <input
                                    className="input w-28"
                                    type="number"
                                    min={0}
                                    step="0.001"
                                    placeholder="Stock"
                                    value={assignment.stockCurrent}
                                    onChange={(event) =>
                                      patch({
                                        branchAssignments: draft.branchAssignments.map((item) =>
                                          item.branchId === assignment.branchId
                                            ? { ...item, stockCurrent: event.target.value }
                                            : item,
                                        ),
                                      })
                                    }
                                  />
                                  <span className="text-xs text-[var(--admin-muted)]">mínimo</span>
                                  <input
                                    className="input w-28"
                                    type="number"
                                    min={0}
                                    step="0.001"
                                    placeholder="0"
                                    value={assignment.minimum}
                                    onChange={(event) =>
                                      patch({
                                        branchAssignments: draft.branchAssignments.map((item) =>
                                          item.branchId === assignment.branchId
                                            ? { ...item, minimum: event.target.value }
                                            : item,
                                        ),
                                      })
                                    }
                                  />
                                </>
                              )}
                            </div>
                          </label>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PASO 4: Preparación */}
            {step === 3 && (
              <div className="space-y-8">
                <SectionTitle
                  title="Preparación"
                  hint="Tres conceptos distintos: lo que elige el cliente (modificadores), lo que compone el plato (combo) y lo que sale de la cocina (receta)."
                />

                {/* Modificadores */}
                <section>
                  <h3 className="text-lg font-black">1 · Modificadores (elección del cliente)</h3>
                  <p className="mb-3 mt-1 text-sm text-[var(--admin-muted)]">
                    Por ejemplo “Hamburguesa con extras”: el cliente elige tamaño y agrega ingredientes.
                  </p>
                  <div className="space-y-4">
                    {draft.groups.map((group) => (
                      <div key={group.key} className="rounded-xl border border-[var(--admin-border)] bg-white/[0.02] p-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <select
                            className="input w-32"
                            value={group.kind}
                            onChange={(event) =>
                              patch({
                                groups: draft.groups.map((item) =>
                                  item.key === group.key
                                    ? { ...item, kind: event.target.value as "variant" | "extra" }
                                    : item,
                                ),
                              })
                            }
                          >
                            <option value="variant">Elección (variante)</option>
                            <option value="extra">Agregado (extra)</option>
                          </select>
                          <input
                            className="input flex-1"
                            placeholder={group.kind === "variant" ? "Ej. Tamaño" : "Ej. Extras"}
                            value={group.name}
                            onChange={(event) =>
                              patch({
                                groups: draft.groups.map((item) =>
                                  item.key === group.key ? { ...item, name: event.target.value } : item,
                                ),
                              })
                            }
                          />
                          <button
                            type="button"
                            onClick={() => patch({ groups: draft.groups.filter((item) => item.key !== group.key) })}
                            className="btn btn-secondary px-3 py-2 text-sm"
                          >
                            Quitar
                          </button>
                        </div>
                        {group.kind === "variant" && (
                          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={group.required}
                                onChange={(event) =>
                                  patch({
                                    groups: draft.groups.map((item) =>
                                      item.key === group.key ? { ...item, required: event.target.checked } : item,
                                    ),
                                  })
                                }
                              />
                              Obligatoria
                            </label>
                            <label className="flex items-center gap-2">
                              Mínimo
                              <input
                                className="input w-20"
                                type="number"
                                min={0}
                                value={group.minSelections}
                                onChange={(event) =>
                                  patch({
                                    groups: draft.groups.map((item) =>
                                      item.key === group.key ? { ...item, minSelections: event.target.value } : item,
                                    ),
                                  })
                                }
                              />
                            </label>
                            <label className="flex items-center gap-2">
                              Máximo
                              <input
                                className="input w-20"
                                type="number"
                                min={0}
                                value={group.maxSelections}
                                onChange={(event) =>
                                  patch({
                                    groups: draft.groups.map((item) =>
                                      item.key === group.key ? { ...item, maxSelections: event.target.value } : item,
                                    ),
                                  })
                                }
                              />
                            </label>
                          </div>
                        )}
                        <div className="mt-3 space-y-2">
                          {group.items.map((item) => (
                            <div key={item.key} className="flex flex-wrap items-center gap-2">
                              <input
                                className="input flex-1"
                                placeholder={group.kind === "variant" ? "Ej. Grande" : "Ej. Cheddar extra"}
                                value={item.name}
                                onChange={(event) =>
                                  patch({
                                    groups: draft.groups.map((entry) =>
                                      entry.key === group.key
                                        ? {
                                            ...entry,
                                            items: entry.items.map((entryItem) =>
                                              entryItem.key === item.key
                                                ? { ...entryItem, name: event.target.value }
                                                : entryItem,
                                            ),
                                          }
                                        : entry,
                                    ),
                                  })
                                }
                              />
                              <input
                                className="input w-28"
                                type="number"
                                step="0.01"
                                placeholder={group.kind === "variant" ? "Ajuste $" : "Precio $"}
                                value={item.price}
                                onChange={(event) =>
                                  patch({
                                    groups: draft.groups.map((entry) =>
                                      entry.key === group.key
                                        ? {
                                            ...entry,
                                            items: entry.items.map((entryItem) =>
                                              entryItem.key === item.key
                                                ? { ...entryItem, price: event.target.value }
                                                : entryItem,
                                            ),
                                          }
                                        : entry,
                                    ),
                                  })
                                }
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  patch({
                                    groups: draft.groups.map((entry) =>
                                      entry.key === group.key
                                        ? { ...entry, items: entry.items.filter((entryItem) => entryItem.key !== item.key) }
                                        : entry,
                                    ),
                                  })
                                }
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--admin-border)] bg-white/5 text-rose-400 hover:bg-white/10"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() =>
                              patch({
                                groups: draft.groups.map((entry) =>
                                  entry.key === group.key
                                    ? { ...entry, items: [...entry.items, { key: uid(), name: "", price: "" }] }
                                    : entry,
                                ),
                              })
                            }
                            className="btn btn-secondary px-3 py-1.5 text-sm"
                          >
                            + Agregar opción
                          </button>
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        patch({
                          groups: [
                            ...draft.groups,
                            {
                              key: uid(),
                              kind: "variant",
                              name: "",
                              required: false,
                              minSelections: "0",
                              maxSelections: "1",
                              items: [{ key: uid(), name: "", price: "" }],
                            },
                          ],
                        })
                      }
                      className="btn"
                    >
                      + Nuevo grupo de modificadores
                    </button>
                  </div>
                </section>

                {/* Combo */}
                <section>
                  <h3 className="text-lg font-black">2 · Combo (productos asociados)</h3>
                  <p className="mb-3 mt-1 text-sm text-[var(--admin-muted)]">
                    Composición fija con otros productos vendibles. Ejemplo: “Combo hamburguesa” incluye hamburguesa + papas + gaseosa.
                  </p>
                  {draft.comboItems.length > 0 && (
                    <div className="mb-3 space-y-2">
                      {draft.comboItems.map((item) => (
                        <div key={item.itemProductId} className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--admin-border)] bg-white/[0.02] px-3 py-2">
                          <span className="flex-1 font-semibold">{item.name}</span>
                          <input
                            className="input w-20"
                            type="number"
                            min={0.001}
                            step="0.001"
                            value={item.quantity}
                            onChange={(event) =>
                              patch({
                                comboItems: draft.comboItems.map((entry) =>
                                  entry.itemProductId === item.itemProductId
                                    ? { ...entry, quantity: event.target.value }
                                    : entry,
                                ),
                              })
                            }
                            aria-label={`Cantidad de ${item.name}`}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              patch({ comboItems: draft.comboItems.filter((entry) => entry.itemProductId !== item.itemProductId) })
                            }
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--admin-border)] bg-white/5 text-rose-400 hover:bg-white/10"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button type="button" className="btn btn-secondary" onClick={() => { setPickerMode("combo"); setPickerSearch(""); }}>
                    + Agregar producto al combo
                  </button>
                  {indexNote(draft.comboItems, "combo")}
                </section>

                {/* Receta */}
                <section>
                  <h3 className="text-lg font-black">3 · Receta (ingredientes)</h3>
                  <p className="mb-3 mt-1 text-sm text-[var(--admin-muted)]">
                    Los ingredientes son productos con stock. Ejemplo: “Pizza con receta” consume masa, muzzarella y salsa.
                  </p>
                  {draft.recipeIngredients.length > 0 && (
                    <div className="mb-3 space-y-2">
                      {draft.recipeIngredients.map((item) => (
                        <div key={item.ingredientProductId} className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--admin-border)] bg-white/[0.02] px-3 py-2">
                          <span className="flex-1 font-semibold">{item.name}</span>
                          <input
                            className="input w-20"
                            type="number"
                            min={0.001}
                            step="0.001"
                            value={item.quantity}
                            onChange={(event) =>
                              patch({
                                recipeIngredients: draft.recipeIngredients.map((entry) =>
                                  entry.ingredientProductId === item.ingredientProductId
                                    ? { ...entry, quantity: event.target.value }
                                    : entry,
                                ),
                              })
                            }
                            aria-label={`Cantidad de ${item.name}`}
                          />
                          <select
                            className="input w-32"
                            value={item.unit}
                            onChange={(event) =>
                              patch({
                                recipeIngredients: draft.recipeIngredients.map((entry) =>
                                  entry.ingredientProductId === item.ingredientProductId
                                    ? { ...entry, unit: event.target.value }
                                    : entry,
                                ),
                              })
                            }
                          >
                            {RECIPE_UNITS.map((unit) => (
                              <option key={unit} value={unit}>{unit}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() =>
                              patch({
                                recipeIngredients: draft.recipeIngredients.filter(
                                  (entry) => entry.ingredientProductId !== item.ingredientProductId,
                                ),
                              })
                            }
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--admin-border)] bg-white/5 text-rose-400 hover:bg-white/10"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button type="button" className="btn btn-secondary" onClick={() => { setPickerMode("recipe"); setPickerSearch(""); }}>
                    + Agregar ingrediente
                  </button>
                </section>
              </div>
            )}

            {/* PASO 5: Imagen y 3D/AR */}
            {step === 4 && (
              <div className="space-y-6">
                <SectionTitle
                  title="Imagen y experiencia 3D"
                  hint="La imagen se muestra en la carta. Los modelos 3D y AR se cargan desde Archivos y aparecen en el detalle del producto."
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className="block text-sm font-semibold text-[var(--admin-muted)]">Modelo principal (GLB o GLTF)</span>
                    <input
                      className="input"
                      value={draft.model3dUrl}
                      onChange={(event) => patch({ model3dUrl: event.target.value })}
                      placeholder="models/{id}/products/archivo.glb"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-sm font-semibold text-[var(--admin-muted)]">Modelo USDZ para iPhone (opcional)</span>
                    <input
                      className="input"
                      value={draft.usdzUrl}
                      onChange={(event) => patch({ usdzUrl: event.target.value })}
                      placeholder="models/{id}/products/archivo.usdz"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-sm font-semibold text-[var(--admin-muted)]">Escala inicial</span>
                    <input
                      className="input"
                      type="number"
                      min={0.01}
                      max={20}
                      step={0.01}
                      value={draft.arScale}
                      onChange={(event) => patch({ arScale: event.target.value })}
                    />
                  </label>
                  <label className="block">
                    <span className="block text-sm font-semibold text-[var(--admin-muted)]">Ancho real (cm)</span>
                    <input
                      className="input"
                      type="number"
                      min={0.1}
                      max={1000}
                      step={0.1}
                      value={draft.modelWidthCm}
                      onChange={(event) => patch({ modelWidthCm: event.target.value })}
                    />
                  </label>
                  <label className="block">
                    <span className="block text-sm font-semibold text-[var(--admin-muted)]">Alto real (cm)</span>
                    <input
                      className="input"
                      type="number"
                      min={0.1}
                      max={1000}
                      step={0.1}
                      value={draft.modelHeightCm}
                      onChange={(event) => patch({ modelHeightCm: event.target.value })}
                    />
                  </label>
                  <label className="block">
                    <span className="block text-sm font-semibold text-[var(--admin-muted)]">Profundidad real (cm)</span>
                    <input
                      className="input"
                      type="number"
                      min={0.1}
                      max={1000}
                      step={0.1}
                      value={draft.modelDepthCm}
                      onChange={(event) => patch({ modelDepthCm: event.target.value })}
                    />
                  </label>
                  <label className="block">
                    <span className="block text-sm font-semibold text-[var(--admin-muted)]">Rotación inicial</span>
                    <input
                      className="input"
                      value={draft.modelOrientation}
                      onChange={(event) => patch({ modelOrientation: event.target.value })}
                      placeholder="0deg 0deg 0deg"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-sm font-semibold text-[var(--admin-muted)]">Superficie de colocación</span>
                    <select
                      className="input"
                      value={draft.arPlacement}
                      onChange={(event) => patch({ arPlacement: event.target.value })}
                    >
                      <option value="floor">Horizontal, como una mesa</option>
                      <option value="wall">Vertical, como una pared</option>
                    </select>
                  </label>
                  <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
                    <label className="flex items-center gap-2 text-sm font-semibold">
                      <input
                        type="checkbox"
                        checked={draft.arEnabled}
                        onChange={(event) => patch({ arEnabled: event.target.checked })}
                      />
                      Habilitar experiencia 3D y AR
                    </label>
                    <label className="flex items-center gap-2 text-sm font-semibold">
                      <input
                        type="checkbox"
                        checked={draft.arAllowScale}
                        onChange={(event) => patch({ arAllowScale: event.target.checked })}
                      />
                      Permitir ajustar tamaño en AR
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Pie con navegación y guardado */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--admin-border)] px-5 py-4">
          <div className="flex gap-2">
            <button className="btn btn-secondary" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0 || saving}>
              ← Anterior
            </button>
            {step < STEPS.length - 1 && (
              <button className="btn" onClick={() => setStep((value) => Math.min(STEPS.length - 1, value + 1))} disabled={saving}>
                Siguiente →
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
            <button className="btn" onClick={save} disabled={saving}>
              {saving ? "Guardando…" : productId ? "Guardar cambios" : "Crear producto"}
            </button>
          </div>
        </div>
      </div>

      {/* Buscador de productos para combos/recetas */}
      {pickerMode !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[1.5rem] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-2xl">
            <h3 className="text-lg font-black">
              {pickerMode === "combo" ? "Agregar producto al combo" : "Agregar ingrediente a la receta"}
            </h3>
            <input
              className="input mt-3"
              autoFocus
              value={pickerSearch}
              onChange={(event) => setPickerSearch(event.target.value)}
              placeholder="Buscar por nombre…"
            />
            <div className="mt-3 max-h-72 space-y-1 overflow-y-auto">
              {pickerResults.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-white/5"
                  onClick={() => addPicked(product)}
                >
                  <span className="font-semibold">{product.name}</span>
                  <span className="text-sm text-[var(--admin-muted)]">
                    {product.price !== null ? `${product.price} ${options.currency}` : ""}
                  </span>
                </button>
              ))}
              {pickerResults.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-[var(--admin-muted)]">
                  No se encontraron productos.
                </p>
              )}
            </div>
            <button className="btn btn-secondary mt-4 w-full" onClick={() => setPickerMode(null)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** @summary Nota breve de contexto en la sección de combos/recetas. */
function indexNote(items: Array<{ quantity: string }>, kind: "combo" | "recipe") {
  if (items.length === 0) return null;
  const total = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  return (
    <p className="mt-2 text-xs text-[var(--admin-muted)]">
      {items.length} {kind === "combo" ? "productos en el combo" : "ingredientes en la receta"} · {total.toFixed(2)} unidades en total
    </p>
  );
}
