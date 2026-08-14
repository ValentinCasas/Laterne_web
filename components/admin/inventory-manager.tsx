"use client";

import { useCallback, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { stockMovementTypeLabels } from "@/lib/order-stock";
import { scopedFetch } from "@/lib/client-routing";
import { useViewMode, ViewModeToggle } from "@/components/admin/view-mode-toggle";

type Branch = { id: number; name: string; active: boolean };
type Product = {
  id: number;
  name: string;
  imageUrl: string;
  availability: string | null;
  categories: Array<{ category: { id: number; name: string } }>;
};
type Category = { id: number; name: string };
type Stock = {
  id: number;
  branchId: number;
  productId: number;
  tracked: boolean;
  current: string | number;
  minimum: string | number;
  unit: string;
};
type Movement = {
  id: string;
  type: string;
  quantity: string | number;
  balanceAfter: string | number;
  reason: string;
  createdAt: string;
  stock: { productId: number; product: { name: string }; branch: { name: string } };
};

type StockStatus = "all" | "normal" | "low" | "out";
type ControlFilter = "all" | "active" | "inactive";

const statusLabels: Record<StockStatus, string> = {
  all: "Todos",
  normal: "Normal",
  low: "Bajo mínimo",
  out: "Sin stock",
};

const controlLabels: Record<ControlFilter, string> = {
  all: "Cualquier control",
  active: "Con control",
  inactive: "Sin control",
};

/** @summary Presenta existencias por sucursal con vista lista/tarjetas, alertas y trazabilidad. */
export function InventoryManager({
  branches,
  products,
  categories,
  initialStocks,
  movements,
  initialBranchId,
}: {
  branches: Branch[];
  products: Product[];
  categories: Category[];
  initialStocks: Stock[];
  movements: Movement[];
  initialBranchId: number;
}) {
  const [branchId, setBranchId] = useState(initialBranchId || branches[0]?.id || 0);
  const [stocks, setStocks] = useState(initialStocks);
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<number | "all">("all");
  const [status, setStatus] = useState<StockStatus>("all");
  const [control, setControl] = useState<ControlFilter>("all");
  const [onlyLow, setOnlyLow] = useState(false);
  const [view, setView] = useViewMode("inventario");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [movementsFor, setMovementsFor] = useState<Product | null>(null);

  const stockState = useCallback(
    (product: Product): { stock: Stock | undefined; state: StockStatus } => {
      const stock = stocks.find((item) => item.branchId === branchId && item.productId === product.id);
      if (!stock?.tracked) return { stock, state: "all" };
      const current = Number(stock.current ?? 0);
      const state: StockStatus = current <= 0 ? "out" : current <= Number(stock.minimum) ? "low" : "normal";
      return { stock, state };
    },
    [branchId, stocks],
  );

  const visible = useMemo(
    () =>
      products.filter((product) => {
        const { state, stock } = stockState(product);
        const matchesQuery = product.name
          .toLocaleLowerCase("es")
          .includes(query.trim().toLocaleLowerCase("es"));
        const matchesCategory =
          categoryId === "all" ||
          product.categories.some((entry) => entry.category.id === categoryId);
        const matchesStatus = status === "all" || state === status;
        const low = state === "low" || state === "out";
        const tracked = stock?.tracked ?? false;
        const matchesControl =
          control === "all" || (control === "active" ? tracked : !tracked);
        return matchesQuery && matchesCategory && matchesStatus && (!onlyLow || low) && matchesControl;
      }),
    [categoryId, control, onlyLow, products, query, status, stockState],
  );

  const groups = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const product of visible) {
      const key = product.categories[0]?.category.name ?? "Sin categoría";
      const list = map.get(key) ?? [];
      list.push(product);
      map.set(key, list);
    }
    return [...map.entries()].sort((first, second) => first[0].localeCompare(second[0], "es"));
  }, [visible]);

  const stats = useMemo(() => {
    let withControl = 0;
    let low = 0;
    let out = 0;
    for (const product of products) {
      const { state } = stockState(product);
      if (state !== "all") withControl += 1;
      if (state === "low") low += 1;
      if (state === "out") out += 1;
    }
    return { total: products.length, withControl, low, out };
  }, [products, stockState]);

  /** @summary Aplica el filtro correspondiente al hacer click en un KPI superior. */
  function applyKpi(kind: "total" | "withControl" | "low" | "out") {
    setOnlyLow(false);
    if (kind === "total") {
      setStatus("all");
      setControl("all");
      return;
    }
    if (kind === "withControl") {
      setStatus("all");
      setControl("active");
      return;
    }
    setControl("all");
    setStatus(kind === "low" ? "low" : "out");
  }

  /** @summary Plegar o desplegar una categoría. */
  function toggleGroup(name: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function setAllGroups(collapse: boolean) {
    setCollapsed(collapse ? new Set(groups.map(([name]) => name)) : new Set());
  }

  /** @summary Guarda el nivel indicado y solicita un motivo para conservar trazabilidad del ajuste. */
  async function save(product: Product, values: { tracked: boolean; current: string; minimum: string; unit: string }) {
    const reason = await Swal.fire({
      title: "Motivo del ajuste",
      input: "text",
      inputPlaceholder: "Ej. Recuento de cierre",
      inputValidator: (value) => (value.trim().length < 3 ? "Explicá brevemente el ajuste" : undefined),
      showCancelButton: true,
      confirmButtonText: "Guardar stock",
      cancelButtonText: "Cancelar",
      background: "#18181b",
      color: "#fafafa",
    });
    if (!reason.isConfirmed) return;
    const response = await scopedFetch("/api/admin/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        branchId,
        productId: product.id,
        tracked: values.tracked,
        current: values.current,
        minimum: values.minimum,
        unit: values.unit,
        reason: reason.value,
      }),
    });
    const body = (await response.json().catch(() => ({}))) as { stock?: Stock; error?: string };
    if (!response.ok || !body.stock) {
      await Swal.fire({
        title: "No se pudo guardar",
        text: body.error,
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
      return;
    }
    setStocks((current) => [...current.filter((item) => item.id !== body.stock!.id), body.stock!]);
    setEditingId(null);
    await Swal.fire({
      title: "Inventario actualizado",
      icon: "success",
      timer: 1200,
      showConfirmButton: false,
      background: "#18181b",
      color: "#fafafa",
    });
  }

  const statusColor = (state: StockStatus) =>
    state === "normal"
      ? "bg-emerald-500/15 text-emerald-300"
      : state === "low"
        ? "bg-amber-500/15 text-amber-300"
        : state === "out"
          ? "bg-red-500/15 text-red-300"
          : "bg-white/10 text-[var(--admin-muted)]";

  const productMovements = (product: Product) =>
    movements.filter((movement) => movement.stock.productId === product.id);

  const kpis: Array<{ kind: "total" | "withControl" | "low" | "out"; label: string; value: number; color: string }> = [
    { kind: "total", label: "Productos", value: stats.total, color: "text-zinc-100" },
    { kind: "withControl", label: "Con control", value: stats.withControl, color: "text-sky-300" },
    { kind: "low", label: "Bajo mínimo", value: stats.low, color: "text-amber-300" },
    { kind: "out", label: "Sin stock", value: stats.out, color: "text-red-300" },
  ];

  return (
    <section>
      <AdminPageHeader
        eyebrow="Operación"
        title="Stock por sucursal"
        description="Activá el control solo en los productos que realmente quieras descontar con cada pedido."
        section="inventario"
      />
      <div className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <button
            className="card flex items-baseline justify-between gap-3 p-5 text-left transition hover:border-pink-500/40"
            key={kpi.kind}
            onClick={() => applyKpi(kpi.kind)}
            type="button"
            title="Aplicar filtro"
          >
            <span className="text-sm font-bold text-[var(--admin-muted)]">{kpi.label}</span>
            <span className={`text-3xl font-black tabular-nums ${kpi.color}`}>{kpi.value}</span>
          </button>
        ))}
      </div>
      <div className="card mt-4 grid gap-3 p-4 lg:grid-cols-[200px_minmax(240px,1fr)_auto]">
        <select
          className="input"
          value={branchId}
          onChange={(event) => setBranchId(Number(event.target.value))}
          aria-label="Sucursal"
        >
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
              {branch.active ? "" : " · inactiva"}
            </option>
          ))}
        </select>
        <input
          className="input"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar producto…"
        />
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="input flex-1"
            value={categoryId}
            onChange={(event) =>
              setCategoryId(event.target.value === "all" ? "all" : Number(event.target.value))
            }
            aria-label="Filtrar por categoría"
          >
            <option value="all">Todas las categorías</option>
            {categories.map((category) => (
              <option value={category.id} key={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold">
            <input type="checkbox" checked={onlyLow} onChange={(event) => setOnlyLow(event.target.checked)} />{" "}
            Solo alertas
          </label>
          <ViewModeToggle value={view} onChange={setView} />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {(["all", "normal", "low", "out"] as const).map((option) => (
          <button
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
              status === option
                ? "bg-pink-500/15 text-pink-300 ring-1 ring-pink-500/40"
                : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
            }`}
            key={option}
            onClick={() => setStatus(option)}
            type="button"
          >
            {statusLabels[option]}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-white/10" aria-hidden />
        {(["all", "active", "inactive"] as const).map((option) => (
          <button
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
              control === option
                ? "bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/40"
                : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
            }`}
            key={option}
            onClick={() => setControl(option)}
            type="button"
          >
            {controlLabels[option]}
          </button>
        ))}
      </div>

      {groups.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <button className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-bold text-zinc-400 hover:border-pink-500/40" onClick={() => setAllGroups(false)} type="button">
            Expandir todas
          </button>
          <button className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-bold text-zinc-400 hover:border-pink-500/40" onClick={() => setAllGroups(true)} type="button">
            Contraer todas
          </button>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {groups.map(([groupName, groupProducts]) => {
          const isCollapsed = collapsed.has(groupName);
          return (
            <section className="overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)]" key={groupName}>
              <button
                className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left"
                onClick={() => toggleGroup(groupName)}
                type="button"
              >
                <span className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-[var(--admin-muted)]">
                  <span className={`inline-block transition-transform ${isCollapsed ? "-rotate-90" : ""}`}>▾</span>
                  {groupName}
                </span>
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] tabular-nums text-zinc-400">
                  {groupProducts.length}
                </span>
              </button>
              {!isCollapsed && (
                view === "list" ? (
                  <div className="divide-y divide-white/10">
                    {groupProducts.map((product) => {
                      const { stock, state } = stockState(product);
                      const label = !stock?.tracked
                        ? "Sin control"
                        : state === "out"
                          ? "Sin stock"
                          : state === "low"
                            ? "Bajo mínimo"
                            : "Normal";
                      const editing = editingId === product.id;
                      return (
                        <div
                          className={`px-5 py-3 ${state === "low" ? "bg-amber-500/[.06]" : ""} ${state === "out" ? "bg-red-500/[.05]" : ""}`}
                          key={`${branchId}-${product.id}`}
                        >
                          {editing ? (
                            <ProductEditRow
                              product={product}
                              stock={stock}
                              onCancel={() => setEditingId(null)}
                              onSave={(values) => void save(product, values)}
                            />
                          ) : (
                            <div className="grid items-center gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto_auto]">
                              <div className="min-w-0">
                                <strong className="block truncate">{product.name}</strong>
                                {product.categories.length > 1 && (
                                  <p className="mt-0.5 truncate text-xs text-zinc-600">
                                    {product.categories.map((entry) => entry.category.name).join(" · ")}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-4 text-sm tabular-nums">
                                <span className="text-zinc-400">Stock <strong className="text-white">{Number(stock?.current ?? 0)}</strong></span>
                                <span className="text-zinc-500">Mín <strong className="text-zinc-300">{Number(stock?.minimum ?? 0)}</strong></span>
                              </div>
                              <span className="text-xs text-zinc-500">{stock?.unit ?? "unidad"}</span>
                              <span className={`rounded-full px-2.5 py-1 text-xs font-black ${statusColor(stock?.tracked ? state : "all")}`}>{label}</span>
                              <button className="rounded-lg bg-white/5 px-2.5 py-1.5 text-xs font-bold hover:bg-white/10" onClick={() => setMovementsFor(product)} type="button">
                                Ver movimientos
                              </button>
                              <div className="flex gap-1.5">
                                <button className="rounded-lg bg-white/5 px-2.5 py-1.5 text-xs font-bold hover:bg-pink-500/20" onClick={() => setEditingId(product.id)} type="button">
                                  Ajustar
                                </button>
                                <label className="flex items-center gap-1.5 text-xs text-zinc-400">
                                  <input type="checkbox" checked={stock?.tracked ?? false} onChange={(event) => void save(product, { tracked: event.target.checked, current: String(stock?.current ?? 0), minimum: String(stock?.minimum ?? 0), unit: stock?.unit ?? "unidad" })} />
                                  Auto
                                </label>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
                    {groupProducts.map((product) => {
                      const { stock, state } = stockState(product);
                      const label = !stock?.tracked
                        ? "Sin control"
                        : state === "out"
                          ? "Sin stock"
                          : state === "low"
                            ? "Bajo mínimo"
                            : "Normal";
                      return (
                        <article className={`rounded-2xl border p-4 ${state === "low" ? "border-amber-500/30 bg-amber-500/[.06]" : state === "out" ? "border-red-500/30 bg-red-500/[.05]" : "border-white/10 bg-white/[.02]"}`} key={product.id}>
                          <h3 className="truncate font-black">{product.name}</h3>
                          <p className="mt-0.5 truncate text-xs text-zinc-500">
                            {product.categories[0]?.category.name ?? "Sin categoría"}
                          </p>
                          <dl className="mt-4 grid grid-cols-3 gap-2">
                            <div>
                              <dt className="text-[10px] uppercase text-zinc-600">Stock</dt>
                              <dd className="text-lg font-black tabular-nums">{Number(stock?.current ?? 0)}</dd>
                            </div>
                            <div>
                              <dt className="text-[10px] uppercase text-zinc-600">Mínimo</dt>
                              <dd className="text-lg font-black tabular-nums">{Number(stock?.minimum ?? 0)}</dd>
                            </div>
                            <div>
                              <dt className="text-[10px] uppercase text-zinc-600">Unidad</dt>
                              <dd className="truncate text-lg font-black">{stock?.unit ?? "unidad"}</dd>
                            </div>
                          </dl>
                          <span className={`mt-3 inline-block rounded-full px-2.5 py-1 text-xs font-black ${statusColor(stock?.tracked ? state : "all")}`}>{label}</span>
                          <div className="mt-4 flex gap-2">
                            <button className="btn btn-secondary flex-1 py-2 text-xs" onClick={() => setEditingId(product.id)} type="button">
                              Ajustar
                            </button>
                            <button className="btn btn-secondary flex-1 py-2 text-xs" onClick={() => setMovementsFor(product)} type="button">
                              Movimientos
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )
              )}
            </section>
          );
        })}
        {!visible.length && (
          <p className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-sm text-zinc-500">
            No hay productos que coincidan con estos filtros.
          </p>
        )}
      </div>

      {movementsFor && (
        <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/85 p-4" onClick={() => setMovementsFor(null)}>
          <article className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-zinc-950 p-6" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-eyebrow">Historial de stock</p>
                <h2 className="mt-1 text-2xl font-black">{movementsFor.name}</h2>
              </div>
              <button className="grid h-10 w-10 place-items-center rounded-full bg-white/5 text-xl" onClick={() => setMovementsFor(null)} type="button" aria-label="Cerrar">
                ×
              </button>
            </div>
            <div className="mt-5 max-h-[60vh] space-y-2 overflow-y-auto">
              {productMovements(movementsFor).map((movement) => (
                <article className="rounded-xl bg-white/[.03] p-3" key={movement.id}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold">
                      {stockMovementTypeLabels[movement.type] ?? "Movimiento"}
                    </p>
                    <p className={`text-sm font-black tabular-nums ${Number(movement.quantity) > 0 ? "text-emerald-300" : "text-red-300"}`}>
                      {Number(movement.quantity) > 0 ? "+" : ""}
                      {Number(movement.quantity)}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    {new Date(movement.createdAt).toLocaleString("es-AR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">{movement.reason}</p>
                  <p className="mt-1 text-xs text-zinc-600">Stock final: {Number(movement.balanceAfter)}</p>
                </article>
              ))}
              {!productMovements(movementsFor).length && (
                <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-zinc-500">
                  Este producto todavía no tiene movimientos registrados.
                </p>
              )}
            </div>
          </article>
        </div>
      )}
    </section>
  );
}

/** @summary Fila de edición inline para ajustar existencias sin que la tabla parezca una planilla. */
function ProductEditRow({
  product,
  stock,
  onCancel,
  onSave,
}: {
  product: Product;
  stock: Stock | undefined;
  onCancel: () => void;
  onSave: (values: { tracked: boolean; current: string; minimum: string; unit: string }) => void;
}) {
  const [current, setCurrent] = useState(String(stock?.current ?? 0));
  const [minimum, setMinimum] = useState(String(stock?.minimum ?? 0));
  const [unit, setUnit] = useState(stock?.unit ?? "unidad");
  const [tracked, setTracked] = useState(stock?.tracked ?? false);
  return (
    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_110px_110px_120px_auto_auto] md:items-center">
      <div className="min-w-0">
        <strong className="block truncate">{product.name}</strong>
        <p className="text-xs text-zinc-600">Ajustando existencias</p>
      </div>
      <label className="text-xs font-bold text-zinc-400">
        Actual
        <input className="input mt-1 py-2" type="number" min="0" step="0.001" value={current} onChange={(event) => setCurrent(event.target.value)} />
      </label>
      <label className="text-xs font-bold text-zinc-400">
        Mínimo
        <input className="input mt-1 py-2" type="number" min="0" step="0.001" value={minimum} onChange={(event) => setMinimum(event.target.value)} />
      </label>
      <label className="text-xs font-bold text-zinc-400">
        Unidad
        <input className="input mt-1 py-2" value={unit} onChange={(event) => setUnit(event.target.value)} />
      </label>
      <label className="flex items-center gap-2 text-xs font-bold text-zinc-400">
        <input type="checkbox" checked={tracked} onChange={(event) => setTracked(event.target.checked)} /> Control automático
      </label>
      <div className="flex gap-2">
        <button className="btn py-2 text-sm" onClick={() => onSave({ tracked, current, minimum, unit })} type="button">
          Guardar
        </button>
        <button className="btn btn-secondary py-2 text-sm" onClick={onCancel} type="button">
          Cancelar
        </button>
      </div>
    </div>
  );
}