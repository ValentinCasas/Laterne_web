"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Icon } from "@/components/admin/ui/icons";
import { dateLabel } from "@/lib/helpers";
import { adminHrefFromPathname } from "@/lib/routes";
import { scopedFetch } from "@/lib/client-routing";

type OrderRow = {
  id: number;
  number: string;
  status: string;
  orderDate: string;
  expectedDate?: string | null;
  externalReference?: string | null;
  supplier: { id: number; name: string };
  branch: { id: number; name: string };
  items: Array<{ quantity: string | number; receivedQuantity: string | number }>;
  createdBy?: { id: number; name: string } | null;
};

type SortKey = "number" | "supplier" | "branch" | "orderDate" | "status";
type SortDir = "asc" | "desc";

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: "Borrador", color: "var(--admin-muted)", bg: "color-mix(in srgb, var(--admin-muted) 12%, transparent)" },
  sent: { label: "Enviado", color: "#60a5fa", bg: "color-mix(in srgb, #60a5fa 14%, transparent)" },
  partially_received: { label: "Parcial", color: "var(--admin-warning)", bg: "color-mix(in srgb, var(--admin-warning) 14%, transparent)" },
  received: { label: "Recibido", color: "var(--admin-success)", bg: "color-mix(in srgb, var(--admin-success) 14%, transparent)" },
  closed: { label: "Cerrado", color: "var(--admin-muted)", bg: "color-mix(in srgb, var(--admin-muted) 8%, transparent)" },
  cancelled: { label: "Cancelado", color: "var(--admin-danger)", bg: "color-mix(in srgb, var(--admin-danger) 12%, transparent)" },
};

const ROWS_PER_PAGE_OPTIONS = [25, 50, 100];

