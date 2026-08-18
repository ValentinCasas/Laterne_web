"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import Swal from "sweetalert2";
import { PageHeader, SearchBox, ActionMenu, EmptyState } from "@/components/admin/ui";
import { scopedFetch } from "@/lib/client-routing";
import { adminHrefFromPathname } from "@/lib/routes";
import { unitLabel } from "@/lib/recipe-units";

/**
 * Ingredientes: costo, unidad base y stock por sucursal.
 *
 * Un ingrediente es un producto del catálogo con costo y/o control de
 * inventario. Este panel permite darlo de alta simple (sin pasar por el editor
 * de carta), ajustar su costo (con historial), sus existencias por sucursal y
 * las conversiones de unidades propias del negocio.
 */

type Branch = { id: number; name: string };
type IngredientStock = {
  branchId: number;
  branchName: string;
  current: string;
  minimum: string;
  tracked: boolean;
  unit: string;
};
type IngredientRow = {
  id: number;
  name: string;
  cost: string | null;
  costUnit: string;
  status: string;
  hasRecipe: boolean;
  usedInCount: number;
  stocks: IngredientStock[];
  lastCost: { cost: string; unit: string; reason: string | null; createdAt: string } | null;
};
type ConversionRow = { id?: number; fromUnit: string; toUnit: string; factor: string };

type Payload = {
  ingredients: IngredientRow[];
  branches: Branch[];
  currency: string;
};

type FormMode = "create" | "edit" | null;

/** @summary Estado del formulario de alta/edición de un ingrediente. */
type StockDraft = { branchId: number; branchName: string; tracked: boolean; current: string; minimum: string; unit: string };

/** @summary Ejecuta una petición de API y devuelve el cuerpo o lanza el error del servidor. */
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

/** @summary Convierte las existencias de una fila al borrador del formulario. */
function stockDraftFrom(stocks: IngredientStock[], branches: Branch[]): StockDraft[] {
  const byBranch = new Map(stocks.map((stock) => [stock.branchId, stock]));
  return branches.map((branch) => {
    const stock = byBranch.get(branch.id);
    return {
      branchId: branch.id,
      branchName: branch.name,
      tracked: stock?.tracked ?? false,
      current: stock?.current ?? "0",
      minimum: stock?.minimum ?? "0",
      unit: stock?.unit ?? "unidad",
    };
  });
}

