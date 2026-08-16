"use client";

import { useCallback, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ProductEditor } from "@/components/admin/product-editor";
import { scopedFetch } from "@/lib/client-routing";
import { PRODUCT_IMAGE_FALLBACK } from "@/lib/image-fallback";
import { marginPercent, markupPercent } from "@/lib/product-catalog";
import type { ProductCatalogPayload, CatalogProductRow } from "@/lib/product-catalog-data";

/**
 * Listado grande de productos de MenuClick.
 *
 * Pensado para operación diaria: búsqueda, filtros, favoritos, costo/margen,
 * stock y disponibilidad, acciones masivas razonables y duplicado seguro. La
 * edición abre el editor guiado (ProductEditor) sin recargar la página.
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

const statusColors: Record<string, string> = {
  published: "bg-emerald-500/15 text-emerald-300",
  scheduled: "bg-sky-500/15 text-sky-300",
  draft: "bg-zinc-500/15 text-zinc-300",
  hidden: "bg-amber-500/15 text-amber-300",
  archived: "bg-rose-500/15 text-rose-300",
};

/** @summary Formatea un importe con el símbolo de la moneda configurada. */
function money(value: string | null | undefined, currency: string) {
  if (value === null || value === undefined || value === "") return "—";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 2 }).format(
    Number(value),
  );
}

/** @summary Botón de ícono compacto para acciones de fila. */
function iconButtonClass(danger = false) {
  return `inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--admin-border)] bg-white/5 text-sm transition-colors hover:bg-white/10 ${
    danger ? "text-rose-400" : ""
  }`;
}