export function ComprasPedidosClient({ initialOrders, total, suppliers }: { initialOrders: OrderRow[]; total: number; suppliers: Array<{ id: number; name: string }> }) {
  const pathname = usePathname();
  const href = useCallback((path: string) => adminHrefFromPathname(pathname, path), [pathname]);
  const tableRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("orderDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [orders, setOrders] = useState(initialOrders);
  const [resultTotal, setResultTotal] = useState(total);
  const [loading, setLoading] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("es");
    return orders.filter((order) => {
      if (statusFilter && order.status !== statusFilter) return false;
      if (supplierFilter && String(order.supplier.id) !== supplierFilter) return false;
      if (q && !order.number.toLocaleLowerCase("es").includes(q) && !order.supplier.name.toLocaleLowerCase("es").includes(q)) return false;
      return true;
    });
  }, [orders, query, statusFilter, supplierFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let av: string, bv: string;
      switch (sortKey) {
        case "number": av = a.number; bv = b.number; break;
        case "supplier": av = a.supplier.name; bv = b.supplier.name; break;
        case "branch": av = a.branch.name; bv = b.branch.name; break;
        case "orderDate": av = a.orderDate; bv = b.orderDate; break;
        case "status": av = a.status; bv = b.status; break;
        default: return 0;
      }
      return sortDir === "asc" ? av.localeCompare(bv, "es") : bv.localeCompare(av, "es");
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(resultTotal / rowsPerPage));
  const paged = sorted;
  const activeFilters = (statusFilter ? 1 : 0) + (supplierFilter ? 1 : 0) + (query ? 1 : 0);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
    setPage(0);
  }

  function resetFilters() { setQuery(""); setStatusFilter(""); setSupplierFilter(""); setPage(0); }

  useEffect(() => {
    function handleClick() {
      if (showSortMenu) setShowSortMenu(false);
    }
    if (showSortMenu) document.addEventListener("click", handleClick, { once: true });
    return () => document.removeEventListener("click", handleClick);
  }, [showSortMenu]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        const params = new URLSearchParams({
          limit: String(rowsPerPage),
          offset: String(page * rowsPerPage),
          sortBy: sortKey,
          sortDir,
        });
        if (query.trim()) params.set("q", query.trim());
        if (statusFilter) params.set("status", statusFilter);
        if (supplierFilter) params.set("supplierId", supplierFilter);
        try {
          const response = await scopedFetch(`/api/admin/compras?${params.toString()}`, {
            signal: controller.signal,
          });
          if (!response.ok) return;
          const body = (await response.json()) as { items: OrderRow[]; total: number };
          setOrders(body.items);
          setResultTotal(body.total);
        } catch {
          if (!controller.signal.aborted) setLoading(false);
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      })();
    }, 220);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [page, query, rowsPerPage, sortDir, sortKey, statusFilter, supplierFilter]);

  return (
    <div className="min-h-screen" style={{ background: "var(--admin-background)" }}>
      {/* ── Header ── */}
      <div style={{ background: "var(--admin-surface)" }} className="relative">
        <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: "linear-gradient(90deg, var(--admin-primary-strong), var(--admin-primary), transparent)" }} />
        <div className="mx-auto max-w-[1600px] px-4 pt-5 pb-4 sm:px-8 sm:pt-7 sm:pb-6">
          <nav className="mb-4 flex items-center gap-2 text-xs sm:text-sm" style={{ color: "var(--admin-muted)" }}>
            <Link href={href("/admin/compras")} className="transition-colors hover:opacity-70">Compras</Link>
            <span className="opacity-40">/</span>
            <span className="font-medium" style={{ color: "var(--admin-text)" }}>Pedidos</span>
          </nav>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight leading-none sm:text-[28px]" style={{ color: "var(--admin-text)" }}>Pedidos de compra</h1>
              <p className="mt-2 text-sm sm:text-base" style={{ color: "var(--admin-muted)" }}>Gestiona los pedidos a proveedores</p>
            </div>
            <Link href={href("/admin/compras/pedidos/nuevo") as never}
              className="rounded-lg px-5 py-3 text-base font-bold text-white transition-all hover:opacity-90 flex items-center gap-2 sm:py-2.5 sm:text-sm"
              style={{ background: "var(--admin-primary-strong)" }}>
              <Icon name="plus" className="text-base sm:text-sm" /> Nuevo pedido
            </Link>
          </div>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="sticky top-0 z-20 border-b" style={{ borderColor: "var(--admin-border)", background: "color-mix(in srgb, var(--admin-background) 85%, var(--admin-surface))", backdropFilter: "blur(12px)" }}>
        <div className="mx-auto max-w-[1600px] flex flex-wrap items-center gap-3 px-4 py-3 sm:px-8 sm:py-3">
          <div className="relative min-w-[200px] flex-1 max-w-md sm:min-w-[260px] sm:max-w-md">
            <Icon name="search" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm pointer-events-none" style={{ color: "var(--admin-muted)" }} />
            <input className="w-full py-2.5 pl-10 pr-4 text-base rounded-lg outline-none transition-all focus:ring-2 sm:py-2 sm:text-sm"
              style={{ background: "var(--admin-surface)", border: "1px solid var(--admin-border)", color: "var(--admin-text)", "--tw-ring-color": "color-mix(in srgb, var(--admin-primary) 40%, transparent)" } as React.CSSProperties}
              value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }}
              placeholder="Buscar por numero o proveedor..." />
          </div>

          <select className="py-2.5 px-3 text-base rounded-lg outline-none sm:py-2 sm:text-sm"
            style={{ background: "var(--admin-surface)", border: "1px solid var(--admin-border)", color: "var(--admin-text)", minWidth: "130px" }}
            value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}>
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_CFG).map(([v, cfg]) => <option key={v} value={v}>{cfg.label}</option>)}
          </select>
          <select className="py-2.5 px-3 text-base rounded-lg outline-none sm:py-2 sm:text-sm"
            style={{ background: "var(--admin-surface)", border: "1px solid var(--admin-border)", color: "var(--admin-text)", minWidth: "140px" }}
            value={supplierFilter} onChange={(e) => { setSupplierFilter(e.target.value); setPage(0); }}>
            <option value="">Todos los proveedores</option>
            {suppliers.map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
          </select>

          {activeFilters > 0 && (
            <button type="button" className="flex items-center gap-1 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all sm:px-2.5 sm:py-2 sm:text-xs"
              style={{ color: "var(--admin-danger)" }} onClick={resetFilters}>
              <Icon name="x" className="text-sm sm:text-xs" /> Limpiar
            </button>
          )}

          <div className="w-px h-6" style={{ background: "var(--admin-border)" }} />

          <div className="relative">
            <button type="button"
              className="flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-base font-medium transition-all sm:px-3 sm:py-2 sm:text-sm"
              style={{ color: (sortKey !== "orderDate" || sortDir !== "desc") ? "var(--admin-primary)" : "var(--admin-muted)", background: (sortKey !== "orderDate" || sortDir !== "desc") ? "color-mix(in srgb, var(--admin-primary) 8%, transparent)" : "transparent" }}
              onClick={(e) => { e.stopPropagation(); setShowSortMenu(!showSortMenu); }}>
              <Icon name="sort" className="text-base sm:text-sm" /> Ordenar
            </button>
            {showSortMenu && (
              <div className="absolute right-0 top-full z-30 mt-1.5 rounded-xl p-2 shadow-2xl min-w-[180px] sm:min-w-[200px]"
                style={{ background: "var(--admin-surface)", border: "1px solid var(--admin-border)" }}
                onClick={(e) => e.stopPropagation()}>
                {([
                  { key: "orderDate" as SortKey, label: "Fecha — mas reciente", dir: "desc" as SortDir },
                  { key: "orderDate" as SortKey, label: "Fecha — mas antigua", dir: "asc" as SortDir },
                  { key: "number" as SortKey, label: "Numero", dir: "asc" as SortDir },
                  { key: "supplier" as SortKey, label: "Proveedor A-Z", dir: "asc" as SortDir },
                  { key: "supplier" as SortKey, label: "Proveedor Z-A", dir: "desc" as SortDir },
                ]).map((opt, i) => {
                  const active = sortKey === opt.key && sortDir === opt.dir;
                  return (
                    <button key={i} type="button"
                      className="w-full text-left rounded-lg px-3 py-2.5 text-base font-medium transition-all flex items-center justify-between gap-2 sm:px-3 sm:py-2 sm:text-sm"
                      style={{ color: active ? "var(--admin-primary)" : "var(--admin-text)", background: active ? "color-mix(in srgb, var(--admin-primary) 8%, transparent)" : "transparent" }}
                      onClick={() => { setSortKey(opt.key); setSortDir(opt.dir); setPage(0); setShowSortMenu(false); }}>
                      {opt.label}
                      {active && <Icon name="check" className="text-sm sm:text-xs" style={{ color: "var(--admin-primary)" }} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <span className="ml-auto text-sm font-medium sm:text-xs" style={{ color: "var(--admin-muted)" }} aria-live="polite">
            {loading ? "Actualizando…" : `${resultTotal} resultado${resultTotal !== 1 ? "s" : ""}`}
          </span>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-8 sm:py-5">
        {sorted.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/15 p-12 text-center">
            <Icon name="package" className="mx-auto text-4xl text-zinc-600" />
            <h3 className="mt-3 text-xl font-black sm:text-2xl" style={{ color: "var(--admin-text)" }}>No hay pedidos</h3>
            <p className="mt-2 text-sm sm:text-base" style={{ color: "var(--admin-muted)" }}>
              {activeFilters > 0 ? "No hay pedidos que coincidan con los filtros." : "Creá el primero para pedir mercadería a un proveedor."}
            </p>
            {activeFilters > 0 && (
              <button type="button" className="mt-4 btn btn-secondary" onClick={resetFilters}>Limpiar filtros</button>
            )}
          </div>
        ) : (
          <div className={`overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl shadow-black/10 transition-opacity ${loading ? "opacity-65" : "opacity-100"}`} aria-busy={loading}>
            <div ref={tableRef} className="overflow-x-auto">
              <table className="w-full text-left text-base sm:text-sm" style={{ minWidth: "700px" }}>
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-[var(--admin-border)] bg-white/[0.02] text-sm uppercase tracking-wider text-[var(--admin-muted)] sm:text-xs sm:tracking-wider">
                    {([
                      { key: "number" as SortKey, label: "Pedido", w: "w-[140px] sm:w-[180px]" },
                      { key: "supplier" as SortKey, label: "Proveedor", w: "" },
                      { key: "branch" as SortKey, label: "Sucursal", w: "" },
                      { key: "orderDate" as SortKey, label: "Fecha", w: "w-[100px] sm:w-[120px]" },
                      { key: "status" as SortKey, label: "Estado", w: "w-[110px] sm:w-[130px]" },
                    ]).map(({ key, label, w }) => (
                      <th key={key}
                        className={`px-3 py-3 select-none cursor-pointer transition-colors sm:px-4 sm:py-3 ${w}`}
                        style={{ color: sortKey === key ? "var(--admin-primary)" : undefined }}
                        onClick={() => toggleSort(key)}>
                        <span className="flex items-center gap-1.5">
                          {label}
                          {sortKey === key && <Icon name="arrow-down" className="text-[10px] sm:text-[10px]" style={{ transform: sortDir === "asc" ? "rotate(180deg)" : undefined }} />}
                        </span>
                      </th>
                    ))}
                    <th className="px-3 py-3 sm:px-4 sm:py-3">Recepción</th>
                    <th className="px-3 py-3 w-16 sm:px-4 sm:py-3">&nbsp;</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--admin-border)]/70">
                  {paged.map((order) => {
                    const totalItems = order.items.length;
                    const pendingReceipt = order.items.filter((item) => (Number(item.quantity) || 0) - (Number(item.receivedQuantity) || 0) > 0).length;
                    const receiptPct = totalItems > 0 ? Math.round(((totalItems - pendingReceipt) / totalItems) * 100) : 0;
                    const st = STATUS_CFG[order.status] ?? STATUS_CFG.draft;
                    return (
                      <tr key={order.id}
                        className="transition-colors hover:bg-white/[0.02] cursor-pointer"
                        onClick={() => { window.location.href = href(`/admin/compras/pedidos/${order.id}`); }}>
                        <td className="px-3 py-3 sm:px-4 sm:py-3">
                          <div className="font-black text-pink-300 text-base sm:text-sm">{order.number}</div>
                          {order.externalReference && <p className="text-xs mt-0.5 text-[var(--admin-muted)]">{order.externalReference}</p>}
                        </td>
                        <td className="px-3 py-3 font-semibold text-base sm:text-sm sm:px-4 sm:py-3">{order.supplier.name}</td>
                        <td className="px-3 py-3 text-[var(--admin-muted)] text-base sm:text-sm sm:px-4 sm:py-3">{order.branch.name}</td>
                        <td className="px-3 py-3 text-[var(--admin-muted)] text-base sm:text-sm sm:px-4 sm:py-3">{dateLabel(order.orderDate)}</td>
                        <td className="px-3 py-3 sm:px-4 sm:py-3">
                          <span className="rounded-full px-2.5 py-1 text-xs font-black sm:text-[10px]"
                            style={{ background: st.bg, color: st.color }}>{st.label}</span>
                        </td>
                        <td className="px-3 py-3 sm:px-4 sm:py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="h-2 w-16 rounded-full overflow-hidden" style={{ background: "color-mix(in srgb, var(--admin-muted) 12%, transparent)" }}>
                              <div className="h-full rounded-full transition-all duration-300" style={{ width: `${receiptPct}%`, background: receiptPct === 100 ? "var(--admin-success)" : receiptPct > 0 ? "var(--admin-warning)" : "var(--admin-muted)" }} />
                            </div>
                            <span className="text-xs tabular-nums font-medium text-[var(--admin-muted)]">{receiptPct}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 sm:px-4 sm:py-3">
                          <Link href={href(`/admin/compras/pedidos/${order.id}`) as never}
                            className="rounded-lg px-2.5 py-1.5 text-sm font-semibold transition-all opacity-0 group-hover:opacity-100"
                            style={{ color: "var(--admin-primary)", background: "color-mix(in srgb, var(--admin-primary) 8%, transparent)" }}
                            onClick={(e) => e.stopPropagation()}>Abrir</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer / Pagination */}
            <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-3"
              style={{ borderTop: "1px solid var(--admin-border)", background: "color-mix(in srgb, var(--admin-surface-elevated) 40%, var(--admin-surface))" }}>
              <div className="flex items-center gap-2.5 text-sm sm:text-xs" style={{ color: "var(--admin-muted)" }}>
                <span>Filas por pagina:</span>
                <select className="py-1.5 px-2.5 text-sm rounded-lg sm:py-1 sm:px-2 sm:text-xs" style={{ background: "var(--admin-surface)", border: "1px solid var(--admin-border)", color: "var(--admin-text)" }}
                  value={rowsPerPage} onChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(0); }}>
                  {ROWS_PER_PAGE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-3 text-sm sm:text-xs" style={{ color: "var(--admin-muted)" }}>
                <span className="tabular-nums">{page * rowsPerPage + 1}–{Math.min((page + 1) * rowsPerPage, resultTotal)} de {resultTotal}</span>
                <div className="flex items-center gap-1">
                  <button type="button" className="rounded-lg p-2 transition-all hover:bg-white/5 disabled:opacity-30 sm:p-1.5"
                    disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                    <Icon name="arrow-down" className="text-base sm:text-sm" style={{ transform: "rotate(90deg)" }} />
                  </button>
                  <button type="button" className="rounded-lg p-2 transition-all hover:bg-white/5 disabled:opacity-30 sm:p-1.5"
                    disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                    <Icon name="arrow-down" className="text-base sm:text-sm" style={{ transform: "rotate(-90deg)" }} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
