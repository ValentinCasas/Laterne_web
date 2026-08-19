"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import Swal from "sweetalert2";
import { PageHeader, SearchBox, ActionMenu, EmptyState, DataTable, StatusBadge, Drawer } from "@/components/admin/ui";
import { scopedFetch } from "@/lib/client-routing";
import { adminHrefFromPathname } from "@/lib/routes";
import { unitLabel } from "@/lib/recipe-units";

/**
 * Ingredientes: costo, unidad base y stock por sucursal.
 *
 * Un ingrediente es un producto del catálogo con costo y/o control de
 * inventario. Este panel permite darlo de alta simple (sin pasar por el editor
 * de carta), ajustar su costo (con historial), sus existencias por sucursal.
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

type Payload = {
  ingredients: IngredientRow[];
  branches: Branch[];
  currency: string;
};

type FormMode = "create" | "edit" | null;

type StockDraft = { branchId: number; branchName: string; tracked: boolean; current: string; minimum: string; unit: string };

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await scopedFetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body?.error ?? "No se pudo completar la operación");
  return body;
}

async function showError(title: string, reason: unknown) {
  await Swal.fire({
    title,
    text: reason instanceof Error ? reason.message : "Intentá nuevamente.",
    icon: "error",
    background: "#18181b",
    color: "#fafafa",
  });
}

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

export function IngredientsBoard({ initial }: { initial: Payload }) {
  const pathname = usePathname();
  const adminHref = (href: string) => adminHrefFromPathname(pathname, href);
  const [payload, setPayload] = useState<Payload>(initial);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mode, setMode] = useState<FormMode>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "",
    cost: "",
    costUnit: "unidad",
    reason: "",
  });
  const [stocks, setStocks] = useState<StockDraft[]>(() => stockDraftFrom([], initial.branches));

  const currency = payload.currency ?? "ARS";

  const openCreate = () => {
    setMode("create");
    setEditingId(null);
    setForm({ name: "", cost: "", costUnit: "unidad", reason: "" });
    setStocks(stockDraftFrom([], payload.branches));
    setDrawerOpen(true);
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
    setDrawerOpen(true);
  };

  const refresh = async () => {
    try {
      const body = await api<{ payload: Payload }>("/api/admin/ingredients");
      setPayload(body.payload);
    } catch (reason) {
      await showError("No se pudo actualizar el listado", reason);
    }
  };

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
      setDrawerOpen(false);
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

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es");
    return payload.ingredients.filter((ingredient) =>
      query ? ingredient.name.toLocaleLowerCase("es").includes(query) : true,
    );
  }, [payload.ingredients, search]);

  const money = (value: string | null | undefined) => {
    if (value === null || value === undefined || value === "") return "—";
    return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value));
  };

  const columns = useMemo(() => [
    { key: "name", label: "Ingrediente" } as const,
    { key: "cost", label: "Costo", align: "right" as const } as const,
    { key: "unit", label: "Unidad base", align: "right" as const, hideOnMobile: true } as const,
    { key: "stock", label: "Stock", hideOnMobile: true } as const,
    { key: "usedIn", label: "Usado en", align: "left" as const, hideOnMobile: true },
    { key: "lastUpdate", label: "Última actualización", hideOnMobile: true } as const,
    { key: "status", label: "Estado", hideOnMobile: true } as const,
  ], []);

  const data = useMemo(() =>
    filtered.map((ingredient) => ({
      id: ingredient.id,
      name: (
        <div className="min-w-0">
          <p className="truncate font-bold">
            {ingredient.name}
            {ingredient.hasRecipe && (
              <span className="ml-2 rounded-full bg-sky-500/15 px-2 py-0.5 text-[11px] font-semibold text-sky-300">
                preparación
              </span>
            )}
          </p>
          {ingredient.lastCost && ingredient.cost === ingredient.lastCost.cost && (
            <p className="truncate text-xs text-[var(--admin-muted)]">
              {ingredient.lastCost.reason ? `${ingredient.lastCost.reason} · ` : ""}
              {new Intl.DateTimeFormat("es-AR", { dateStyle: "short" }).format(new Date(ingredient.lastCost.createdAt))}
            </p>
          )}
        </div>
      ),
      cost: <span className="font-bold">{money(ingredient.cost)}</span>,
      unit: unitLabel(ingredient.costUnit),
      stock: ingredient.stocks.length === 0 ? (
        <span className="text-[var(--admin-muted)]">Sin existencias</span>
      ) : (
        <div className="flex flex-wrap gap-1">
          {ingredient.stocks.map((stock) => (
            <span
              key={stock.branchId}
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                stock.tracked ? "bg-white/5" : "bg-white/[0.02] text-[var(--admin-muted)]"
              }`}
            >
              {stock.tracked ? `${stock.current} ${unitLabel(stock.unit)}` : "sin control"}
            </span>
          ))}
        </div>
      ),
      usedIn: ingredient.usedInCount > 0 ? (
        <span className="font-semibold">{ingredient.usedInCount}</span>
      ) : (
        <span className="text-[var(--admin-muted)]">—</span>
      ),
      lastUpdate: ingredient.lastCost ? (
        <span className="text-xs">
          {new Intl.DateTimeFormat("es-AR", { dateStyle: "short" }).format(new Date(ingredient.lastCost.createdAt))}
        </span>
      ) : (
        <span className="text-[var(--admin-muted)]">—</span>
      ),
      status: <StatusBadge status={ingredient.status} />,
    })),
    [filtered, currency, money],
  );

  const rowActions = (row: Record<string, unknown>) => {
    const ingredient = filtered.find((i) => i.id === row.id as number);
    if (!ingredient) return null;
    return (
      <ActionMenu
        align="right"
        items={[
          { label: "Editar", onClick: () => openEdit(ingredient) },
          { label: "Ficha", onClick: () => { window.location.href = adminHref(`/admin/ingredientes/${ingredient.id}`); } },
          { label: "Eliminar", tone: "danger", onClick: () => removeIngredient(ingredient) },
        ]}
      />
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

      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-[1.5rem] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 shadow-xl shadow-black/10">
        <div className="min-w-52 flex-1">
          <SearchBox value={search} onChange={setSearch} placeholder="Buscar ingrediente…" />
        </div>
        <p className="flex items-center text-sm text-[var(--admin-muted)]">
          {filtered.length} ingrediente{filtered.length === 1 ? "" : "s"}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[1.5rem] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-10 text-center shadow-xl shadow-black/10">
          <EmptyState title="No hay ingredientes cargados todavía" description="Creá el primero para comenzar a administrar costos y stock." action={
            <button type="button" onClick={openCreate} className="btn">+ Nuevo ingrediente</button>
          } />
        </div>
      ) : (
        <div className="shadow-xl shadow-black/10">
          <DataTable
            viewStorageKey="ingredientes"
            columns={columns}
            data={data}
            keyExtractor={(row) => row.id as number}
            rowActions={rowActions}
            emptyMessage="No hay ingredientes cargados todavía."
          />
        </div>
      )}

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={mode === "create" ? "Nuevo ingrediente" : `Editar · ${form.name}`} width="640px">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
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

          <div>
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
                      onChange={(event) => setStocks((current) => current.map((s, i) => (i === index ? { ...s, tracked: event.target.checked } : s)))}
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
                    onChange={(event) => setStocks((current) => current.map((s, i) => (i === index ? { ...s, current: event.target.value } : s)))}
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
                    onChange={(event) => setStocks((current) => current.map((s, i) => (i === index ? { ...s, minimum: event.target.value } : s)))}
                    aria-label={`Stock mínimo en ${stock.branchName}`}
                  />
                  <input
                    className="input w-24"
                    value={stock.unit}
                    disabled={!stock.tracked}
                    onChange={(event) => setStocks((current) => current.map((s, i) => (i === index ? { ...s, unit: event.target.value } : s)))}
                    aria-label={`Unidad de stock en ${stock.branchName}`}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setDrawerOpen(false)} className="btn btn-secondary">
              Cancelar
            </button>
            <button type="button" onClick={saveIngredient} className="btn" disabled={busy}>
              {busy ? "Guardando…" : mode === "create" ? "Crear ingrediente" : "Guardar cambios"}
            </button>
          </div>
        </div>
      </Drawer>
    </div>
  );
}
