"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { ProductEditor } from "@/components/admin/product-editor";
import { PageHeader, SearchBox, StatusBadge, ActionMenu, EmptyState, ActiveFilterChip } from "@/components/admin/ui";
import { scopedFetch } from "@/lib/client-routing";
import { handleImageError, productImageSrc } from "@/lib/image-fallback";
import { marginPercent } from "@/lib/product-catalog";
import { useViewMode, ViewModeToggle } from "@/components/admin/view-mode-toggle";
import type { ProductCatalogPayload, CatalogProductRow } from "@/lib/product-catalog-data";
import { Icon } from "@/components/admin/ui/icons";

/**
 * Gestor visual del catálogo de productos de MenuClick.
 *
 * Dos modos de trabajo: Tarjetas (catálogo visual para gestión de carta) y
 * Lista (tabla para administración masiva y escaneo rápido). La búsqueda,
 * el orden y los filtros (rápidos, por columna y avanzados) son compartidos
 * por ambas vistas. El stock, el costo y la preparación son resúmenes reales
 * de Inventario/Ingredientes/Recetas, nunca fuentes duplicadas.
 */

/** @summary Ejecuta una petición de API y devuelve el cuerpo parseado o lanza el error del servidor. */
async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await scopedFetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body?.error ?? "No se pudo completar la operación");
  return body;
}

/** @summary Muestra un error de operación en el panel sin romper la pantalla. */
async function showError(title: string, reason: unknown) {
  await Swal.fire({
    title,
    text: reason instanceof Error ? reason.message : "Intentá nuevamente.",
    icon: "error",
    background: "#18181b",
    color: "#fafafa",
  });
}

const statusLabels: Record<string, string> = {
  published: "Publicado",
  scheduled: "Programado",
  draft: "Borrador",
  hidden: "Oculto",
  archived: "Archivado",
};

const sortOptions: Array<{ key: SortKey; label: string }> = [
  { key: "name-asc", label: "Nombre A → Z" },
  { key: "name-desc", label: "Nombre Z → A" },
  { key: "price-asc", label: "Precio (menor a mayor)" },
  { key: "price-desc", label: "Precio (mayor a menor)" },
  { key: "cost-asc", label: "Costo (menor a mayor)" },
  { key: "cost-desc", label: "Costo (mayor a menor)" },
  { key: "margin-asc", label: "Margen (menor a mayor)" },
  { key: "margin-desc", label: "Margen (mayor a menor)" },
  { key: "stock-asc", label: "Stock (menor a mayor)" },
  { key: "stock-desc", label: "Stock (mayor a menor)" },
  { key: "recent", label: "Más recientes" },
  { key: "category", label: "Categoría" },
];

type SortKey =
  | "name-asc" | "name-desc" | "price-asc" | "price-desc" | "cost-asc" | "cost-desc"
  | "margin-asc" | "margin-desc" | "stock-asc" | "stock-desc" | "recent" | "category";

type Filters = {
  categoryId: string;
  subcategoryId: string;
  status: string;
  favorite: "any" | "yes" | "no";
  availability: "any" | "disponible" | "agotado";
  stock: "any" | "out" | "low" | "in";
  branchId: string;
  priceMin: string;
  priceMax: string;
  costMin: string;
  costMax: string;
  margin: "any" | "no-cost" | "negative" | "0-20" | "20-40" | "40+";
  recipe: "any" | "yes" | "no";
  combo: "any" | "yes" | "no";
  modifiers: "any" | "yes" | "no";
  image: "any" | "yes" | "no";
  model3d: "any" | "yes" | "no";
  channelPrices: "any" | "yes";
  stationId: string;
};

type ColumnKey = "search" | "price" | "margin" | "stock" | "availability" | "branches" | "status";

const emptyFilters: Filters = {
  categoryId: "",
  subcategoryId: "",
  status: "",
  favorite: "any",
  availability: "any",
  stock: "any",
  branchId: "",
  priceMin: "",
  priceMax: "",
  costMin: "",
  costMax: "",
  margin: "any",
  recipe: "any",
  combo: "any",
  modifiers: "any",
  image: "any",
  model3d: "any",
  channelPrices: "any",
  stationId: "",
};

/** @summary Formatea un importe con el símbolo de la moneda configurada. */
function money(value: string | number | null | undefined, currency: string) {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 2 }).format(number);
}

/** @summary Estado de stock de la fila según la sucursal activa. */
function stockState(product: CatalogProductRow): "out" | "low" | "in" | null {
  if (!product.tracked || product.stock === null) return null;
  const current = Number(product.stock);
  if (current <= 0) return "out";
  if (current <= Number(product.minimum ?? 0)) return "low";
  return "in";
}

