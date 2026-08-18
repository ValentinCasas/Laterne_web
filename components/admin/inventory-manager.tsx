"use client";

import { useCallback, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { PageHeader, Tabs, StatusBadge, EmptyState } from "@/components/admin/ui";
import { stockMovementTypeLabels } from "@/lib/order-stock";
import { scopedFetch } from "@/lib/client-routing";
import { useViewMode, ViewModeToggle } from "@/components/admin/view-mode-toggle";

type Branch = { id: number; name: string; active: boolean };
type Product = {
  id: number;
  name: string;
  imageUrl: string;
  availability: string | null;
  cost: string | null;
  costUnit: string;
  categories: Array<{ category: { id: number; name: string } }>;
};
type Category = { id: number; name: string };
type Stock = {
  id: number;
  branchId: number;
  productId: number;
  tracked: boolean;
  current: string | number;
  reserved: string | number;
  minimum: string | number;
  unit: string;
};
type Movement = {
  id: string;
  type: string;
  quantity: string | number;
  balanceAfter: string | number;
  reason: string;
  reference?: string | null;
  createdAt: string;
  stock: { productId: number; product: { name: string }; branch: { name: string } };
};

type StockStatus = "all" | "normal" | "low" | "out";
type ControlFilter = "all" | "active" | "inactive";
type Tab = "resumen" | "stock" | "movimientos" | "conteos" | "transferencias";

type Dashboard = {
  value: number | null;
  valuedProducts: number;
  lowCount: number;
  outCount: number;
  totalStocks: number;
  wasteCount: number;
  wasteQuantity: number;
  wasteCost: number | null;
  recentMovements: Array<{
    id: string;
    type: string;
    quantity: string;
    balanceAfter: string;
    reason: string;
    reference?: string | null;
    createdAt: string;
    product: string;
    branch: string;
    user: string | null;
  }>;
  lowStocks: Array<{ productId: number; name: string; current: number; minimum: number; unit: string }>;
};

type CountSession = {
  id: number;
  reference: string;
  status: string;
  note: string | null;
  startedAt: string;
  completedAt: string | null;
  branch: { name: string } | null;
  startedBy: { name: string } | null;
  completedBy: { name: string } | null;
  _count: { items: number };
};

type CountSessionDetail = CountSession & {
  items: Array<{
    id: number;
    productId: number;
    systemQuantity: string;
    countedQuantity: string;
    difference: string;
    adjusted: boolean;
    product: { id: number; name: string };
  }>;
};

type TransferRow = {
  id: number;
  reference: string;
  status: string;
  quantity: string;
  unit: string;
  note: string | null;
  createdAt: string;
  fromBranch: { name: string };
  toBranch: { name: string };
  product: { name: string };
  createdBy: { name: string } | null;
};

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

const tabLabels: Array<{ id: Tab; label: string }> = [
  { id: "resumen", label: "Resumen" },
  { id: "stock", label: "Stock por sucursal" },
  { id: "movimientos", label: "Movimientos" },
  { id: "conteos", label: "Conteos físicos" },
  { id: "transferencias", label: "Transferencias" },
];

/** @summary Muestra un error de operación sin romper la pantalla. */
async function showError(title: string, reason: unknown) {
  await Swal.fire({
    title,
    text: reason instanceof Error ? reason.message : "Intentá nuevamente.",
    icon: "error",
    background: "#18181b",
    color: "#fafafa",
  });
}

/** @summary Presenta existencias por sucursal con dashboard, historial, conteos y transferencias. */
export function InventoryManager({
  branches,
  products,
  categories,
  initialStocks,
  movements,
  initialBranchId,
  settings,
  dashboard,
  initialCounts,
  initialTransfers,
}: {
  branches: Branch[];
  products: Product[];
  categories: Category[];
  initialStocks: Stock[];
  movements: Movement[];
  initialBranchId: number;
  settings: { stockPolicy: "strict" | "warn" };
  dashboard: Dashboard;
  initialCounts: CountSession[];
  initialTransfers: TransferRow[];
}) {
  const [tab, setTab] = useState<Tab>("resumen");
  const [branchId, setBranchId] = useState(initialBranchId || branches[0]?.id || 0);
  const [stocks, setStocks] = useState(initialStocks);
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<number | "all">("all");
  const [status, setStatus] = useState<StockStatus>("all");
  const [control, setControl] = useState<ControlFilter>("all");
  const [onlyLow, setOnlyLow] = useState(false);
  const [view, setView] = useViewMode("inventario");
  const isListView = view === "list" || view === "list-compact";
  const compactList = view === "list-compact";
  const compactCards = view === "cards-compact";
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [movementsFor, setMovementsFor] = useState<Product | null>(null);
  const [wasteFor, setWasteFor] = useState<Product | null>(null);
  const [reserveFor, setReserveFor] = useState<Product | null>(null);
  const [stockPolicy, setStockPolicy] = useState(settings.stockPolicy);

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
          categoryId === "all" || product.categories.some((entry) => entry.category.id === categoryId);
        const matchesStatus = status === "all" || state === status;
        const low = state === "low" || state === "out";
        const tracked = stock?.tracked ?? false;
        const matchesControl = control === "all" || (control === "active" ? tracked : !tracked);
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
  async function save(
    product: Product,
    values: { tracked: boolean; current: string; minimum: string; unit: string },
  ) {
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
      await showError("No se pudo guardar", new Error(body.error ?? "Error desconocido"));
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

  /** @summary Registra una merma con motivo. */
  async function registerWaste(product: Product, quantity: number, reason: string) {
    const response = await scopedFetch("/api/admin/inventory/waste", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branchId, productId: product.id, quantity, reason }),
    });
    const body = (await response.json().catch(() => ({}))) as { result?: { stockId: number }; error?: string };
    if (!response.ok || !body.result) {
      await showError("No se pudo registrar la merma", new Error(body.error ?? "Error desconocido"));
      return false;
    }
    await refreshStocks();
    return true;
  }

  /** @summary Reserva o libera stock. */
  async function changeReserve(
    product: Product,
    quantity: number,
    reason: string,
    action: "reserve" | "release",
  ) {
    const response = await scopedFetch("/api/admin/inventory/reserve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branchId, productId: product.id, quantity, reason, action }),
    });
    const body = (await response.json().catch(() => ({}))) as { result?: { stock: Stock }; error?: string };
    if (!response.ok || !body.result) {
      await showError("No se pudo completar la operación", new Error(body.error ?? "Error desconocido"));
      return false;
    }
    await refreshStocks();
    return true;
  }

  /** @summary Refresca las existencias de la sucursal activa. */
  const refreshStocks = useCallback(async () => {
    try {
      const response = await scopedFetch("/api/admin/inventory");
      const body = (await response.json().catch(() => ({}))) as { stocks?: Stock[]; error?: string };
      if (response.ok && body.stocks) setStocks(body.stocks);
    } catch {
      // El listado local queda como está; los flujos muestran su propio resultado.
    }
  }, []);

  /** @summary Guarda la política de stock del negocio. */
  async function savePolicy(policy: "strict" | "warn") {
    const response = await scopedFetch("/api/admin/inventory/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stockPolicy: policy }),
    });
    const body = (await response.json().catch(() => ({}))) as { stockPolicy?: string; error?: string };
    if (!response.ok || !body.stockPolicy) {
      await showError("No se pudo guardar la política", new Error(body.error ?? "Error desconocido"));
      return;
    }
    setStockPolicy(policy);
    await Swal.fire({
      title: policy === "strict" ? "Política estricta" : "Política permisiva",
      text:
        policy === "strict"
          ? "No se puede vender sin stock disponible."
          : "Se puede vender sin stock; quedará stock negativo con advertencia.",
      icon: "success",
      timer: 1800,
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

  const kpis: Array<{
    kind: "total" | "withControl" | "low" | "out";
    label: string;
    value: number;
    color: string;
  }> = [
    { kind: "total", label: "Productos", value: stats.total, color: "text-zinc-100" },
    { kind: "withControl", label: "Con control", value: stats.withControl, color: "text-sky-300" },
    { kind: "low", label: "Bajo mínimo", value: stats.low, color: "text-amber-300" },
    { kind: "out", label: "Sin stock", value: stats.out, color: "text-red-300" },
  ];

  const money = (value: number | null | undefined) => {
    if (value === null || value === undefined || !Number.isFinite(value)) return "—";
    return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
  };

  const dateTime = (value: string) =>
    new Date(value).toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <section>
      <PageHeader
        eyebrow="Operación"
        title="Inventario"
        section="inventario"
        description="Stock por sucursal, movimientos trazables, conteos físicos, mermas y transferencias entre locales. El valor del inventario se calcula con el costo de los ingredientes."
      >
        <Tabs
          tabs={tabLabels.map((item) => ({ key: item.id, label: item.label }))}
          defaultTab={tab}
          onChange={(key) => setTab(key as Tab)}
        />
      </PageHeader>

      {/* ============ RESUMEN (dashboard) ============ */}
      {tab === "resumen" && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <div className="card p-5">
              <p className="text-sm font-bold text-[var(--admin-muted)]">Valor del inventario</p>
              <p className="mt-1 text-3xl font-black tabular-nums text-emerald-300">{money(dashboard.value)}</p>
              <p className="mt-1 text-xs text-[var(--admin-muted)]">
                {dashboard.valuedProducts} de {dashboard.totalStocks} existencias con costo
              </p>
            </div>
            <button type="button" onClick={() => { setTab("stock"); applyKpi("low"); }} className="card p-5 text-left transition hover:border-amber-500/40">
              <p className="text-sm font-bold text-[var(--admin-muted)]">Stock bajo mínimo</p>
              <p className="mt-1 text-3xl font-black tabular-nums text-amber-300">{dashboard.lowCount}</p>
            </button>
            <button type="button" onClick={() => { setTab("stock"); applyKpi("out"); }} className="card p-5 text-left transition hover:border-red-500/40">
              <p className="text-sm font-bold text-[var(--admin-muted)]">Sin stock</p>
              <p className="mt-1 text-3xl font-black tabular-nums text-red-300">{dashboard.outCount}</p>
            </button>
            <button type="button" onClick={() => setTab("movimientos")} className="card p-5 text-left transition hover:border-orange-500/40">
              <p className="text-sm font-bold text-[var(--admin-muted)]">Mermas (30 días)</p>
              <p className="mt-1 text-3xl font-black tabular-nums text-orange-300">{dashboard.wasteCount}</p>
              <p className="mt-1 text-xs text-[var(--admin-muted)]">
                {dashboard.wasteQuantity} unidades · costo {money(dashboard.wasteCost)}
              </p>
            </button>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-black">Política de venta sin stock</h2>
                <select
                  className="input w-56"
                  value={stockPolicy}
                  onChange={(event) => void savePolicy(event.target.value as "strict" | "warn")}
                  aria-label="Política de stock"
                >
                  <option value="strict">Estricta · impedir venta</option>
                  <option value="warn">Permisiva · vender con advertencia</option>
                </select>
              </div>
              <p className="mt-3 text-sm text-[var(--admin-muted)]">
                {stockPolicy === "strict"
                  ? "Cuando no hay stock disponible, el pedido se rechaza con un mensaje claro y nunca queda stock negativo."
                  : "El pedido avanza aunque no alcance el stock; queda stock negativo con advertencia en el historial."}
              </p>
            </div>

            <div className="card p-5">
              <h2 className="text-lg font-black">Stock bajo</h2>
              <ul className="mt-3 space-y-2">
                {dashboard.lowStocks.slice(0, 6).map((item) => (
                  <li key={item.productId} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate font-semibold">{item.name}</span>
                    <span className={`tabular-nums font-bold ${item.current <= 0 ? "text-red-300" : "text-amber-300"}`}>
                      {item.current} / mín {item.minimum} {item.unit}
                    </span>
                  </li>
                ))}
                {dashboard.lowStocks.length === 0 && (
                  <p className="text-sm text-[var(--admin-muted)]">No hay productos bajo el mínimo.</p>
                )}
              </ul>
            </div>
          </div>

          <div className="card p-5">
            <h2 className="text-lg font-black">Movimientos recientes</h2>
            <div className="mt-3 divide-y divide-white/10">
              {dashboard.recentMovements.map((movement) => (
                <div key={movement.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm">
                  <span className="text-xs tabular-nums text-[var(--admin-muted)]">{dateTime(movement.createdAt)}</span>
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-semibold">
                    {stockMovementTypeLabels[movement.type] ?? movement.type}
                  </span>
                  <span className="font-semibold">{movement.product}</span>
                  <span className="text-[var(--admin-muted)]">{movement.branch}</span>
                  <span className={`ml-auto font-black tabular-nums ${Number(movement.quantity) > 0 ? "text-emerald-300" : "text-red-300"}`}>
                    {Number(movement.quantity) > 0 ? "+" : ""}
                    {Number(movement.quantity)}
                  </span>
                </div>
              ))}
              {dashboard.recentMovements.length === 0 && (
                <p className="py-4 text-sm text-[var(--admin-muted)]">Todavía no hay movimientos registrados.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============ STOCK ============ */}
      {tab === "stock" && (
        <>
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
              <button
                className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-bold text-zinc-400 hover:border-pink-500/40"
                onClick={() => setAllGroups(false)}
                type="button"
              >
                Expandir todas
              </button>
              <button
                className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-bold text-zinc-400 hover:border-pink-500/40"
                onClick={() => setAllGroups(true)}
                type="button"
              >
                Contraer todas
              </button>
            </div>
          )}

          <div className="mt-4 space-y-3">
            {groups.map(([groupName, groupProducts]) => {
              const isCollapsed = collapsed.has(groupName);
              return (
                <section
                  className="overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)]"
                  key={groupName}
                >
                  <button
                    className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left"
                    onClick={() => toggleGroup(groupName)}
                    type="button"
                  >
                    <span className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-[var(--admin-muted)]">
                      <span className={`inline-block transition-transform ${isCollapsed ? "-rotate-90" : ""}`}>
                        ▾
                      </span>
                      {groupName}
                    </span>
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] tabular-nums text-zinc-400">
                      {groupProducts.length}
                    </span>
                  </button>
                  {!isCollapsed &&
                    (isListView ? (
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
                          const available = stock ? Number(stock.current) - Number(stock.reserved ?? 0) : 0;
                          return (
                            <div
                              className={`${compactList ? "px-3 py-2" : "px-5 py-3"} ${state === "low" ? "bg-amber-500/[.06]" : ""} ${state === "out" ? "bg-red-500/[.05]" : ""}`}
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
                                <div className="grid items-center gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto]">
                                  <div className="min-w-0">
                                    <strong className="block truncate">{product.name}</strong>
                                    {product.categories.length > 1 && (
                                      <p className="mt-0.5 truncate text-xs text-zinc-600">
                                        {product.categories.map((entry) => entry.category.name).join(" · ")}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-4 text-sm tabular-nums">
                                    <span className="text-zinc-400">
                                      Físico <strong className="text-white">{Number(stock?.current ?? 0)}</strong>
                                    </span>
                                    {stock?.tracked && (
                                      <>
                                        <span className="text-zinc-500">
                                          Disp.{" "}
                                          <strong className={available < 0 ? "text-red-300" : "text-zinc-300"}>
                                            {available}
                                          </strong>
                                        </span>
                                        <span className="text-zinc-500">
                                          Res. <strong className="text-sky-300">{Number(stock?.reserved ?? 0)}</strong>
                                        </span>
                                      </>
                                    )}
                                    <span className="text-zinc-500">
                                      Mín <strong className="text-zinc-300">{Number(stock?.minimum ?? 0)}</strong>
                                    </span>
                                  </div>
                                  <span className="text-xs text-zinc-500">{stock?.unit ?? "unidad"}</span>
                                  <span
                                    className={`rounded-full px-2.5 py-1 text-xs font-black ${statusColor(stock?.tracked ? state : "all")}`}
                                  >
                                    {label}
                                  </span>
                                  <div className="flex flex-wrap gap-1.5">
                                    <button
                                      className="rounded-lg bg-white/5 px-2.5 py-1.5 text-xs font-bold hover:bg-white/10"
                                      onClick={() => setMovementsFor(product)}
                                      type="button"
                                    >
                                      Movs.
                                    </button>
                                    <button
                                      className="rounded-lg bg-white/5 px-2.5 py-1.5 text-xs font-bold hover:bg-pink-500/20"
                                      onClick={() => setEditingId(product.id)}
                                      type="button"
                                    >
                                      Ajustar
                                    </button>
                                    <button
                                      className="rounded-lg bg-white/5 px-2.5 py-1.5 text-xs font-bold hover:bg-orange-500/20"
                                      onClick={() => setWasteFor(product)}
                                      disabled={!stock?.tracked}
                                      type="button"
                                    >
                                      Mermar
                                    </button>
                                    <button
                                      className="rounded-lg bg-white/5 px-2.5 py-1.5 text-xs font-bold hover:bg-sky-500/20"
                                      onClick={() => setReserveFor(product)}
                                      disabled={!stock?.tracked}
                                      type="button"
                                    >
                                      Reservar
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className={`grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3 ${compactCards ? "gap-2.5" : "gap-3"}`}>
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
                            <article
                              className={`rounded-2xl border p-4 ${state === "low" ? "border-amber-500/30 bg-amber-500/[.06]" : state === "out" ? "border-red-500/30 bg-red-500/[.05]" : "border-white/10 bg-white/[.02]"}`}
                              key={product.id}
                            >
                              <h3 className="truncate font-black">{product.name}</h3>
                              <p className="mt-0.5 truncate text-xs text-zinc-500">
                                {product.categories[0]?.category.name ?? "Sin categoría"}
                              </p>
                              <dl className="mt-4 grid grid-cols-3 gap-2">
                                <div>
                                  <dt className="text-[10px] uppercase text-zinc-600">Físico</dt>
                                  <dd className="text-lg font-black tabular-nums">{Number(stock?.current ?? 0)}</dd>
                                </div>
                                <div>
                                  <dt className="text-[10px] uppercase text-zinc-600">Disp.</dt>
                                  <dd className="text-lg font-black tabular-nums">
                                    {Number(stock?.current ?? 0) - Number(stock?.reserved ?? 0)}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="text-[10px] uppercase text-zinc-600">Mínimo</dt>
                                  <dd className="text-lg font-black tabular-nums">{Number(stock?.minimum ?? 0)}</dd>
                                </div>
                              </dl>
                              <span
                                className={`mt-3 inline-block rounded-full px-2.5 py-1 text-xs font-black ${statusColor(stock?.tracked ? state : "all")}`}
                              >
                                {label}
                              </span>
                              <div className="mt-4 flex gap-2">
                                <button
                                  className="btn btn-secondary flex-1 py-2 text-xs"
                                  onClick={() => setEditingId(product.id)}
                                  type="button"
                                >
                                  Ajustar
                                </button>
                                <button
                                  className="btn btn-secondary flex-1 py-2 text-xs"
                                  onClick={() => setMovementsFor(product)}
                                  type="button"
                                >
                                  Movimientos
                                </button>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    ))}
                </section>
              );
            })}
            {!visible.length && (
              <EmptyState title="No hay productos que coincidan con estos filtros" description="Probá modificar la búsqueda o los filtros aplicados." />
            )}
          </div>
        </>
      )}

      {/* ============ MOVIMIENTOS ============ */}
      {tab === "movimientos" && <MovementsHistory branches={branches} products={products} />}

      {/* ============ CONTEOS ============ */}
      {tab === "conteos" && (
        <CountSections
          branches={branches}
          initialCounts={initialCounts}
          initialBranchId={branchId}
        />
      )}

      {/* ============ TRANSFERENCIAS ============ */}
      {tab === "transferencias" && (
        <TransfersSection branches={branches} initialTransfers={initialTransfers} products={products} />
      )}

      {/* Modal: movimientos de un producto */}
      {movementsFor && (
        <div
          className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/85 p-4"
          onClick={() => setMovementsFor(null)}
        >
          <article
            className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-zinc-950 p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-eyebrow">Historial de stock</p>
                <h2 className="mt-1 text-2xl font-black">{movementsFor.name}</h2>
              </div>
              <button
                className="grid h-10 w-10 place-items-center rounded-full bg-white/5 text-xl"
                onClick={() => setMovementsFor(null)}
                type="button"
                aria-label="Cerrar"
              >
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
                    <p
                      className={`text-sm font-black tabular-nums ${Number(movement.quantity) > 0 ? "text-emerald-300" : "text-red-300"}`}
                    >
                      {Number(movement.quantity) > 0 ? "+" : ""}
                      {Number(movement.quantity)}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">{dateTime(movement.createdAt)}</p>
                  <p className="mt-1 text-xs text-zinc-400">
                    {movement.reference ? `${movement.reference} · ` : ""}
                    {movement.reason}
                  </p>
                  <p className="mt-1 text-xs text-zinc-600">Stock final: {Number(movement.balanceAfter)}</p>
                </article>
              ))}
              {!productMovements(movementsFor).length && (
                <EmptyState title="Este producto todavía no tiene movimientos registrados" />
              )}
            </div>
          </article>
        </div>
      )}

      {/* Modal: registrar merma */}
      {wasteFor && (
        <ActionModal
          title={`Registrar merma · ${wasteFor.name}`}
          description="La merma descuenta stock con su motivo y el costo se estima con el snapshot del producto."
          fields={[
            { name: "quantity", label: "Cantidad", type: "number", placeholder: "0" },
            { name: "reason", label: "Motivo", type: "text", placeholder: "Ej. Se rompió, caducó, error de producción" },
          ]}
          confirmText="Registrar merma"
          onCancel={() => setWasteFor(null)}
          onSubmit={async (values) => {
            const ok = await registerWaste(wasteFor, Number(values.quantity), values.reason);
            if (ok) setWasteFor(null);
          }}
        />
      )}

      {/* Modal: reservar / liberar */}
      {reserveFor && (
        <ActionModal
          title={`Reservar stock · ${reserveFor.name}`}
          description="La reserva compromete unidades (disponible = físico − reservado) sin tocar el físico."
          fields={[
            { name: "quantity", label: "Cantidad", type: "number", placeholder: "0" },
            { name: "reason", label: "Motivo", type: "text", placeholder: "Ej. Reserva para evento" },
          ]}
          confirmText="Reservar"
          secondaryText="Liberar reserva"
          onCancel={() => setReserveFor(null)}
          onSubmit={async (values, secondary) => {
            const ok = await changeReserve(
              reserveFor,
              Number(values.quantity),
              values.reason,
              secondary ? "release" : "reserve",
            );
            if (ok) setReserveFor(null);
          }}
        />
      )}
    </section>
  );
}

