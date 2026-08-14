"use client";

import { useCallback, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { stockMovementTypeLabels } from "@/lib/order-stock";
import { scopedFetch } from "@/lib/client-routing";

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
  stock: { product: { name: string }; branch: { name: string } };
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

/** @summary Presenta existencias por sucursal, alertas de mínimo y un historial de ajustes auditables. */
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

  /** @summary Deriva el estado de stock de un producto en la sucursal elegida. */
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
    return [...map.entries()];
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

  /** @summary Guarda el nivel indicado y solicita un motivo para conservar trazabilidad del ajuste. */
  async function save(product: Product, form: HTMLFormElement) {
    const data = new FormData(form);
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
        tracked: data.get("tracked") === "on",
        current: data.get("current"),
        minimum: data.get("minimum"),
        unit: data.get("unit"),
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

  return (
    <section>
      <AdminPageHeader
        eyebrow="Operación"
        title="Stock por sucursal"
        description="Activá el control solo en los productos que realmente quieras descontar con cada pedido."
        section="inventario"
      />
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Productos", String(stats.total), "text-zinc-100"],
          ["Con control de stock", String(stats.withControl), "text-sky-300"],
          ["Bajo mínimo", String(stats.low), "text-amber-300"],
          ["Sin stock", String(stats.out), "text-red-300"],
        ].map(([label, value, color]) => (
          <article className="card flex items-baseline justify-between gap-3 p-5" key={label}>
            <p className="text-sm font-bold text-[var(--admin-muted)]">{label}</p>
            <strong className={`text-3xl font-black tabular-nums ${color}`}>{value}</strong>
          </article>
        ))}
      </div>
      <div className="card mt-4 grid gap-3 p-4 lg:grid-cols-[200px_minmax(240px,1fr)_auto_auto]">
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
        <select
          className="input"
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
        <label className="flex items-center gap-2 rounded-xl border border-white/10 px-4 text-sm font-bold">
          <input type="checkbox" checked={onlyLow} onChange={(event) => setOnlyLow(event.target.checked)} />{" "}
          Solo alertas
        </label>
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
      <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="hidden grid-cols-[minmax(220px,1.6fr)_120px_120px_130px_130px_120px_100px] gap-4 border-b border-[var(--admin-border)] px-5 py-3 text-xs font-black uppercase tracking-wider text-[var(--admin-muted)] lg:grid">
          <span>Producto</span><span>Actual</span><span>Mínimo</span><span>Unidad</span><span>Control</span><span>Estado</span><span />
        </div>
        <div className="divide-y divide-white/10">
          {groups.map(([groupName, groupProducts]) => (
            <section key={groupName}>
              <h3 className="sticky top-0 z-10 flex items-center gap-2 bg-[var(--admin-surface)] px-5 py-2 text-xs font-black uppercase tracking-wider text-[var(--admin-muted)]">
                <span>{groupName}</span>
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] tabular-nums">
                  {groupProducts.length}
                </span>
              </h3>
              <div className="divide-y divide-white/10">
                {groupProducts.map((product) => {
                  const { stock, state } = stockState(product);
                  const label = !stock?.tracked
                    ? "Control desactivado"
                    : state === "out"
                      ? "Sin stock"
                      : state === "low"
                        ? "Bajo stock"
                        : "Normal";
                  return (
                    <form
                      key={`${branchId}-${product.id}`}
                      className={`grid gap-3 px-5 py-4 lg:grid-cols-[minmax(220px,1.6fr)_120px_120px_130px_130px_120px_100px] lg:items-center ${state === "low" ? "bg-amber-500/[.06]" : ""} ${state === "out" ? "bg-red-500/[.05]" : ""}`}
                      onSubmit={(event) => {
                        event.preventDefault();
                        void save(product, event.currentTarget);
                      }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <strong className="block truncate">{product.name}</strong>
                          {product.categories.length > 1 && (
                            <p className="mt-0.5 truncate text-xs text-zinc-600">
                              {product.categories.map((entry) => entry.category.name).join(" · ")}
                            </p>
                          )}
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-black lg:hidden ${statusColor(stock?.tracked ? state : "all")}`}>{label}</span>
                      </div>
                      <label className="text-xs text-zinc-500"><span className="lg:hidden">Actual</span><input className="input mt-1 py-2" name="current" type="number" min="0" step="0.001" defaultValue={Number(stock?.current ?? 0)} /></label>
                      <label className="text-xs text-zinc-500"><span className="lg:hidden">Mínimo</span><input className="input mt-1 py-2" name="minimum" type="number" min="0" step="0.001" defaultValue={Number(stock?.minimum ?? 0)} /></label>
                      <label className="text-xs text-zinc-500"><span className="lg:hidden">Unidad</span><input className="input mt-1 py-2" name="unit" defaultValue={stock?.unit ?? "unidad"} /></label>
                      <label className="flex items-center gap-2 text-sm lg:justify-center"><input name="tracked" type="checkbox" defaultChecked={stock?.tracked ?? false} /><span>Automático</span></label>
                      <span className={`hidden rounded-full px-2 py-1 text-center text-xs font-black lg:block ${statusColor(stock?.tracked ? state : "all")}`}>{label}</span>
                      <button className="btn py-2 text-sm">Guardar</button>
                    </form>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
        {!visible.length && (
          <p className="p-8 text-center text-sm text-zinc-500">No hay productos que coincidan con estos filtros.</p>
        )}
      </div>
      <section className="card mt-8 p-5">
        <h2 className="text-xl font-black">Últimos movimientos</h2>
        <div className="mt-4 max-h-96 space-y-2 overflow-y-auto">
          {movements.map((movement) => (
            <article
              key={movement.id}
              className="grid gap-1 rounded-xl bg-white/[.03] p-3 sm:grid-cols-[1fr_auto]"
            >
              <div>
                <strong>{movement.stock.product.name}</strong>
                <p className="text-sm text-zinc-500">
                  {stockMovementTypeLabels[movement.type] ?? "Movimiento"} · {movement.stock.branch.name}
                </p>
                <p className="text-xs text-zinc-600">{movement.reason}</p>
              </div>
              <p className="text-sm font-bold">
                {Number(movement.quantity) > 0 ? "+" : ""}
                {Number(movement.quantity)} → {Number(movement.balanceAfter)}
              </p>
            </article>
          ))}
          {!movements.length && <p className="text-sm text-zinc-500">Todavía no hay ajustes registrados.</p>}
        </div>
      </section>
    </section>
  );
}