/** @summary Tablero de ingredientes con alta simple, costo con historial y conversiones. */
export function IngredientsBoard({ initial }: { initial: Payload }) {
  const pathname = usePathname();
  /** Resuelve rutas administrativas conservando el contexto visible (mismo valor en SSR y cliente). */
  const adminHref = (href: string) => adminHrefFromPathname(pathname, href);
  const [payload, setPayload] = useState<Payload>(initial);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<FormMode>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "",
    cost: "",
    costUnit: "unidad",
    reason: "",
  });
  const [stocks, setStocks] = useState<StockDraft[]>(() => stockDraftFrom([], initial.branches));
  const [conversions, setConversions] = useState<ConversionRow[]>([]);

  const currency = payload.currency ?? "ARS";

  /** @summary Carga las conversiones del negocio al abrir el panel. */
  const loadConversions = async () => {
    try {
      const body = await api<{ rows: ConversionRow[] }>("/api/admin/ingredients/conversions");
      setConversions(body.rows);
    } catch (reason) {
      await showError("No se pudieron cargar las conversiones", reason);
    }
  };

  const openCreate = () => {
    setMode("create");
    setEditingId(null);
    setForm({ name: "", cost: "", costUnit: "unidad", reason: "" });
    setStocks(stockDraftFrom([], payload.branches));
  };

  const openEdit = (ingredient: IngredientRow) => {
    setMode("edit");
    setEditingId(ingredient.id);
    setForm({
      name: ingredient.name,
      cost: ingredient.cost ?? "",
      costUnit: ingredient.costUnit,
      reason: "",
    });
    setStocks(stockDraftFrom(ingredient.stocks, payload.branches));
  };

  const refresh = async () => {
    try {
      const body = await api<{ payload: Payload }>("/api/admin/ingredients");
      setPayload(body.payload);
    } catch (reason) {
      await showError("No se pudo actualizar el listado", reason);
    }
  };

  /** @summary Guarda el ingrediente (alta o actualización). */
  const saveIngredient = async () => {
    if (!form.name.trim()) {
      await showError("Falta el nombre", new Error("Escribí el nombre del ingrediente"));
      return;
    }
    setBusy(true);
    try {
      const body = {
        name: form.name.trim(),
        cost: form.cost === "" ? undefined : Number(form.cost),
        costUnit: form.costUnit.trim() || "unidad",
        reason: form.reason.trim() || undefined,
        stocks: stocks
          .filter((stock) => stock.tracked || Number(stock.current) > 0)
          .map((stock) => ({
            branchId: stock.branchId,
            current: Number(stock.current) || 0,
            minimum: Number(stock.minimum) || 0,
            tracked: stock.tracked,
            unit: stock.unit.trim() || "unidad",
          })),
      };
      if (mode === "create") {
        await api("/api/admin/ingredients", { method: "POST", body: JSON.stringify(body) });
      } else if (editingId !== null) {
        await api(`/api/admin/ingredients/${editingId}`, { method: "PATCH", body: JSON.stringify(body) });
      }
      setMode(null);
      setEditingId(null);
      await refresh();
      await Swal.fire({
        title: mode === "create" ? "Ingrediente creado" : "Ingrediente actualizado",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
        background: "#18181b",
        color: "#fafafa",
      });
    } catch (reason) {
      await showError("No se pudo guardar el ingrediente", reason);
    } finally {
      setBusy(false);
    }
  };

  /** @summary Elimina un ingrediente con confirmación (bloqueado si se usa en recetas). */
  const removeIngredient = async (ingredient: IngredientRow) => {
    const result = await Swal.fire({
      title: `¿Eliminar ${ingredient.name}?`,
      text: "Se eliminará el ingrediente y sus existencias para siempre. No se puede deshacer.",
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
      await api(`/api/admin/ingredients/${ingredient.id}`, { method: "DELETE" });
      await refresh();
    } catch (reason) {
      await showError("No se pudo eliminar el ingrediente", reason);
    } finally {
      setBusy(false);
    }
  };

  /** @summary Guarda las conversiones de unidades del negocio. */
  const saveConversions = async () => {
    setBusy(true);
    try {
      const valid = conversions.filter((row) => row.fromUnit.trim() && row.toUnit.trim() && Number(row.factor) > 0);
      await api("/api/admin/ingredients/conversions", {
        method: "PUT",
        body: JSON.stringify({ rows: valid }),
      });
      await Swal.fire({
        title: "Conversiones guardadas",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
        background: "#18181b",
        color: "#fafafa",
      });
    } catch (reason) {
      await showError("No se pudieron guardar las conversiones", reason);
    } finally {
      setBusy(false);
    }
  };

  const patchConversion = (index: number, patch: Partial<ConversionRow>) => {
    setConversions((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  };

  const patchStock = (index: number, patch: Partial<StockDraft>) => {
    setStocks((current) => current.map((stock, stockIndex) => (stockIndex === index ? { ...stock, ...patch } : stock)));
  };

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es");
    return payload.ingredients.filter((ingredient) =>
      query ? ingredient.name.toLocaleLowerCase("es").includes(query) : true,
    );
  }, [payload.ingredients, search]);

  const money = (value: string | null | undefined) => {
    if (value === null || value === undefined || value === "") return "—";
    return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 2 }).format(
      Number(value),
    );
  };

  return (
    <div>
      <PageHeader
        eyebrow="Costos"
        title="Ingredientes"
        section="ingredientes"
        description="Cargá la materia prima con su costo y unidad base, y controlá el stock por sucursal. Los consumos de los pedidos descuentan los ingredientes de cada receta y guardan el costo histórico."
        actions={
          <>
            <a href={adminHref("/admin/recetas")} className="btn btn-secondary">
              Ver recetas
            </a>
            <button onClick={openCreate} className="btn" disabled={busy}>
              + Nuevo ingrediente
            </button>
          </>
        }
      />

      {/* Formulario de alta/edición */}
      {mode && (
        <div className="mb-5 rounded-[1.5rem] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-xl shadow-black/10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-black">
              {mode === "create" ? "Nuevo ingrediente" : `Editar · ${form.name}`}
            </h2>
            <button type="button" onClick={() => { setMode(null); setEditingId(null); }} className="btn btn-secondary">
              Cancelar
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block">
              <span className="block text-xs font-semibold text-[var(--admin-muted)]">Nombre</span>
              <input
                className="input mt-1"
                value={form.name}
                disabled={mode === "edit"}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Ej. Harina 0000"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-semibold text-[var(--admin-muted)]">Costo por unidad</span>
              <input
                className="input mt-1"
                type="number"
                min={0}
                step="0.01"
                value={form.cost}
                onChange={(event) => setForm({ ...form, cost: event.target.value })}
                placeholder="0"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-semibold text-[var(--admin-muted)]">Unidad base</span>
              <input
                className="input mt-1"
                value={form.costUnit}
                onChange={(event) => setForm({ ...form, costUnit: event.target.value })}
                placeholder="unidad, g, kg, ml, l…"
                list="unit-list"
              />
              <datalist id="unit-list">
                {["unidad", "g", "kg", "ml", "l", "cucharada", "cucharadita", "taza", "docena"].map((unit) => (
                  <option key={unit} value={unit}>{unitLabel(unit)}</option>
                ))}
              </datalist>
            </label>
            <label className="block">
              <span className="block text-xs font-semibold text-[var(--admin-muted)]">Motivo del costo (opcional)</span>
              <input
                className="input mt-1"
                value={form.reason}
                onChange={(event) => setForm({ ...form, reason: event.target.value })}
                placeholder="Ej. Factura proveedor"
              />
            </label>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">
              Existencias por sucursal
            </p>
            <div className="grid gap-2 lg:grid-cols-2">
              {stocks.map((stock, index) => (
                <div key={stock.branchId} className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--admin-border)] bg-white/[0.02] px-3 py-2">
                  <label className="flex w-44 items-center gap-2 text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked={stock.tracked}
                      onChange={(event) => patchStock(index, { tracked: event.target.checked })}
                      className="h-4 w-4"
                    />
                    {stock.branchName}
                  </label>
                  <input
                    className="input w-24"
                    type="number"
                    min={0}
                    step="0.001"
                    value={stock.current}
                    disabled={!stock.tracked}
                    onChange={(event) => patchStock(index, { current: event.target.value })}
                    aria-label={`Stock actual en ${stock.branchName}`}
                  />
                  <span className="text-xs text-[var(--admin-muted)]">mín.</span>
                  <input
                    className="input w-24"
                    type="number"
                    min={0}
                    step="0.001"
                    value={stock.minimum}
                    disabled={!stock.tracked}
                    onChange={(event) => patchStock(index, { minimum: event.target.value })}
                    aria-label={`Stock mínimo en ${stock.branchName}`}
                  />
                  <input
                    className="input w-24"
                    value={stock.unit}
                    disabled={!stock.tracked}
                    onChange={(event) => patchStock(index, { unit: event.target.value })}
                    aria-label={`Unidad de stock en ${stock.branchName}`}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={saveIngredient} className="btn" disabled={busy}>
              {busy ? "Guardando…" : mode === "create" ? "Crear ingrediente" : "Guardar cambios"}
            </button>
          </div>
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-[1.5rem] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 shadow-xl shadow-black/10">
        <div className="min-w-52 flex-1">
          <SearchBox value={search} onChange={setSearch} placeholder="Buscar ingrediente…" />
        </div>
        <p className="flex items-center text-sm text-[var(--admin-muted)]">
          {filtered.length} ingrediente{filtered.length === 1 ? "" : "s"}
        </p>
      </div>

      {/* Listado */}
      <div className="overflow-hidden rounded-[1.5rem] border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl shadow-black/10">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--admin-border)] text-xs uppercase tracking-wide text-[var(--admin-muted)]">
                <th className="px-4 py-3 font-semibold">Ingrediente</th>
                <th className="px-4 py-3 font-semibold text-right">Costo</th>
                <th className="px-4 py-3 font-semibold text-right">Unidad</th>
                <th className="px-4 py-3 font-semibold text-center">Usado en</th>
                <th className="px-4 py-3 font-semibold">Stock por sucursal</th>
                <th className="px-4 py-3 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((ingredient) => (
                <tr key={ingredient.id} className="border-b border-[var(--admin-border)]/60 last:border-0 hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <p className="font-bold">
                      {ingredient.name}
                      {ingredient.hasRecipe && (
                        <span className="ml-2 rounded-full bg-sky-500/15 px-2 py-0.5 text-[11px] font-semibold text-sky-300">
                          preparación
                        </span>
                      )}
                    </p>
                    {ingredient.lastCost && ingredient.cost === ingredient.lastCost.cost && (
                      <p className="text-xs text-[var(--admin-muted)]">
                        Últ. cambio {new Intl.DateTimeFormat("es-AR", { dateStyle: "short" }).format(new Date(ingredient.lastCost.createdAt))}
                        {ingredient.lastCost.reason ? ` · ${ingredient.lastCost.reason}` : ""}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-bold">{money(ingredient.cost)}</td>
                  <td className="px-4 py-3 text-right">{unitLabel(ingredient.costUnit)}</td>
                  <td className="px-4 py-3 text-center">
                    {ingredient.usedInCount > 0 ? (
                      <span className="font-semibold">{ingredient.usedInCount}</span>
                    ) : (
                      <span className="text-[var(--admin-muted)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {ingredient.stocks.length === 0 ? (
                      <span className="text-[var(--admin-muted)]">Sin existencias</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {ingredient.stocks.map((stock) => (
                          <span
                            key={stock.branchId}
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              stock.tracked ? "bg-white/5" : "bg-white/[0.02] text-[var(--admin-muted)]"
                            }`}
                            title={`${stock.branchName}`}
                          >
                            {stock.branchName}: {stock.tracked ? `${stock.current} ${unitLabel(stock.unit)}` : "sin control"}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <ActionMenu
                      align="right"
                      items={[
                        { label: "Editar", onClick: () => openEdit(ingredient) },
                        ...(ingredient.hasRecipe ? [{ label: "Ver ficha", onClick: () => { window.location.href = adminHref(`/admin/recetas/${ingredient.id}/ficha`); } }] : []),
                        { label: "Eliminar", tone: "danger", onClick: () => removeIngredient(ingredient) },
                      ]}
                    />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center">
                    <EmptyState title="No hay ingredientes cargados todavía" description="Creá el primero para comenzar a administrar costos y stock." action={
                      <button type="button" onClick={openCreate} className="btn">+ Nuevo ingrediente</button>
                    } />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Conversiones de unidades */}
      <div className="mt-8 rounded-[1.5rem] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-xl shadow-black/10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black">Conversiones de unidades</h2>
            <p className="mt-1 text-sm text-[var(--admin-muted)]">
              Reglas propias del negocio, por ejemplo 1 bolsa = 25 kg. El factor indica cuántas unidades de
              destino hay en una unidad de origen.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => { setConversions([...conversions, { fromUnit: "", toUnit: "", factor: "1" }]); }}
          >
            + Agregar conversión
          </button>
        </div>

        <button
          type="button"
          className="mt-3 text-sm font-semibold text-[var(--admin-muted)] underline"
          onClick={async () => {
            if (conversions.length === 0) await loadConversions();
            else setConversions([]);
          }}
        >
          {conversions.length === 0 ? "Mostrar conversiones configuradas" : "Ocultar conversiones"}
        </button>

        {conversions.length > 0 && (
          <div className="mt-3 space-y-2">
            {conversions.map((row, index) => (
              <div key={index} className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--admin-border)] bg-white/[0.02] px-3 py-2">
                <input
                  className="input w-32"
                  value={row.fromUnit}
                  onChange={(event) => patchConversion(index, { fromUnit: event.target.value })}
                  placeholder="1 (origen)"
                  aria-label="Unidad de origen"
                />
                <span className="text-sm text-[var(--admin-muted)]">=</span>
                <input
                  className="input w-24"
                  type="number"
                  min={0.000000001}
                  step="0.000000001"
                  value={row.factor}
                  onChange={(event) => patchConversion(index, { factor: event.target.value })}
                  aria-label="Factor"
                />
                <input
                  className="input w-32"
                  value={row.toUnit}
                  onChange={(event) => patchConversion(index, { toUnit: event.target.value })}
                  placeholder="unidad de destino"
                  aria-label="Unidad de destino"
                />
                <span className="text-xs text-[var(--admin-muted)]">1 {row.fromUnit || "?"} = {row.factor} {row.toUnit || "?"}</span>
                <button
                  type="button"
                  onClick={() => setConversions((current) => current.filter((_, rowIndex) => rowIndex !== index))}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--admin-border)] bg-white/5 text-rose-400 hover:bg-white/10"
                  aria-label="Quitar conversión"
                >
                  ✕
                </button>
              </div>
            ))}
            <div className="flex justify-end">
              <button type="button" onClick={saveConversions} className="btn" disabled={busy}>
                Guardar conversiones
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