/** @summary Tablero del catálogo con vista Lista/Tarjetas, filtros y acciones de operación. */
export function ProductCatalogBoard({ initial }: { initial: ProductCatalogPayload }) {
  const [payload, setPayload] = useState<ProductCatalogPayload>(initial);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [columnFilter, setColumnFilter] = useState<ColumnKey | null>(null);
  const [sort, setSort] = useState<SortKey>("name-asc");
  const [view, setView] = useViewMode("productos");
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  const isListView = view === "list" || view === "list-compact";
  const isCardsView = view === "cards" || view === "cards-compact";
  const compactCards = view === "cards-compact";
  const effectiveDensity: "comfortable" | "compact" = view === "list-compact" ? "compact" : density;
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("productos:density");
      if (stored === "compact" || stored === "comfortable") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDensity(stored);
      }
    } catch {
      /* almacenamiento no disponible */
    }
  }, []);
  const applyDensity = useCallback((next: "comfortable" | "compact") => {
    setDensity(next);
    try {
      window.localStorage.setItem("productos:density", next);
    } catch {
      /* almacenamiento no disponible */
    }
  }, []);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editingId, setEditingId] = useState<number | null | "new">(null);

  const currency = payload.currency ?? "ARS";

  /** @summary Refresca el listado desde el servidor conservando el estado de la pantalla. */
  const refresh = useCallback(async () => {
    try {
      const body = await api<{ payload: ProductCatalogPayload }>("/api/admin/products");
      setPayload(body.payload);
    } catch (reason) {
      await showError("No se pudo actualizar el listado", reason);
    }
  }, []);

  const categoryGroups = useMemo(() => {
    const parents = payload.categories.filter((category) => !category.parentId);
    const children = payload.categories.filter((category) => category.parentId);
    return parents.map((parent) => ({
      ...parent,
      children: children.filter((child) => child.parentId === parent.id),
    }));
  }, [payload.categories]);

  /** @summary Aplica la búsqueda y todos los filtros sobre el listado. */
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es");
    const numberOr = (value: string) => {
      const parsed = Number(value);
      return value.trim() === "" || !Number.isFinite(parsed) ? null : parsed;
    };
    const priceMin = numberOr(filters.priceMin);
    const priceMax = numberOr(filters.priceMax);
    const costMin = numberOr(filters.costMin);
    const costMax = numberOr(filters.costMax);

    return payload.products.filter((product) => {
      if (
        query &&
        !`${product.name} ${product.description} ${product.slug} ${product.categoryBreadcrumb}`
          .toLocaleLowerCase("es")
          .includes(query)
      )
        return false;
      if (filters.status && product.status !== filters.status) return false;
      if (filters.favorite === "yes" && !product.favorite) return false;
      if (filters.favorite === "no" && product.favorite) return false;
      if (filters.availability !== "any" && product.availability !== filters.availability) return false;
      const stock = stockState(product);
      if (filters.stock === "out" && stock !== "out") return false;
      if (filters.stock === "low" && stock !== "low") return false;
      if (filters.stock === "in" && stock !== "in") return false;
      if (filters.branchId && !product.branchIds.includes(Number(filters.branchId))) return false;
      if (filters.categoryId || filters.subcategoryId) {
        const matchesParent =
          filters.categoryId &&
          (String(product.categoryId) === filters.categoryId ||
            String(product.parentCategoryId) === filters.categoryId);
        const matchesChild = filters.subcategoryId && String(product.categoryId) === filters.subcategoryId;
        if (!matchesParent && !matchesChild) return false;
      }
      if (priceMin !== null && (product.price === null || Number(product.price) < priceMin)) return false;
      if (priceMax !== null && (product.price === null || Number(product.price) > priceMax)) return false;
      if (costMin !== null && (product.cost === null || Number(product.cost) < costMin)) return false;
      if (costMax !== null && (product.cost === null || Number(product.cost) > costMax)) return false;
      if (filters.margin !== "any") {
        const margin = product.margin;
        if (filters.margin === "no-cost" && margin !== null) return false;
        if (filters.margin === "negative" && (margin === null || margin >= 0)) return false;
        if (filters.margin === "0-20" && (margin === null || margin < 0 || margin >= 20)) return false;
        if (filters.margin === "20-40" && (margin === null || margin < 20 || margin >= 40)) return false;
        if (filters.margin === "40+" && (margin === null || margin < 40)) return false;
      }
      if (filters.recipe === "yes" && !product.hasRecipe) return false;
      if (filters.recipe === "no" && product.hasRecipe) return false;
      if (filters.combo === "yes" && !product.hasCombo) return false;
      if (filters.combo === "no" && product.hasCombo) return false;
      if (filters.modifiers === "yes" && !product.hasModifiers) return false;
      if (filters.modifiers === "no" && product.hasModifiers) return false;
      if (filters.image === "yes" && !product.hasImage) return false;
      if (filters.image === "no" && product.hasImage) return false;
      if (filters.model3d === "yes" && !product.hasModel3d && !product.arEnabled) return false;
      if (filters.model3d === "no" && (product.hasModel3d || product.arEnabled)) return false;
      if (filters.channelPrices === "yes" && !product.hasChannelPrices) return false;
      if (filters.stationId && String(product.stationId ?? "") !== filters.stationId) return false;
      return true;
    });
  }, [payload.products, search, filters]);

  /** @summary Ordena el listado filtrado según la opción elegida. */
  const sorted = useMemo(() => {
    const rows = [...filtered];
    const number = (value: string | null) => (value === null ? Number.NEGATIVE_INFINITY : Number(value));
    switch (sort) {
      case "name-asc":
        rows.sort((a, b) => a.name.localeCompare(b.name, "es"));
        break;
      case "name-desc":
        rows.sort((a, b) => b.name.localeCompare(a.name, "es"));
        break;
      case "price-asc":
        rows.sort((a, b) => number(a.price) - number(b.price));
        break;
      case "price-desc":
        rows.sort((a, b) => number(b.price) - number(a.price));
        break;
      case "cost-asc":
        rows.sort((a, b) => number(a.cost) - number(b.cost));
        break;
      case "cost-desc":
        rows.sort((a, b) => number(b.cost) - number(a.cost));
        break;
      case "margin-asc":
        rows.sort((a, b) => (a.margin ?? -Infinity) - (b.margin ?? -Infinity));
        break;
      case "margin-desc":
        rows.sort((a, b) => (b.margin ?? -Infinity) - (a.margin ?? -Infinity));
        break;
      case "stock-asc":
        rows.sort((a, b) => number(a.stock) - number(b.stock));
        break;
      case "stock-desc":
        rows.sort((a, b) => number(b.stock) - number(a.stock));
        break;
      case "recent":
        rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        break;
      case "category":
        rows.sort((a, b) => a.categoryBreadcrumb.localeCompare(b.categoryBreadcrumb, "es"));
        break;
      default:
        break;
    }
    return rows;
  }, [filtered, sort]);

  const activeFilterCount = useMemo(() => {
    const entries = Object.entries(filters);
    let count = 0;
    for (const [key, value] of entries) {
      if (key === "favorite" || key === "availability" || key === "stock" || key === "margin" || key === "recipe" || key === "combo" || key === "modifiers" || key === "image" || key === "model3d" || key === "channelPrices") {
        if (value !== "any") count += 1;
      } else if (value !== "") {
        count += 1;
      }
    }
    return count;
  }, [filters]);

  const hasActiveFilters = activeFilterCount > 0;

  const allSelected = sorted.length > 0 && sorted.every((product) => selected.has(product.id));

  const toggleAll = () => {
    setSelected((current) => {
      const next = new Set(current);
      if (allSelected) {
        for (const product of sorted) next.delete(product.id);
      } else {
        for (const product of sorted) next.add(product.id);
      }
      return next;
    });
  };

  const toggleOne = (id: number) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearFilters = () => {
    setFilters(emptyFilters);
    setSearch("");
  };

  /** @summary Marca o desmarca un favorito sin abrir el editor. */
  const toggleFavorite = async (product: CatalogProductRow) => {
    setBusy(true);
    try {
      await api("/api/admin/products/bulk", {
        method: "POST",
        body: JSON.stringify({ action: product.favorite ? "unfavorite" : "favorite", ids: [product.id] }),
      });
      await refresh();
    } catch (reason) {
      await showError("No se pudo actualizar el favorito", reason);
    } finally {
      setBusy(false);
    }
  };

  /** @summary Duplica un producto de forma segura (queda en borrador). */
  const duplicate = async (product: CatalogProductRow) => {
    setBusy(true);
    try {
      await api(`/api/admin/products/${product.id}/duplicate`, { method: "POST" });
      await Swal.fire({
        title: "Producto duplicado",
        text: "La copia quedó en borrador para que la revises antes de publicar.",
        icon: "success",
        background: "#18181b",
        color: "#fafafa",
        timer: 2200,
        showConfirmButton: false,
      });
      await refresh();
    } catch (reason) {
      await showError("No se pudo duplicar el producto", reason);
    } finally {
      setBusy(false);
    }
  };

  /** @summary Cambia el estado editorial de un producto desde el menú de la tarjeta. */
  const changeStatus = async (product: CatalogProductRow, status: string) => {
    if (status === product.status) return;
    setBusy(true);
    try {
      const map: Record<string, string> = { published: "publish", draft: "draft", hidden: "hide", archived: "archive" };
      await api("/api/admin/products/bulk", {
        method: "POST",
        body: JSON.stringify({ action: map[status] ?? "draft", ids: [product.id] }),
      });
      await refresh();
    } catch (reason) {
      await showError("No se pudo cambiar el estado", reason);
    } finally {
      setBusy(false);
    }
  };

  /** @summary Elimina productos (por sucursal activa o maestros) con confirmación. */
  const removeMany = async (ids: number[], confirmText: string) => {
    const result = await Swal.fire({
      title: "¿Eliminar?",
      text: confirmText,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      background: "#18181b",
      color: "#fafafa",
      confirmButtonColor: "#dc2626",
    });
    if (!result.isConfirmed) return;
    setBusy(true);
    try {
      await api("/api/admin/products/bulk", {
        method: "POST",
        body: JSON.stringify({ action: "delete", ids }),
      });
      setSelected((current) => {
        const next = new Set(current);
        for (const id of ids) next.delete(id);
        return next;
      });
      await refresh();
    } catch (reason) {
      await showError("No se pudo eliminar", reason);
    } finally {
      setBusy(false);
    }
  };

  /** @summary Aplica una acción masiva sobre la selección actual. */
  const runBulkAction = async (action: string) => {
    const ids = [...selected];
    if (!ids.length) return;
    if (action === "delete") {
      await removeMany(
        ids,
        payload.activeBranch
          ? "Se quitará la publicación de estos productos en la sucursal actual."
          : "Se eliminarán estos productos de la carta para siempre. Esta acción no se puede deshacer.",
      );
      return;
    }
    setBusy(true);
    try {
      await api("/api/admin/products/bulk", { method: "POST", body: JSON.stringify({ action, ids }) });
      await refresh();
    } catch (reason) {
      await showError("No se pudo completar la acción", reason);
    } finally {
      setBusy(false);
    }
  };

  const patch = (changes: Partial<Filters>) => setFilters((current) => ({ ...current, ...changes }));

  return (
    <div>
      <PageHeader
        eyebrow="Carta"
        title="Productos"
        section="productos"
        description="Administrá catálogo, precios, costo, stock y preparación."
        actions={
          <button onClick={() => setEditingId("new")} className="btn" disabled={busy}>
            + Nuevo producto
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 shadow-lg shadow-black/10 print:hidden">
        <div className="relative min-w-[200px] flex-1">
          <SearchBox value={search} onChange={setSearch} placeholder="Buscar productos…" />
        </div>
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          className={`shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-zinc-300 transition-colors hover:bg-white/10 ${hasActiveFilters ? "ring-1 ring-pink-500/50" : ""}`}
        >
          Filtros{hasActiveFilters ? ` (${activeFilterCount})` : ""}
        </button>
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value as SortKey)}
          className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-zinc-300"
          aria-label="Ordenar"
        >
          {sortOptions.map((option) => (
            <option key={option.key} value={option.key}>{option.label}</option>
          ))}
        </select>
        <ViewModeToggle value={view} onChange={setView} />
        {isListView && (
          <select
            value={density}
            onChange={(event) => applyDensity(event.target.value as "comfortable" | "compact")}
            className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-zinc-300"
            aria-label="Densidad"
          >
            <option value="comfortable">Cómoda</option>
            <option value="compact">Compacta</option>
          </select>
        )}
      </div>

      {/* Filtros rápidos */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {([
          { key: "favorite", label: "Favoritos", active: filters.favorite === "yes", onClick: () => patch({ favorite: filters.favorite === "yes" ? "any" : "yes" }) },
          { key: "availability", label: "Disponible", active: filters.availability === "disponible", onClick: () => patch({ availability: filters.availability === "disponible" ? "any" : "disponible" }) },
          { key: "agotado", label: "Agotado", active: filters.availability === "agotado", onClick: () => patch({ availability: filters.availability === "agotado" ? "any" : "agotado" }) },
          { key: "stock-low", label: "Bajo stock", active: filters.stock === "low", onClick: () => patch({ stock: filters.stock === "low" ? "any" : "low" }) },
          { key: "stock-out", label: "Sin stock", active: filters.stock === "out", onClick: () => patch({ stock: filters.stock === "out" ? "any" : "out" }) },
        ].map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={chip.onClick}
            className={`rounded-full px-3.5 py-1.5 text-sm font-bold transition-colors ${
              chip.active
                ? "bg-pink-500/20 text-pink-300 ring-1 ring-pink-500/40"
                : "border border-[var(--admin-border)] bg-white/5 text-[var(--admin-muted)] hover:bg-white/10"
            }`}
          >
            {chip.label}
          </button>
        )))}
        <span className="ml-auto text-sm text-[var(--admin-muted)]">
          {sorted.length} producto{sorted.length === 1 ? "" : "s"}
          {payload.activeBranch ? ` · ${payload.activeBranch.name}` : ""}
        </span>
      </div>

      {/* Chips de filtros avanzados activos */}
      {hasActiveFilters && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {buildFilterChips(filters, payload, patch, () => setFiltersOpen(true)).map((chip) => (
            <ActiveFilterChip key={chip.label} label={chip.label} onRemove={chip.onRemove} />
          ))}
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-full px-3 py-1 text-xs font-bold text-pink-300 underline-offset-2 hover:underline"
          >
            Limpiar filtros
          </button>
        </div>
      )}

      {/* Toolbar de selección masiva (contextual) */}
      {selected.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-[1.25rem] border border-pink-500/30 bg-pink-500/[0.06] px-4 py-2.5">
          <span className="text-sm font-black text-pink-300">{selected.size} seleccionados</span>
          <span className="mx-1 h-4 w-px bg-white/10" aria-hidden />
          <select
            className="input w-auto py-1.5 text-xs"
            value=""
            aria-label="Cambiar estado"
            onChange={(event) => {
              if (event.target.value) void runBulkAction(event.target.value);
            }}
          >
            <option value="">Estado…</option>
            <option value="publish">Publicar</option>
            <option value="draft">Pasar a borrador</option>
            <option value="hide">Ocultar</option>
            <option value="archive">Archivar</option>
          </select>
          <select
            className="input w-auto py-1.5 text-xs"
            value=""
            aria-label="Acciones de favorito"
            onChange={(event) => {
              if (event.target.value) void runBulkAction(event.target.value);
            }}
          >
            <option value="">Favorito…</option>
            <option value="favorite">Marcar favorito</option>
            <option value="unfavorite">Quitar favorito</option>
          </select>
          {payload.activeBranch && (
            <select
              className="input w-auto py-1.5 text-xs"
              value=""
              aria-label="Publicación en sucursal"
              onChange={(event) => {
                if (event.target.value) void runBulkAction(event.target.value);
              }}
            >
              <option value="">Sucursal…</option>
              <option value="activateBranch">Publicar en esta sucursal</option>
              <option value="deactivateBranch">Quitar de esta sucursal</option>
            </select>
          )}
          <button
            type="button"
            onClick={() => void runBulkAction("delete")}
            className="rounded-lg px-3 py-1.5 text-xs font-bold text-rose-400 transition-colors hover:bg-rose-500/10"
          >
            Eliminar
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto rounded-lg px-2 py-1.5 text-xs font-bold text-zinc-400 hover:text-white"
          >
            Quitar selección
          </button>
        </div>
      )}

      {/* Contenido: Tarjetas o Lista */}
      {sorted.length === 0 ? (
        <EmptyState
          title={payload.products.length > 0 ? "No encontramos productos con estos filtros" : "Todavía no tenés productos"}
          description={payload.products.length > 0 ? "Probá quitar algún filtro o cambiar la búsqueda." : "Creá el primero para comenzar a armar tu carta."}
          action={
            <button type="button" className={payload.products.length > 0 ? "btn btn-secondary" : "btn"} onClick={payload.products.length > 0 ? clearFilters : () => setEditingId("new")}>
              {payload.products.length > 0 ? "Limpiar filtros" : "+ Nuevo producto"}
            </button>
          }
        />
      ) : isCardsView ? (
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 ${compactCards ? "gap-2.5" : "gap-4"}`}>
          {sorted.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              currency={currency}
              selected={selected.has(product.id)}
              onToggleSelect={() => toggleOne(product.id)}
              onEdit={() => setEditingId(product.id)}
              onToggleFavorite={() => void toggleFavorite(product)}
              onDuplicate={() => void duplicate(product)}
              onChangeStatus={(status) => void changeStatus(product, status)}
              onRemove={() => void removeMany([product.id], `Se eliminará "${product.name}".`)}
            />
          ))}
        </div>
      ) : (
        <ListTable
          products={sorted}
          currency={currency}
          density={effectiveDensity}
          selected={selected}
          allSelected={allSelected}
          onToggleAll={toggleAll}
          onToggleOne={toggleOne}
          sort={sort}
          onSort={setSort}
          filters={filters}
          onPatchFilters={patch}
          columnFilter={columnFilter}
          onColumnFilter={setColumnFilter}
          categoryGroups={categoryGroups}
          activeBranchId={payload.activeBranch?.id ?? null}
          branches={payload.branches}
          onEdit={(id) => setEditingId(id)}
          onToggleFavorite={(product) => void toggleFavorite(product)}
          onDuplicate={(product) => void duplicate(product)}
          onRemove={(product) => void removeMany([product.id], `Se eliminará “${product.name}”.`)}
        />
      )}

      <p className="mt-4 text-sm text-[var(--admin-muted)]">
        {sorted.length} productos ·{" "}
        {payload.activeBranch ? `Viendo la carta de ${payload.activeBranch.name}` : "Viendo todas las sucursales"}
        {priceSummary(sorted, currency)}
      </p>

      {/* Drawer de filtros avanzados */}
      {filtersOpen && (
        <FilterDrawer
          filters={filters}
          onPatch={patch}
          categoryGroups={categoryGroups}
          stations={payload.stations}
          branches={payload.branches}
          activeBranchId={payload.activeBranch?.id ?? null}
          onClose={() => setFiltersOpen(false)}
          onClear={() => {
            clearFilters();
            setFiltersOpen(false);
          }}
        />
      )}

      {editingId !== null && (
        <ProductEditor
          productId={editingId === "new" ? null : editingId}
          options={{
            categories: payload.categories,
            branches: payload.branches,
            stations: payload.stations,
            menuProducts: payload.menuProducts,
            currency,
          }}
          onClose={() => setEditingId(null)}
          onSaved={async () => {
            setEditingId(null);
            await refresh();
          }}
        />
      )}
    </div>
  );
}

/** @summary Convierte los filtros activos en chips removibles. */
function buildFilterChips(
  filters: Filters,
  payload: ProductCatalogPayload,
  patch: (changes: Partial<Filters>) => void,
  openDrawer: () => void,
) {
  const chips: Array<{ label: string; onRemove: () => void }> = [];
  const category = payload.categories.find((entry) => String(entry.id) === filters.categoryId);
  const subcategory = payload.categories.find((entry) => String(entry.id) === filters.subcategoryId);
  const station = payload.stations.find((entry) => String(entry.id) === filters.stationId);
  if (category || subcategory) {
    chips.push({
      label: `Categoría: ${[category?.name, subcategory?.name].filter(Boolean).join(" › ")}`,
      onRemove: () => patch({ categoryId: "", subcategoryId: "" }),
    });
  }
  if (filters.status) {
    chips.push({ label: `Estado: ${statusLabels[filters.status] ?? filters.status}`, onRemove: () => patch({ status: "" }) });
  }
  if (filters.favorite === "yes") chips.push({ label: "Favoritos", onRemove: () => patch({ favorite: "any" }) });
  if (filters.favorite === "no") chips.push({ label: "Sin favorito", onRemove: () => patch({ favorite: "any" }) });
  if (filters.availability === "disponible") chips.push({ label: "Disponible", onRemove: () => patch({ availability: "any" }) });
  if (filters.availability === "agotado") chips.push({ label: "Agotado", onRemove: () => patch({ availability: "any" }) });
  if (filters.stock === "out") chips.push({ label: "Sin stock", onRemove: () => patch({ stock: "any" }) });
  if (filters.stock === "low") chips.push({ label: "Stock bajo", onRemove: () => patch({ stock: "any" }) });
  if (filters.stock === "in") chips.push({ label: "Con stock", onRemove: () => patch({ stock: "any" }) });
  if (filters.branchId) {
    const branch = payload.branches.find((entry) => String(entry.id) === filters.branchId);
    chips.push({ label: `Sucursal: ${branch?.name ?? filters.branchId}`, onRemove: () => patch({ branchId: "" }) });
  }
  if (filters.priceMin || filters.priceMax) {
    chips.push({
      label: `Precio: ${filters.priceMin || "0"} – ${filters.priceMax || "∞"}`,
      onRemove: () => patch({ priceMin: "", priceMax: "" }),
    });
  }
  if (filters.costMin || filters.costMax) {
    chips.push({
      label: `Costo: ${filters.costMin || "0"} – ${filters.costMax || "∞"}`,
      onRemove: () => patch({ costMin: "", costMax: "" }),
    });
  }
  const marginLabels: Record<string, string> = {
    "no-cost": "Sin costo",
    negative: "Margen negativo",
    "0-20": "Margen 0–20%",
    "20-40": "Margen 20–40%",
    "40+": "Margen > 40%",
  };
  if (filters.margin !== "any") {
    chips.push({ label: marginLabels[filters.margin] ?? filters.margin, onRemove: () => patch({ margin: "any" }) });
  }
  if (filters.recipe === "yes") chips.push({ label: "Con receta", onRemove: () => patch({ recipe: "any" }) });
  if (filters.combo === "yes") chips.push({ label: "Con combo", onRemove: () => patch({ combo: "any" }) });
  if (filters.modifiers === "yes") chips.push({ label: "Con modificadores", onRemove: () => patch({ modifiers: "any" }) });
  if (filters.image === "yes") chips.push({ label: "Con imagen", onRemove: () => patch({ image: "any" }) });
  if (filters.image === "no") chips.push({ label: "Sin imagen", onRemove: () => patch({ image: "any" }) });
  if (filters.model3d === "yes") chips.push({ label: "Con 3D/AR", onRemove: () => patch({ model3d: "any" }) });
  if (filters.channelPrices === "yes") chips.push({ label: "Precio por canal", onRemove: () => patch({ channelPrices: "any" }) });
  if (station) chips.push({ label: `Estación: ${station.name}`, onRemove: () => patch({ stationId: "" }) });
  if (chips.length === 0) chips.push({ label: "Filtros", onRemove: openDrawer });
  return chips;
}

/** @summary Tarjeta visual de catálogo con acciones claras y menú secundario. */
function ProductCard({
  product,
  currency,
  selected,
  onToggleSelect,
  onEdit,
  onToggleFavorite,
  onDuplicate,
  onChangeStatus,
  onRemove,
}: {
  product: CatalogProductRow;
  currency: string;
  selected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  onToggleFavorite: () => void;
  onDuplicate: () => void;
  onChangeStatus: (status: string) => void;
  onRemove: () => void;
}) {
  const stock = stockState(product);
  const price = product.price === null ? null : Number(product.price);
  const cost = product.cost === null ? null : Number(product.cost);
  const margin = marginPercent(cost, price);
  const availabilityLabel =
    product.availability === "agotado" ? "Agotado" : product.availability === "" || product.availability === null ? "Disponible" : "Disponible";

  return (
    <article
      className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-[var(--admin-surface)] shadow-lg shadow-black/10 transition-all duration-150 hover:-translate-y-0.5 hover:border-white/20 hover:shadow-xl ${
        selected ? "border-pink-500/60 ring-1 ring-pink-500/40" : "border-[var(--admin-border)]"
      }`}
    >
      {/* Imagen protagonista */}
      <button type="button" onClick={onEdit} className="relative block aspect-[4/3] w-full overflow-hidden" aria-label={`Editar ${product.name}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={productImageSrc(product.imageUrl)}
          alt={product.name}
          data-fallback-src="/images/image_defect/product_default.png"
          onError={handleImageError}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
        />
        <span className="absolute left-2.5 top-2.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-black backdrop-blur-sm">
          {availabilityLabel === "Agotado" ? (
            <span className="text-rose-300">● Agotado</span>
          ) : (
            <span className="text-emerald-300">● Disponible</span>
          )}
        </span>
        {product.favorite && (
          <span className="absolute right-2.5 top-2.5 grid h-7 w-7 place-items-center rounded-full bg-black/55 text-amber-400 backdrop-blur-sm" title="Favorito">
            <Icon name="star-filled" className="h-4 w-4" />
          </span>
        )}
      </button>

      {/* Información */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-base font-black leading-snug">{product.name}</h3>
            <label
              className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center"
              onClick={(event) => event.stopPropagation()}
              title="Seleccionar para acciones masivas"
            >
              <input
                type="checkbox"
                checked={selected}
                onChange={onToggleSelect}
                className="h-4 w-4 accent-pink-500"
                aria-label={`Seleccionar ${product.name}`}
              />
            </label>
          </div>
          {product.categoryBreadcrumb && (
            <p className="mt-0.5 truncate text-xs text-[var(--admin-muted)]">{product.categoryBreadcrumb}</p>
          )}
        </div>

        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xl font-black tabular-nums">{money(price, currency)}</p>
          {product.stationName && (
            <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-bold text-zinc-300">{product.stationName}</span>
          )}
        </div>

        <p className="text-xs text-[var(--admin-muted)]">
          {cost === null ? (
            <span className="text-amber-300/80">Costo no cargado</span>
          ) : (
            <>
              Costo {money(cost, currency)} ·{" "}
              {margin === null ? "—" : (
                <span className={margin < 0 ? "text-rose-300" : margin < 20 ? "text-amber-300" : "text-emerald-300"}>
                  Margen {margin.toFixed(1)}%
                </span>
              )}
            </>
          )}
        </p>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {product.tracked && product.stock !== null && (
            <span title={`Físico ${product.stock} · Reservado ${product.reserved ?? 0}`}>
              <span className={`font-bold ${stock === "out" ? "text-rose-300" : stock === "low" ? "text-amber-300" : "text-zinc-200"}`}>
                Stock {product.available ?? product.stock}
              </span>
              <span className="text-zinc-500"> ({product.stock} físico)</span>
            </span>
          )}
          <span className="text-[var(--admin-muted)]">{product.branchCount} sucursal{product.branchCount === 1 ? "" : "es"}</span>
          <StatusBadge status={product.status} />
        </div>

        <div className="mt-auto flex items-center gap-2 pt-2">
          <button type="button" className="btn flex-1 py-1.5 text-xs" onClick={onEdit}>
            Editar
          </button>
          <ActionMenu
            align="right"
            items={[
              { label: "Duplicar", onClick: onDuplicate },
              { label: product.favorite ? "Quitar favorito" : "Marcar favorito", onClick: onToggleFavorite },
              ...(product.status === "published"
                ? [{ label: "Pasar a borrador", onClick: () => onChangeStatus("draft") }]
                : [{ label: "Publicar", onClick: () => onChangeStatus("published") }]),
              { label: "Eliminar", tone: "danger", onClick: onRemove },
            ]}
          />
        </div>
      </div>
    </article>
  );
}

/** @summary Tabla mejorada con orden por columna, filtros contextuales y densidad. */
function ListTable({
  products,
  currency,
  density,
  selected,
  allSelected,
  onToggleAll,
  onToggleOne,
  sort,
  onSort,
  filters,
  onPatchFilters,
  columnFilter,
  onColumnFilter,
  categoryGroups,
  activeBranchId,
  branches,
  onEdit,
  onToggleFavorite,
  onDuplicate,
  onRemove,
}: {
  products: CatalogProductRow[];
  currency: string;
  density: "comfortable" | "compact";
  selected: Set<number>;
  allSelected: boolean;
  onToggleAll: () => void;
  onToggleOne: (id: number) => void;
  sort: SortKey;
  onSort: (key: SortKey) => void;
  filters: Filters;
  onPatchFilters: (changes: Partial<Filters>) => void;
  columnFilter: ColumnKey | null;
  onColumnFilter: (key: ColumnKey | null) => void;
  categoryGroups: Array<{ id: number; name: string; children: Array<{ id: number; name: string }> }>;
  activeBranchId: number | null;
  branches: Array<{ id: number; name: string; slug: string }>;
  onEdit: (id: number) => void;
  onToggleFavorite: (product: CatalogProductRow) => void;
  onDuplicate: (product: CatalogProductRow) => void;
  onRemove: (product: CatalogProductRow) => void;
}) {
  const cell = density === "compact" ? "px-3 py-2" : "px-4 py-3.5";

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl shadow-black/10">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--admin-border)] bg-white/[0.02] text-xs uppercase tracking-wider text-[var(--admin-muted)]">
              <th className={`${cell} w-10`}>
                <input type="checkbox" checked={allSelected} onChange={onToggleAll} aria-label="Seleccionar todos" />
              </th>
              <ColumnHeader label="Producto" column="search" sortKey="name-asc" cell={cell} sort={sort} onSort={onSort} columnFilter={columnFilter} onColumnFilter={onColumnFilter} filters={filters} onPatchFilters={onPatchFilters} categoryGroups={categoryGroups} activeBranchId={activeBranchId} branches={branches} />
              <ColumnHeader label="Precio / costo" column="price" sortKey="price-asc" cell={cell} sort={sort} onSort={onSort} columnFilter={columnFilter} onColumnFilter={onColumnFilter} filters={filters} onPatchFilters={onPatchFilters} categoryGroups={categoryGroups} activeBranchId={activeBranchId} branches={branches} />
              <ColumnHeader label="Margen" column="margin" sortKey="margin-asc" cell={cell} sort={sort} onSort={onSort} columnFilter={columnFilter} onColumnFilter={onColumnFilter} filters={filters} onPatchFilters={onPatchFilters} categoryGroups={categoryGroups} activeBranchId={activeBranchId} branches={branches} />
              <ColumnHeader label="Stock" column="stock" sortKey="stock-asc" cell={cell} sort={sort} onSort={onSort} columnFilter={columnFilter} onColumnFilter={onColumnFilter} filters={filters} onPatchFilters={onPatchFilters} categoryGroups={categoryGroups} activeBranchId={activeBranchId} branches={branches} />
              <ColumnHeader label="Disp." column="availability" cell={cell} sort={sort} onSort={onSort} columnFilter={columnFilter} onColumnFilter={onColumnFilter} filters={filters} onPatchFilters={onPatchFilters} categoryGroups={categoryGroups} activeBranchId={activeBranchId} branches={branches} />
              <ColumnHeader label="Sucursales" column="branches" cell={cell} sort={sort} onSort={onSort} columnFilter={columnFilter} onColumnFilter={onColumnFilter} filters={filters} onPatchFilters={onPatchFilters} categoryGroups={categoryGroups} activeBranchId={activeBranchId} branches={branches} />
              <ColumnHeader label="Estado" column="status" cell={cell} sort={sort} onSort={onSort} columnFilter={columnFilter} onColumnFilter={onColumnFilter} filters={filters} onPatchFilters={onPatchFilters} categoryGroups={categoryGroups} activeBranchId={activeBranchId} branches={branches} />
              <th className={`${cell} text-right`}>Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--admin-border)]/70">
            {products.map((product) => {
              const price = product.price === null ? null : Number(product.price);
              const cost = product.cost === null ? null : Number(product.cost);
              const margin = marginPercent(cost, price);
              const stock = stockState(product);
              return (
                <tr
                  key={product.id}
                  className={`transition-colors hover:bg-white/[0.03] ${product.favorite ? "bg-amber-400/[0.03]" : ""} ${
                    selected.has(product.id) ? "bg-pink-500/[0.05]" : ""
                  }`}
                >
                  <td className={cell}>
                    <input
                      type="checkbox"
                      checked={selected.has(product.id)}
                      onChange={() => onToggleOne(product.id)}
                      aria-label={`Seleccionar ${product.name}`}
                    />
                  </td>
                  <td className={cell}>
                    <button className="flex items-center gap-3 text-left" onClick={() => onEdit(product.id)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={productImageSrc(product.imageUrl)}
                        alt={product.name}
                        data-fallback-src="/images/image_defect/product_default.png"
                        onError={handleImageError}
                        className={`shrink-0 rounded-xl border border-[var(--admin-border)] object-cover ${density === "compact" ? "h-10 w-10" : "h-14 w-14"}`}
                      />
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-bold leading-snug">{product.name}</span>
                          {product.favorite && <span title="Favorito"><Icon name="star-filled" className="h-3.5 w-3.5 text-amber-400" /></span>}
                          {(product.hasRecipe || product.hasCombo || product.hasModifiers) && (
                            <span className="flex gap-0.5">
                              {product.hasRecipe && <span className="rounded bg-white/5 px-1 py-0.5 text-[9px] font-black text-emerald-300" title="Con receta">R</span>}
                              {product.hasCombo && <span className="rounded bg-white/5 px-1 py-0.5 text-[9px] font-black text-sky-300" title="Es combo">C</span>}
                              {product.hasModifiers && <span className="rounded bg-white/5 px-1 py-0.5 text-[9px] font-black text-pink-300" title="Con modificadores">M</span>}
                            </span>
                          )}
                          {product.stationName && (
                            <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-bold text-zinc-300">{product.stationName}</span>
                          )}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-[var(--admin-muted)]">
                          {product.categoryBreadcrumb || "Sin categoría"}
                        </span>
                      </span>
                    </button>
                  </td>
                  <td className={cell}>
                    <div className="text-sm font-bold tabular-nums">{money(price, currency)}</div>
                    <div className={`text-xs ${cost === null ? "text-amber-300/80" : "text-[var(--admin-muted)]"}`}>
                      {cost === null ? "Costo no cargado" : `Costo ${money(cost, currency)}`}
                    </div>
                  </td>
                  <td className={cell}>
                    {margin === null ? (
                      <span className="text-xs text-[var(--admin-muted)]">—</span>
                    ) : (
                      <span className={`text-sm font-bold tabular-nums ${margin < 0 ? "text-rose-300" : margin < 20 ? "text-amber-300" : "text-emerald-300"}`}>
                        {margin.toFixed(1)}%
                      </span>
                    )}
                  </td>
                  <td className={cell}>
                    {product.tracked && product.stock !== null ? (
                      <div className="text-sm">
                        <span className={`font-bold tabular-nums ${stock === "out" ? "text-rose-300" : stock === "low" ? "text-amber-300" : "text-zinc-200"}`}>
                          {product.available ?? product.stock}
                        </span>
                        <span className="ml-1 text-[10px] text-zinc-500" title={`Físico ${product.stock} · Reservado ${product.reserved ?? 0}`}>
                          / {product.stock}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-600">Sin control</span>
                    )}
                  </td>
                  <td className={cell}>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                        product.availability === "agotado" ? "bg-rose-500/15 text-rose-300" : "bg-emerald-500/15 text-emerald-300"
                      }`}
                    >
                      {product.availability === "agotado" ? "Agotado" : "Disponible"}
                    </span>
                  </td>
                  <td className={`${cell} text-xs text-[var(--admin-muted)]`}>
                    {product.activeBranchCount} de {product.branchCount}
                  </td>
                  <td className={cell}>
                    <StatusBadge status={product.status} />
                  </td>
                  <td className={`${cell} text-right`}>
                    <ActionMenu
                      align="right"
                      items={[
                        { label: "Editar", onClick: () => onEdit(product.id) },
                        { label: "Duplicar", onClick: () => onDuplicate(product) },
                        { label: product.favorite ? "Quitar favorito" : "Marcar favorito", onClick: () => onToggleFavorite(product) },
                        { label: "Eliminar", tone: "danger", onClick: () => onRemove(product) },
                      ]}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** @summary Encabezado de columna con orden y filtro contextual. */
function ColumnHeader({
  label,
  column,
  sortKey,
  width,
  cell,
  sort,
  onSort,
  columnFilter,
  onColumnFilter,
  filters,
  onPatchFilters,
  categoryGroups,
  activeBranchId,
  branches,
}: {
  label: string;
  column: ColumnKey;
  sortKey?: SortKey;
  width?: string;
  cell: string;
  sort: SortKey;
  onSort: (key: SortKey) => void;
  columnFilter: ColumnKey | null;
  onColumnFilter: (key: ColumnKey | null) => void;
  filters: Filters;
  onPatchFilters: (changes: Partial<Filters>) => void;
  categoryGroups: Array<{ id: number; name: string; children: Array<{ id: number; name: string }> }>;
  activeBranchId: number | null;
  branches: Array<{ id: number; name: string; slug: string }>;
}) {
  const sortedByThis = sort === sortKey;
  const nextSort: SortKey | undefined =
    sortKey === "name-asc" ? (sort === "name-asc" ? "name-desc" : "name-asc") : sortKey;
  return (
    <th className={`relative ${width ?? ""} ${cell} text-left`}>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="inline-flex items-center gap-1 font-semibold uppercase tracking-wider text-[var(--admin-muted)] transition-colors hover:text-white"
          onClick={() => sortKey && nextSort && onSort(nextSort)}
          title={sortKey ? "Ordenar por esta columna" : undefined}
        >
          {label}
          {sortedByThis && <span className="text-pink-300">{sort === `${column}-asc` ? "↑" : "↓"}</span>}
        </button>
        <button
          type="button"
          className="rounded p-0.5 text-[10px] text-zinc-500 transition-colors hover:text-white"
          onClick={() => onColumnFilter(columnFilter === column ? null : column)}
          aria-label={`Filtrar por ${label}`}
          title="Filtrar"
        >
          <Icon name="filter" className="h-3.5 w-3.5" />
        </button>
      </div>
      {columnFilter === column && (
        <ColumnFilterPanel
          column={column}
          filters={filters}
          onPatch={onPatchFilters}
          categoryGroups={categoryGroups}
          activeBranchId={activeBranchId}
          branches={branches}
          onClose={() => onColumnFilter(null)}
        />
      )}
    </th>
  );
}

/** @summary Panel de filtro contextual de una columna de la tabla. */
function ColumnFilterPanel({
  column,
  filters,
  onPatch,
  categoryGroups,
  activeBranchId,
  branches,
  onClose,
}: {
  column: ColumnKey;
  filters: Filters;
  onPatch: (changes: Partial<Filters>) => void;
  categoryGroups: Array<{ id: number; name: string; children: Array<{ id: number; name: string }> }>;
  activeBranchId: number | null;
  branches: Array<{ id: number; name: string; slug: string }>;
  onClose: () => void;
}) {
  const field = "input w-full py-1.5 text-xs";
  return (
    <>
      <button type="button" aria-hidden className="fixed inset-0 z-10 cursor-default" onClick={onClose} tabIndex={-1} />
      <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-xl border border-white/10 bg-zinc-900 p-3 shadow-2xl">
        <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
          {column === "search" ? "Producto" : column === "price" ? "Precio y costo" : column === "margin" ? "Margen" : column === "stock" ? "Stock" : column === "availability" ? "Disponibilidad" : column === "branches" ? "Sucursales" : "Estado"}
        </p>
        {column === "search" && (
          <input
            autoFocus
            className={field}
            placeholder="Buscar por nombre…"
            value={filters.categoryId ? "" : undefined}
            onChange={() => onPatch({ categoryId: "", subcategoryId: "", status: "", availability: "any", stock: "any" })}
          />
        )}
        {column === "search" && (
          <div className="mt-2 space-y-2">
            <label className="block">
              <span className="text-[10px] font-bold text-zinc-500">Categoría</span>
              <select className={field} value={filters.categoryId} onChange={(event) => onPatch({ categoryId: event.target.value, subcategoryId: "" })}>
                <option value="">Todas</option>
                {categoryGroups.map((parent) => (
                  <optgroup key={parent.id} label={parent.name}>
                    <option value={String(parent.id)}>{parent.name}</option>
                    {parent.children.map((child) => (
                      <option key={child.id} value={String(child.id)}>{parent.name} › {child.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] font-bold text-zinc-500">Estado</span>
              <select className={field} value={filters.status} onChange={(event) => onPatch({ status: event.target.value })}>
                <option value="">Todos</option>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
          </div>
        )}
        {column === "price" && (
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[10px] font-bold text-zinc-500">Precio mín.</span>
              <input className={field} type="number" min={0} value={filters.priceMin} onChange={(event) => onPatch({ priceMin: event.target.value })} placeholder="0" />
            </label>
            <label className="block">
              <span className="text-[10px] font-bold text-zinc-500">Precio máx.</span>
              <input className={field} type="number" min={0} value={filters.priceMax} onChange={(event) => onPatch({ priceMax: event.target.value })} placeholder="∞" />
            </label>
            <label className="block">
              <span className="text-[10px] font-bold text-zinc-500">Costo mín.</span>
              <input className={field} type="number" min={0} value={filters.costMin} onChange={(event) => onPatch({ costMin: event.target.value })} placeholder="0" />
            </label>
            <label className="block">
              <span className="text-[10px] font-bold text-zinc-500">Costo máx.</span>
              <input className={field} type="number" min={0} value={filters.costMax} onChange={(event) => onPatch({ costMax: event.target.value })} placeholder="∞" />
            </label>
          </div>
        )}
        {column === "margin" && (
          <select className={field} value={filters.margin} onChange={(event) => onPatch({ margin: event.target.value as Filters["margin"] })}>
            <option value="any">Cualquier margen</option>
            <option value="no-cost">Sin costo</option>
            <option value="negative">Margen negativo</option>
            <option value="0-20">0 – 20%</option>
            <option value="20-40">20 – 40%</option>
            <option value="40+">Mayor a 40%</option>
          </select>
        )}
        {column === "stock" && (
          <select className={field} value={filters.stock} onChange={(event) => onPatch({ stock: event.target.value as Filters["stock"] })}>
            <option value="any">Cualquier stock</option>
            <option value="out">Sin stock</option>
            <option value="low">Bajo mínimo</option>
            <option value="in">Con stock</option>
          </select>
        )}
        {column === "availability" && (
          <select className={field} value={filters.availability} onChange={(event) => onPatch({ availability: event.target.value as Filters["availability"] })}>
            <option value="any">Disponible y agotado</option>
            <option value="disponible">Disponible</option>
            <option value="agotado">Agotado</option>
          </select>
        )}
        {column === "branches" && (
          <select className={field} value={filters.branchId} onChange={(event) => onPatch({ branchId: event.target.value })}>
            <option value="">{activeBranchId ? "Sucursal actual" : "Todas las sucursales"}</option>
            {branches.map((branch) => (
              <option key={branch.id} value={String(branch.id)}>{branch.name}</option>
            ))}
          </select>
        )}
        {column === "status" && (
          <select className={field} value={filters.status} onChange={(event) => onPatch({ status: event.target.value })}>
            <option value="">Todos los estados</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        )}
        <button type="button" className="mt-3 w-full rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold text-zinc-400 hover:bg-white/5" onClick={onClose}>
          Listo
        </button>
      </div>
    </>
  );
}

/** @summary Drawer de filtros avanzados organizado por áreas de negocio. */
function FilterDrawer({
  filters,
  onPatch,
  categoryGroups,
  stations,
  branches,
  activeBranchId,
  onClose,
  onClear,
}: {
  filters: Filters;
  onPatch: (changes: Partial<Filters>) => void;
  categoryGroups: Array<{ id: number; name: string; children: Array<{ id: number; name: string }> }>;
  stations: Array<{ id: number; name: string; type: string }>;
  branches: Array<{ id: number; name: string; slug: string }>;
  activeBranchId: number | null;
  onClose: () => void;
  onClear: () => void;
}) {
  const field = "input w-full py-1.5 text-sm";
  const group = "border-b border-white/10 pb-4";
  const groupTitle = "mb-2 text-[10px] font-black uppercase tracking-widest text-zinc-500";

  return (
    <div className="fixed inset-0 z-[90] flex justify-end bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-md flex-col overflow-hidden border-l border-white/10 bg-[var(--admin-surface)] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-xl font-black">Filtros</h2>
            <p className="text-sm text-[var(--admin-muted)]">Combiná condiciones para afinar la carta.</p>
          </div>
          <button type="button" className="grid h-10 w-10 place-items-center rounded-full bg-white/5 text-xl" onClick={onClose} aria-label="Cerrar filtros">
            ×
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <section className={group}>
            <h3 className={groupTitle}>Catálogo</h3>
            <div className="space-y-3">
              <label className="block">
                <span className="block text-xs font-semibold text-[var(--admin-muted)]">Categoría</span>
                <select className={field} value={filters.categoryId} onChange={(event) => onPatch({ categoryId: event.target.value, subcategoryId: "" })}>
                  <option value="">Todas</option>
                  {categoryGroups.map((parent) => (
                    <optgroup key={parent.id} label={parent.name}>
                      <option value={String(parent.id)}>{parent.name}</option>
                      {parent.children.map((child) => (
                        <option key={child.id} value={String(child.id)}>{parent.name} › {child.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              {filters.categoryId && (
                <label className="block">
                  <span className="block text-xs font-semibold text-[var(--admin-muted)]">Subcategoría</span>
                  <select className={field} value={filters.subcategoryId} onChange={(event) => onPatch({ subcategoryId: event.target.value })}>
                    <option value="">Todas las subcategorías</option>
                    {categoryGroups
                      .find((parent) => String(parent.id) === filters.categoryId)
                      ?.children.map((child) => (
                        <option key={child.id} value={String(child.id)}>{child.name}</option>
                      ))}
                  </select>
                </label>
              )}
              <label className="block">
                <span className="block text-xs font-semibold text-[var(--admin-muted)]">Estado editorial</span>
                <select className={field} value={filters.status} onChange={(event) => onPatch({ status: event.target.value })}>
                  <option value="">Todos</option>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-xs font-semibold text-[var(--admin-muted)]">Favorito</span>
                <select className={field} value={filters.favorite} onChange={(event) => onPatch({ favorite: event.target.value as Filters["favorite"] })}>
                  <option value="any">Todos</option>
                  <option value="yes">Solo favoritos</option>
                  <option value="no">Sin favorito</option>
                </select>
              </label>
            </div>
          </section>

          <section className={group}>
            <h3 className={groupTitle}>Comercial</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-xs font-semibold text-[var(--admin-muted)]">Precio mín.</span>
                  <input className={field} type="number" min={0} value={filters.priceMin} onChange={(event) => onPatch({ priceMin: event.target.value })} placeholder="0" />
                </label>
                <label className="block">
                  <span className="block text-xs font-semibold text-[var(--admin-muted)]">Precio máx.</span>
                  <input className={field} type="number" min={0} value={filters.priceMax} onChange={(event) => onPatch({ priceMax: event.target.value })} placeholder="∞" />
                </label>
                <label className="block">
                  <span className="block text-xs font-semibold text-[var(--admin-muted)]">Costo mín.</span>
                  <input className={field} type="number" min={0} value={filters.costMin} onChange={(event) => onPatch({ costMin: event.target.value })} placeholder="0" />
                </label>
                <label className="block">
                  <span className="block text-xs font-semibold text-[var(--admin-muted)]">Costo máx.</span>
                  <input className={field} type="number" min={0} value={filters.costMax} onChange={(event) => onPatch({ costMax: event.target.value })} placeholder="∞" />
                </label>
              </div>
              <label className="block">
                <span className="block text-xs font-semibold text-[var(--admin-muted)]">Margen</span>
                <select className={field} value={filters.margin} onChange={(event) => onPatch({ margin: event.target.value as Filters["margin"] })}>
                  <option value="any">Cualquiera</option>
                  <option value="no-cost">Sin costo cargado</option>
                  <option value="negative">Margen negativo</option>
                  <option value="0-20">0 – 20%</option>
                  <option value="20-40">20 – 40%</option>
                  <option value="40+">Mayor a 40%</option>
                </select>
              </label>
              <label className="block">
                <span className="block text-xs font-semibold text-[var(--admin-muted)]">Precio por canal</span>
                <select className={field} value={filters.channelPrices} onChange={(event) => onPatch({ channelPrices: event.target.value as Filters["channelPrices"] })}>
                  <option value="any">Cualquiera</option>
                  <option value="yes">Con precio por canal</option>
                </select>
              </label>
            </div>
          </section>

          <section className={group}>
            <h3 className={groupTitle}>Stock</h3>
            <div className="space-y-3">
              <label className="block">
                <span className="block text-xs font-semibold text-[var(--admin-muted)]">Disponibilidad</span>
                <select className={field} value={filters.availability} onChange={(event) => onPatch({ availability: event.target.value as Filters["availability"] })}>
                  <option value="any">Disponible y agotado</option>
                  <option value="disponible">Disponible</option>
                  <option value="agotado">Agotado</option>
                </select>
              </label>
              <label className="block">
                <span className="block text-xs font-semibold text-[var(--admin-muted)]">Nivel de stock</span>
                <select className={field} value={filters.stock} onChange={(event) => onPatch({ stock: event.target.value as Filters["stock"] })}>
                  <option value="any">Cualquiera</option>
                  <option value="out">Sin stock</option>
                  <option value="low">Bajo mínimo</option>
                  <option value="in">Con stock</option>
                </select>
              </label>
              {!activeBranchId && (
                <label className="block">
                  <span className="block text-xs font-semibold text-[var(--admin-muted)]">Publicados en sucursal</span>
                  <select className={field} value={filters.branchId} onChange={(event) => onPatch({ branchId: event.target.value })}>
                    <option value="">Todas</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={String(branch.id)}>{branch.name}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </section>

          <section className={group}>
            <h3 className={groupTitle}>Preparación</h3>
            <div className="grid grid-cols-2 gap-3">
              {([
                { key: "recipe", label: "Con receta" },
                { key: "combo", label: "Es combo" },
                { key: "modifiers", label: "Con modificadores" },
              ] as const).map((option) => (
                <label key={option.key} className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={filters[option.key] === "yes"}
                    onChange={(event) => onPatch({ [option.key]: event.target.checked ? "yes" : "any" } as Partial<Filters>)}
                  />
                  {option.label}
                </label>
              ))}
              <label className="col-span-2 block">
                <span className="block text-xs font-semibold text-[var(--admin-muted)]">Estación de preparación</span>
                <select className={field} value={filters.stationId} onChange={(event) => onPatch({ stationId: event.target.value })}>
                  <option value="">Todas</option>
                  {stations.map((station) => (
                    <option key={station.id} value={String(station.id)}>{station.name}</option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className={group}>
            <h3 className={groupTitle}>Multimedia</h3>
            <div className="grid grid-cols-2 gap-3">
              {([
                { key: "image", label: "Con imagen" },
                { key: "model3d", label: "Con 3D o AR" },
              ] as const).map((option) => (
                <label key={option.key} className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={filters[option.key] === "yes"}
                    onChange={(event) => onPatch({ [option.key]: event.target.checked ? "yes" : "any" } as Partial<Filters>)}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </section>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-white/10 px-5 py-4">
          <button type="button" className="btn btn-secondary" onClick={onClear}>Limpiar filtros</button>
          <button type="button" className="btn" onClick={onClose}>Ver resultados</button>
        </div>
      </aside>
    </div>
  );
}

/** @summary Resumen corto de precios y costo del listado filtrado. */
function priceSummary(products: CatalogProductRow[], currency: string) {
  const priced = products.filter((product) => product.price !== null);
  if (!priced.length) return "";
  const average = priced.reduce((sum, product) => sum + Number(product.price), 0) / priced.length;
  const withCost = priced.filter((product) => product.cost !== null);
  if (withCost.length) {
    const totalPrice = withCost.reduce((sum, product) => sum + Number(product.price), 0);
    const totalCost = withCost.reduce((sum, product) => sum + Number(product.cost), 0);
    const overallMargin = totalPrice > 0 ? ((totalPrice - totalCost) / totalPrice) * 100 : 0;
    return ` · precio promedio ${money(String(average), currency)} · margen general ${overallMargin.toFixed(1)}%`;
  }
  return ` · precio promedio ${money(String(average), currency)}`;
}