/** @summary Modal de acción simple (merma / reserva). */
function ActionModal({
  title,
  description,
  fields,
  confirmText,
  secondaryText,
  onCancel,
  onSubmit,
}: {
  title: string;
  description: string;
  fields: Array<{ name: string; label: string; type: string; placeholder?: string }>;
  confirmText: string;
  secondaryText?: string;
  onCancel: () => void;
  onSubmit: (values: Record<string, string>, secondary?: boolean) => Promise<void>;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/85 p-4" onClick={onCancel}>
      <form
        className="w-full max-w-md rounded-[2rem] border border-white/10 bg-zinc-950 p-6"
        onClick={(event) => event.stopPropagation()}
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          try {
            await onSubmit(values);
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2 className="text-xl font-black">{title}</h2>
        <p className="mt-1 text-sm text-[var(--admin-muted)]">{description}</p>
        <div className="mt-5 space-y-3">
          {fields.map((field) => (
            <label key={field.name} className="block">
              <span className="block text-xs font-semibold text-[var(--admin-muted)]">{field.label}</span>
              <input
                className="input mt-1"
                type={field.type}
                required={field.name === "quantity"}
                min={field.type === "number" ? 0 : undefined}
                step={field.type === "number" ? "0.001" : undefined}
                value={values[field.name] ?? ""}
                placeholder={field.placeholder}
                onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}
              />
            </label>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="submit" className="btn" disabled={busy}>
            {busy ? "Procesando…" : confirmText}
          </button>
          {secondaryText && (
            <button
              type="submit"
              className="btn btn-secondary"
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                setBusy(true);
                void onSubmit(values, true).finally(() => setBusy(false));
              }}
            >
              {busy ? "Procesando…" : secondaryText}
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
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
        <input
          className="input mt-1 py-2"
          type="number"
          min="0"
          step="0.001"
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
        />
      </label>
      <label className="text-xs font-bold text-zinc-400">
        Mínimo
        <input
          className="input mt-1 py-2"
          type="number"
          min="0"
          step="0.001"
          value={minimum}
          onChange={(event) => setMinimum(event.target.value)}
        />
      </label>
      <label className="text-xs font-bold text-zinc-400">
        Unidad
        <input className="input mt-1 py-2" value={unit} onChange={(event) => setUnit(event.target.value)} />
      </label>
      <label className="flex items-center gap-2 text-xs font-bold text-zinc-400">
        <input type="checkbox" checked={tracked} onChange={(event) => setTracked(event.target.checked)} />{" "}
        Control automático
      </label>
      <div className="flex gap-2">
        <button
          className="btn py-2 text-sm"
          onClick={() => onSave({ tracked, current, minimum, unit })}
          type="button"
        >
          Guardar
        </button>
        <button className="btn btn-secondary py-2 text-sm" onClick={onCancel} type="button">
          Cancelar
        </button>
      </div>
    </div>
  );
}

/** @summary Historial de movimientos con filtros y paginación. */
function MovementsHistory({ branches, products }: { branches: Branch[]; products: Product[] }) {
  const [filters, setFilters] = useState({
    branchId: "",
    type: "",
    productId: "",
    from: "",
    to: "",
    search: "",
  });
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (append = false) => {
      setBusy(true);
      try {
        const params = new URLSearchParams();
        if (filters.branchId) params.set("branchId", filters.branchId);
        if (filters.type) params.set("type", filters.type);
        if (filters.productId) params.set("productId", filters.productId);
        if (filters.from) params.set("from", filters.from);
        if (filters.to) params.set("to", filters.to);
        if (filters.search) params.set("search", filters.search);
        if (append) params.set("offset", String(rows.length));
        const response = await scopedFetch(`/api/admin/inventory/movements?${params.toString()}`);
        const body = (await response.json().catch(() => ({}))) as {
          movements?: Array<Record<string, unknown>>;
          total?: number;
          error?: string;
        };
        if (!response.ok) throw new Error(body.error ?? "No se pudieron cargar los movimientos");
        setRows((current) => (append ? [...current, ...(body.movements ?? [])] : body.movements ?? []));
        setTotal(body.total ?? 0);
      } catch (reason) {
        await showError("No se pudieron cargar los movimientos", reason);
      } finally {
        setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filters],
  );

  const movementTypes = Object.keys(stockMovementTypeLabels);

  return (
    <div className="space-y-4">
      <div className="card grid gap-3 p-4 lg:grid-cols-6">
        <select
          className="input"
          value={filters.branchId}
          onChange={(event) => setFilters({ ...filters, branchId: event.target.value })}
          aria-label="Filtrar por sucursal"
        >
          <option value="">Todas las sucursales</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
        <select
          className="input"
          value={filters.type}
          onChange={(event) => setFilters({ ...filters, type: event.target.value })}
          aria-label="Filtrar por tipo"
        >
          <option value="">Todos los tipos</option>
          {movementTypes.map((type) => (
            <option key={type} value={type}>
              {stockMovementTypeLabels[type]}
            </option>
          ))}
        </select>
        <select
          className="input"
          value={filters.productId}
          onChange={(event) => setFilters({ ...filters, productId: event.target.value })}
          aria-label="Filtrar por producto"
        >
          <option value="">Todos los productos</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>
        <input
          className="input"
          type="date"
          value={filters.from}
          onChange={(event) => setFilters({ ...filters, from: event.target.value })}
          aria-label="Desde"
        />
        <input
          className="input"
          type="date"
          value={filters.to}
          onChange={(event) => setFilters({ ...filters, to: event.target.value })}
          aria-label="Hasta"
        />
        <input
          className="input"
          value={filters.search}
          onChange={(event) => setFilters({ ...filters, search: event.target.value })}
          placeholder="Buscar motivo o referencia…"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn" onClick={() => void load()} disabled={busy}>
          {busy ? "Buscando…" : "Buscar movimientos"}
        </button>
        <span className="text-sm text-[var(--admin-muted)]">
          {total} movimiento{total === 1 ? "" : "s"}
        </span>
      </div>

      <div className="overflow-hidden rounded-[1.5rem] border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--admin-border)] text-xs uppercase tracking-wide text-[var(--admin-muted)]">
                <th className="px-4 py-3 font-semibold">Fecha</th>
                <th className="px-4 py-3 font-semibold">Tipo</th>
                <th className="px-4 py-3 font-semibold">Producto</th>
                <th className="px-4 py-3 font-semibold">Sucursal</th>
                <th className="px-4 py-3 font-semibold text-right">Cantidad</th>
                <th className="px-4 py-3 font-semibold text-right">Saldo</th>
                <th className="px-4 py-3 font-semibold">Usuario</th>
                <th className="px-4 py-3 font-semibold">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const movement = row as unknown as {
                  id: string;
                  type: string;
                  quantity: string;
                  balanceAfter: string;
                  reference?: string | null;
                  reason: string;
                  createdAt: string;
                  user: { name: string } | null;
                  stock: { product: { name: string }; branch: { name: string } };
                };
                return (
                  <tr key={movement.id} className="border-b border-[var(--admin-border)]/60 last:border-0">
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs tabular-nums text-[var(--admin-muted)]">
                      {new Date(movement.createdAt).toLocaleString("es-AR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={stockMovementTypeLabels[movement.type] ?? movement.type} />
                    </td>
                    <td className="px-4 py-2.5 font-semibold">{movement.stock.product.name}</td>
                    <td className="px-4 py-2.5 text-[var(--admin-muted)]">{movement.stock.branch.name}</td>
                    <td className={`px-4 py-2.5 text-right font-black tabular-nums ${Number(movement.quantity) > 0 ? "text-emerald-300" : "text-red-300"}`}>
                      {Number(movement.quantity) > 0 ? "+" : ""}
                      {Number(movement.quantity)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{Number(movement.balanceAfter)}</td>
                    <td className="px-4 py-2.5 text-[var(--admin-muted)]">{movement.user?.name ?? "—"}</td>
                    <td className="px-4 py-2.5 text-[var(--admin-muted)]">
                      {movement.reference ? `${movement.reference} · ` : ""}
                      {movement.reason}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-[var(--admin-muted)]">
                    Aplicá los filtros y buscá para ver el historial.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {rows.length < total && (
        <div className="flex justify-center">
          <button type="button" className="btn btn-secondary" onClick={() => void load(true)} disabled={busy}>
            Cargar más ({Math.min(50, total - rows.length)})
          </button>
        </div>
      )}
    </div>
  );
}

/** @summary Conteos físicos: apertura, carga de cantidades y cierre con ajustes. */
function CountSections({
  branches,
  initialCounts,
  initialBranchId,
}: {
  branches: Branch[];
  initialCounts: CountSession[];
  initialBranchId: number;
}) {
  const [counts, setCounts] = useState(initialCounts);
  const [open, setOpen] = useState<CountSessionDetail | null>(null);
  const [countBranch, setCountBranch] = useState(initialBranchId || branches[0]?.id || 0);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await scopedFetch(`/api/admin/inventory/counts?branchId=${countBranch}`);
      const body = (await response.json().catch(() => ({}))) as { sessions?: CountSession[]; error?: string };
      if (response.ok && body.sessions) setCounts(body.sessions);
    } catch (reason) {
      await showError("No se pudo actualizar el listado", reason);
    }
  }, [countBranch]);

  const startSession = async () => {
    setBusy(true);
    try {
      const response = await scopedFetch("/api/admin/inventory/counts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId: countBranch, note: note || undefined }),
      });
      const body = (await response.json().catch(() => ({}))) as { session?: CountSessionDetail; error?: string };
      if (!response.ok || !body.session) throw new Error(body.error ?? "No se pudo abrir el conteo");
      setOpen(body.session);
      setNote("");
      await refresh();
    } catch (reason) {
      await showError("No se pudo abrir el conteo", reason);
    } finally {
      setBusy(false);
    }
  };

  const saveCounted = async () => {
    if (!open) return;
    setBusy(true);
    try {
      const response = await scopedFetch(`/api/admin/inventory/counts/${open.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: open.items.map((item) => ({ id: item.id, countedQuantity: Number(item.countedQuantity) })),
        }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "No se pudieron guardar las cantidades");
      await Swal.fire({
        title: "Cantidades guardadas",
        icon: "success",
        timer: 1200,
        showConfirmButton: false,
        background: "#18181b",
        color: "#fafafa",
      });
    } catch (reason) {
      await showError("No se pudieron guardar las cantidades", reason);
    } finally {
      setBusy(false);
    }
  };

  const completeSession = async () => {
    if (!open) return;
    const confirm = await Swal.fire({
      title: "Completar conteo",
      text: "Se aplicarán los ajustes de diferencia como movimientos. Esta acción no se puede deshacer.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Completar y ajustar",
      cancelButtonText: "Cancelar",
      background: "#18181b",
      color: "#fafafa",
    });
    if (!confirm.isConfirmed) return;
    setBusy(true);
    try {
      const response = await scopedFetch(`/api/admin/inventory/counts/${open.id}/complete`, { method: "POST" });
      const body = (await response.json().catch(() => ({}))) as { result?: { adjustments: number }; error?: string };
      if (!response.ok || !body.result) throw new Error(body.error ?? "No se pudo completar el conteo");
      setOpen(null);
      await refresh();
      await Swal.fire({
        title: "Conteo completado",
        text: `${body.result.adjustments} ajuste${body.result.adjustments === 1 ? "" : "s"} aplicado${body.result.adjustments === 1 ? "" : "s"}.`,
        icon: "success",
        background: "#18181b",
        color: "#fafafa",
      });
    } catch (reason) {
      await showError("No se pudo completar el conteo", reason);
    } finally {
      setBusy(false);
    }
  };

  const cancelSession = async () => {
    if (!open) return;
    setBusy(true);
    try {
      const response = await scopedFetch(`/api/admin/inventory/counts/${open.id}/cancel`, { method: "POST" });
      if (!response.ok) throw new Error("No se pudo cancelar el conteo");
      setOpen(null);
      await refresh();
    } catch (reason) {
      await showError("No se pudo cancelar el conteo", reason);
    } finally {
      setBusy(false);
    }
  };

  const patchItem = (id: number, counted: string) => {
    setOpen((current) =>
      current
        ? {
            ...current,
            items: current.items.map((item) => {
              if (item.id !== id) return item;
              const countedQuantity = Number(counted) || 0;
              const difference = countedQuantity - Number(item.systemQuantity);
              return { ...item, countedQuantity: String(countedQuantity), difference: String(difference) };
            }),
          }
        : current,
    );
  };

  const pendingItems = open?.items.filter((item) => Number(item.difference) !== 0) ?? [];

  return (
    <div className="space-y-5">
      <div className="card flex flex-wrap items-end gap-3 p-5">
        <label className="block">
          <span className="block text-xs font-semibold text-[var(--admin-muted)]">Sucursal</span>
          <select className="input mt-1" value={countBranch} onChange={(event) => setCountBranch(Number(event.target.value))}>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-52 flex-1">
          <span className="block text-xs font-semibold text-[var(--admin-muted)]">Nota (opcional)</span>
          <input className="input mt-1" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ej. Cierre de mes" />
        </label>
        <button type="button" className="btn" onClick={() => void startSession()} disabled={busy}>
          {busy ? "Abriendo…" : "+ Nueva sesión de conteo"}
        </button>
      </div>

      {open && (
        <div className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black">
                Conteo {open.reference} · {open.branch?.name ?? ""}
              </h2>
              <p className="text-sm text-[var(--admin-muted)]">
                {open.items.length} ítems · {pendingItems.length} con diferencia
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => void saveCounted()} disabled={busy}>
                Guardar cantidades
              </button>
              <button type="button" className="btn" onClick={() => void completeSession()} disabled={busy}>
                Completar y ajustar
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => void cancelSession()} disabled={busy}>
                Cancelar
              </button>
            </div>
          </div>
          <div className="mt-4 max-h-[50vh] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--admin-border)] text-xs uppercase tracking-wide text-[var(--admin-muted)]">
                  <th className="px-3 py-2 font-semibold">Producto</th>
                  <th className="px-3 py-2 font-semibold text-right">Sistema</th>
                  <th className="px-3 py-2 font-semibold text-right">Contado</th>
                  <th className="px-3 py-2 font-semibold text-right">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {open.items.map((item) => (
                  <tr key={item.id} className="border-b border-[var(--admin-border)]/40 last:border-0">
                    <td className="px-3 py-2 font-semibold">{item.product.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{Number(item.systemQuantity)}</td>
                    <td className="px-3 py-2 text-right">
                      <input
                        className="input w-28 py-1.5"
                        type="number"
                        min={0}
                        step="0.001"
                        value={item.countedQuantity}
                        onChange={(event) => patchItem(item.id, event.target.value)}
                        aria-label={`Cantidad contada de ${item.product.name}`}
                      />
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-black tabular-nums ${
                        Number(item.difference) > 0 ? "text-emerald-300" : Number(item.difference) < 0 ? "text-red-300" : "text-[var(--admin-muted)]"
                      }`}
                    >
                      {Number(item.difference) > 0 ? "+" : ""}
                      {Number(item.difference)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-[1.5rem] border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--admin-border)] text-xs uppercase tracking-wide text-[var(--admin-muted)]">
                <th className="px-4 py-3 font-semibold">Referencia</th>
                <th className="px-4 py-3 font-semibold">Sucursal</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold">Ítems</th>
                <th className="px-4 py-3 font-semibold">Iniciado</th>
                <th className="px-4 py-3 font-semibold">Completado</th>
              </tr>
            </thead>
            <tbody>
              {counts.map((count) => (
                <tr key={count.id} className="border-b border-[var(--admin-border)]/60 last:border-0">
                  <td className="px-4 py-2.5 font-semibold">{count.reference}</td>
                  <td className="px-4 py-2.5">{count.branch?.name ?? "—"}</td>
                   <td className="px-4 py-2.5">
                     <StatusBadge status={count.status === "completed" ? "completed" : count.status === "cancelled" ? "cancelled" : "in_progress"} />
                   </td>
                  <td className="px-4 py-2.5 tabular-nums">{count._count.items}</td>
                  <td className="px-4 py-2.5 text-xs text-[var(--admin-muted)]">
                    {new Date(count.startedAt).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}
                    {count.startedBy ? ` · ${count.startedBy.name}` : ""}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[var(--admin-muted)]">
                    {count.completedAt
                      ? new Date(count.completedAt).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })
                      : "—"}
                  </td>
                </tr>
              ))}
               {counts.length === 0 && (
                 <tr>
                   <td colSpan={6} className="px-4 py-10 text-center">
                     <EmptyState title="No hay sesiones de conteo todavía" description="Abrí una nueva sesión desde la sección de conteos físicos." />
                   </td>
                 </tr>
               )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/** @summary Transferencias entre sucursales: creación y historial. */
function TransfersSection({
  branches,
  products,
  initialTransfers,
}: {
  branches: Branch[];
  products: Product[];
  initialTransfers: TransferRow[];
}) {
  const [transfers, setTransfers] = useState(initialTransfers);
  const [form, setForm] = useState({ fromBranchId: "", toBranchId: "", productId: "", quantity: "1", unit: "", note: "" });
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try {
      const response = await scopedFetch("/api/admin/inventory/transfers");
      const body = (await response.json().catch(() => ({}))) as { transfers?: TransferRow[]; error?: string };
      if (response.ok && body.transfers) setTransfers(body.transfers);
    } catch (reason) {
      await showError("No se pudo actualizar el listado", reason);
    }
  };

  const create = async () => {
    if (!form.fromBranchId || !form.toBranchId || !form.productId) {
      await showError("Faltan datos", new Error("Completá origen, destino y producto"));
      return;
    }
    setBusy(true);
    try {
      const response = await scopedFetch("/api/admin/inventory/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromBranchId: Number(form.fromBranchId),
          toBranchId: Number(form.toBranchId),
          productId: Number(form.productId),
          quantity: Number(form.quantity),
          unit: form.unit || undefined,
          note: form.note || undefined,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as { transfer?: TransferRow; error?: string };
      if (!response.ok || !body.transfer) throw new Error(body.error ?? "No se pudo crear la transferencia");
      setForm({ fromBranchId: "", toBranchId: "", productId: "", quantity: "1", unit: "", note: "" });
      await refresh();
      await Swal.fire({
        title: "Transferencia realizada",
        text: `${body.transfer.reference} · ${body.transfer.product.name} (${body.transfer.quantity} ${body.transfer.unit})`,
        icon: "success",
        background: "#18181b",
        color: "#fafafa",
      });
    } catch (reason) {
      await showError("No se pudo crear la transferencia", reason);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="card p-5">
        <h2 className="text-lg font-black">Nueva transferencia</h2>
        <p className="mt-1 text-sm text-[var(--admin-muted)]">
          La salida del origen y la entrada del destino se aplican en una sola operación atómica.
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-6">
          <label className="block">
            <span className="block text-xs font-semibold text-[var(--admin-muted)]">Origen</span>
            <select className="input mt-1" value={form.fromBranchId} onChange={(event) => setForm({ ...form, fromBranchId: event.target.value })}>
              <option value="">Elegí sucursal</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-[var(--admin-muted)]">Destino</span>
            <select className="input mt-1" value={form.toBranchId} onChange={(event) => setForm({ ...form, toBranchId: event.target.value })}>
              <option value="">Elegí sucursal</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-[var(--admin-muted)]">Producto</span>
            <select className="input mt-1" value={form.productId} onChange={(event) => setForm({ ...form, productId: event.target.value })}>
              <option value="">Elegí producto</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-[var(--admin-muted)]">Cantidad</span>
            <input className="input mt-1" type="number" min={0.001} step="0.001" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} />
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-[var(--admin-muted)]">Unidad (opcional)</span>
            <input className="input mt-1" value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} placeholder="unidad, kg, ml…" />
          </label>
          <div className="flex items-end">
            <button type="button" className="btn w-full" onClick={() => void create()} disabled={busy}>
              {busy ? "Transfiriendo…" : "Transferir"}
            </button>
          </div>
        </div>
        <label className="mt-3 block">
          <span className="block text-xs font-semibold text-[var(--admin-muted)]">Nota (opcional)</span>
          <input className="input mt-1" value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Ej. Reposición para fin de semana" />
        </label>
      </div>

      <div className="overflow-hidden rounded-[1.5rem] border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--admin-border)] text-xs uppercase tracking-wide text-[var(--admin-muted)]">
                <th className="px-4 py-3 font-semibold">Referencia</th>
                <th className="px-4 py-3 font-semibold">Producto</th>
                <th className="px-4 py-3 font-semibold">Origen → Destino</th>
                <th className="px-4 py-3 font-semibold text-right">Cantidad</th>
                <th className="px-4 py-3 font-semibold">Fecha</th>
                <th className="px-4 py-3 font-semibold">Usuario</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((transfer) => (
                <tr key={transfer.id} className="border-b border-[var(--admin-border)]/60 last:border-0">
                  <td className="px-4 py-2.5 font-semibold">{transfer.reference}</td>
                  <td className="px-4 py-2.5">{transfer.product.name}</td>
                  <td className="px-4 py-2.5">
                    {transfer.fromBranch.name} → {transfer.toBranch.name}
                  </td>
                  <td className="px-4 py-2.5 text-right font-black tabular-nums">
                    {Number(transfer.quantity)} {transfer.unit}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[var(--admin-muted)]">
                    {new Date(transfer.createdAt).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="px-4 py-2.5 text-[var(--admin-muted)]">{transfer.createdBy?.name ?? "—"}</td>
                </tr>
              ))}
               {transfers.length === 0 && (
                 <tr>
                   <td colSpan={6} className="px-4 py-10 text-center">
                     <EmptyState title="No hay transferencias todavía" description="Creá la primera para mover stock entre sucursales." />
                   </td>
                 </tr>
               )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