/** @summary Tablero del catálogo de productos con acciones de operación. */
export function ProductCatalogBoard({ initial }: { initial: ProductCatalogPayload }) {
  const [payload, setPayload] = useState<ProductCatalogPayload>(initial);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editingId, setEditingId] = useState<number | null | "new">(null);

  const currency = payload.currency ?? "ARS";

  /** @summary Refresca el listado desde el servidor conservando los filtros. */
  const refresh = useCallback(async () => {
    try {
      const body = await api<{ payload: ProductCatalogPayload }>("/api/admin/products");
      setPayload(body.payload);
    } catch (reason) {
      await showError("No se pudo actualizar el listado", reason);
    }
  }, []);

  /** @summary Agrupa las categorías por superior para filtrar de forma clara. */
  const categoryGroups = useMemo(() => {
    const parents = payload.categories.filter((category) => !category.parentId);
    const children = payload.categories.filter((category) => category.parentId);
    return parents.map((parent) => ({
      ...parent,
      children: children.filter((child) => child.parentId === parent.id),
    }));
  }, [payload.categories]);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es");
    return payload.products.filter((product) => {
      if (
        query &&
        !`${product.name} ${product.description} ${product.categoryName ?? ""}`
          .toLocaleLowerCase("es")
          .includes(query)
      )
        return false;
      if (statusFilter && product.status !== statusFilter) return false;
      if (availabilityFilter && product.availability !== availabilityFilter) return false;
      if (favoritesOnly && !product.favorite) return false;
      if (categoryFilter) {
        const matches =
          String(product.categoryId) === categoryFilter ||
          payload.categories.some(
            (category) =>
              category.id === product.categoryId && String(category.parentId) === categoryFilter,
          );
        if (!matches) return false;
      }
      return true;
    });
  }, [payload.products, payload.categories, search, statusFilter, categoryFilter, availabilityFilter, favoritesOnly]);

  const allSelected = filtered.length > 0 && filtered.every((product) => selected.has(product.id));

  /** @summary Alterna la selección de una fila (o de todas las filtradas). */
  const toggleAll = () => {
    setSelected((current) => {
      const next = new Set(current);
      if (allSelected) {
        for (const product of filtered) next.delete(product.id);
      } else {
        for (const product of filtered) next.add(product.id);
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

  return (
    <div>
      <AdminPageHeader
        eyebrow="Carta"
        title="Productos"
        section="productos"
        description="Creá y mantené tu carta: precios por canal, costo y margen, disponibilidad por sucursal, modificadores, combos y recetas. Todo en un solo lugar."
        actions={
          <button onClick={() => setEditingId("new")} className="btn" disabled={busy}>
            + Nuevo producto
          </button>
        }
      />

      {/* Barra de búsqueda y filtros */}
      <div className="mb-5 grid gap-3 rounded-[1.5rem] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 shadow-xl shadow-black/10 sm:grid-cols-2 lg:grid-cols-5">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nombre o descripción…"
          className="input sm:col-span-2 lg:col-span-1"
          aria-label="Buscar productos"
        />
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="input" aria-label="Filtrar por estado">
          <option value="">Todos los estados</option>
          {Object.entries(statusLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="input" aria-label="Filtrar por categoría">
          <option value="">Todas las categorías</option>
          {categoryGroups.map((parent) => (
            <optgroup key={parent.id} label={parent.name}>
              <option value={String(parent.id)}>{parent.name}</option>
              {parent.children.map((child) => (
                <option key={child.id} value={String(child.id)}>{parent.name} › {child.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <select value={availabilityFilter} onChange={(event) => setAvailabilityFilter(event.target.value)} className="input" aria-label="Filtrar por disponibilidad">
          <option value="">Disponible y agotado</option>
          <option value="disponible">Disponible</option>
          <option value="agotado">Agotado</option>
        </select>
      </div>

      {/* Filtro de favoritos + acciones masivas */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          onClick={() => setFavoritesOnly((value) => !value)}
          className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
            favoritesOnly
              ? "bg-amber-500/20 text-amber-300"
              : "border border-[var(--admin-border)] bg-white/5 text-[var(--admin-muted)] hover:bg-white/10"
          }`}
        >
          ★ Favoritos
        </button>
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-1.5 text-sm">
            <span className="font-semibold text-[var(--admin-muted)]">{selected.size} seleccionados</span>
            <button onClick={() => runBulkAction("favorite")} className="rounded-full px-3 py-1 font-semibold text-sky-300 hover:bg-white/5">Marcar favorito</button>
            <button onClick={() => runBulkAction("publish")} className="rounded-full px-3 py-1 font-semibold text-sky-300 hover:bg-white/5">Publicar</button>
            <button onClick={() => runBulkAction("hide")} className="rounded-full px-3 py-1 font-semibold text-sky-300 hover:bg-white/5">Ocultar</button>
            <button onClick={() => runBulkAction("activateBranch")} className="rounded-full px-3 py-1 font-semibold text-sky-300 hover:bg-white/5">Activar en sucursal</button>
            <button onClick={() => runBulkAction("deactivateBranch")} className="rounded-full px-3 py-1 font-semibold text-sky-300 hover:bg-white/5">Quitar de sucursal</button>
            <button onClick={() => runBulkAction("delete")} className="rounded-full px-3 py-1 font-semibold text-rose-400 hover:bg-white/5">Eliminar</button>
          </div>
        )}
      </div>

      {/* Listado grande */}
      <div className="overflow-x-auto rounded-[1.5rem] border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl shadow-black/10">
        <table className="min-w-full divide-y divide-[var(--admin-border)] text-left">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-[var(--admin-muted)]">
              <th className="w-10 px-4 py-3">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Seleccionar todos" />
              </th>
              <th className="px-4 py-3">Producto</th>
              <th className="hidden px-4 py-3 md:table-cell">Precio / costo</th>
              <th className="hidden px-4 py-3 lg:table-cell">Margen</th>
              <th className="hidden px-4 py-3 sm:table-cell">Disponibilidad</th>
              <th className="hidden px-4 py-3 lg:table-cell">Sucursales</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--admin-border)]">
            {filtered.map((product) => {
              const price = product.price === null ? null : Number(product.price);
              const cost = product.cost === null ? null : Number(product.cost);
              const margin = marginPercent(cost, price);
              const markup = markupPercent(cost, price);
              return (
                <tr key={product.id} className={`transition-colors hover:bg-white/[0.03] ${product.favorite ? "bg-amber-400/[0.04]" : ""}`}>
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={selected.has(product.id)}
                      onChange={() => toggleOne(product.id)}
                      aria-label={`Seleccionar ${product.name}`}
                    />
                  </td>
                  <td className="px-4 py-4">
                    <button className="flex items-center gap-4 text-left" onClick={() => setEditingId(product.id)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={product.imageUrl ? `/images/images_product/${product.imageUrl}` : PRODUCT_IMAGE_FALLBACK}
                        alt={product.name}
                        className="h-16 w-16 shrink-0 rounded-2xl border border-[var(--admin-border)] object-cover"
                      />
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-bold leading-snug">{product.name}</span>
                          {product.favorite && <span className="text-amber-400" title="Favorito">★</span>}
                          {product.stationName && (
                            <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-xs font-bold text-zinc-300">
                              {product.stationName}
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block truncate text-sm text-[var(--admin-muted)]">
                          {[product.categoryName, product.subcategoryName].filter(Boolean).join(" › ") || "Sin categoría"}
                        </span>
                      </span>
                    </button>
                  </td>
                  <td className="hidden px-4 py-4 md:table-cell">
                    <div className="text-base font-bold">{money(product.price, currency)}</div>
                    <div className="text-sm text-[var(--admin-muted)]">
                      {cost !== null ? `Costo ${money(product.cost, currency)}` : "Sin costo cargado"}
                    </div>
                  </td>
                  <td className="hidden px-4 py-4 lg:table-cell">
                    {margin !== null ? (
                      <div>
                        <div className="text-base font-bold">{margin.toFixed(1)}%</div>
                        <div className="text-xs text-[var(--admin-muted)]">
                          markup {markup !== null ? `${markup.toFixed(1)}%` : "—"}
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-[var(--admin-muted)]">—</span>
                    )}
                  </td>
                  <td className="hidden px-4 py-4 sm:table-cell">
                    <div className="flex flex-col gap-1">
                      <span
                        className={`w-fit rounded-full px-2.5 py-1 text-xs font-bold ${
                          product.availability === "agotado"
                            ? "bg-rose-500/15 text-rose-300"
                            : "bg-emerald-500/15 text-emerald-300"
                        }`}
                      >
                        {product.availability === "agotado" ? "Agotado" : "Disponible"}
                      </span>
                      {product.stock !== null && (
                        <span className="text-xs text-[var(--admin-muted)]">Stock: {product.stock}</span>
                      )}
                    </div>
                  </td>
                  <td className="hidden px-4 py-4 lg:table-cell">
                    <span className="text-sm text-[var(--admin-muted)]">
                      {product.activeBranchCount} de {product.branchCount} sucursales
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusColors[product.status] ?? statusColors.draft}`}>
                      {statusLabels[product.status] ?? product.status}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => toggleFavorite(product)}
                        className={iconButtonClass()}
                        title={product.favorite ? "Quitar de favoritos" : "Marcar favorito"}
                      >
                        {product.favorite ? "★" : "☆"}
                      </button>
                      <button onClick={() => setEditingId(product.id)} className={iconButtonClass()} title="Editar">✎</button>
                      <button onClick={() => duplicate(product)} className={iconButtonClass()} title="Duplicar">⧉</button>
                      <button
                        onClick={() => removeMany([product.id], `Se eliminará “${product.name}”.`)}
                        className={iconButtonClass(true)}
                        title="Eliminar"
                      >✕</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-14 text-center text-[var(--admin-muted)]">
                  <div className="text-3xl">🥗</div>
                  <p className="mt-3 text-base font-semibold">No se encontraron productos</p>
                  <p className="mt-1 text-sm">Probá cambiar la búsqueda o los filtros, o creá un producto nuevo.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-sm text-[var(--admin-muted)]">
        {filtered.length} productos ·{" "}
        {payload.activeBranch ? `Viendo la carta de ${payload.activeBranch.name}` : "Viendo todas las sucursales"}
        {priceSummary(filtered, currency)}
      </p>

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
