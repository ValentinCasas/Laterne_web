"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useMemo, useCallback } from "react";
import { Icon } from "@/components/admin/ui/icons";
import { dateLabel } from "@/lib/helpers";
import { adminHrefFromPathname } from "@/lib/routes";

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
type Density = "compact" | "normal" | "comfortable";

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: "Borrador", color: "var(--admin-muted)", bg: "color-mix(in srgb, var(--admin-muted) 12%, transparent)" },
  sent: { label: "Enviado", color: "#60a5fa", bg: "color-mix(in srgb, #60a5fa 12%, transparent)" },
  partially_received: { label: "Parcial", color: "var(--admin-warning)", bg: "color-mix(in srgb, var(--admin-warning) 12%, transparent)" },
  received: { label: "Recibido", color: "var(--admin-success)", bg: "color-mix(in srgb, var(--admin-success) 12%, transparent)" },
  closed: { label: "Cerrado", color: "var(--admin-muted)", bg: "color-mix(in srgb, var(--admin-muted) 8%, transparent)" },
  cancelled: { label: "Cancelado", color: "var(--admin-danger)", bg: "color-mix(in srgb, var(--admin-danger) 12%, transparent)" },
};

const DENSITY_CFG: Record<Density, { cell: string; font: string; headerCell: string }> = {
  compact: { cell: "px-3 py-1.5", font: "text-[10px]", headerCell: "px-3 py-2" },
  normal: { cell: "px-4 py-2.5", font: "text-[11px]", headerCell: "px-4 py-3" },
  comfortable: { cell: "px-5 py-3.5", font: "text-xs", headerCell: "px-5 py-3.5" },
};

const ROWS_PER_PAGE_OPTIONS = [15, 25, 50, 100];

export function ComprasPedidosClient({ initialOrders, total, suppliers }: { initialOrders: OrderRow[]; total: number; suppliers: Array<{ id: number; name: string }> }) {
  const pathname = usePathname();
  const href = useCallback((path: string) => adminHrefFromPathname(pathname, path), [pathname]);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("orderDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [density, setDensity] = useState<Density>("compact");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [showDensityMenu, setShowDensityMenu] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("es");
    return initialOrders.filter((order) => {
      if (statusFilter && order.status !== statusFilter) return false;
      if (supplierFilter && String(order.supplier.id) !== supplierFilter) return false;
      if (q && !order.number.toLocaleLowerCase("es").includes(q) && !order.supplier.name.toLocaleLowerCase("es").includes(q)) return false;
      return true;
    });
  }, [initialOrders, query, statusFilter, supplierFilter]);

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

  const totalPages = Math.ceil(sorted.length / rowsPerPage);
  const paged = sorted.slice(page * rowsPerPage, (page + 1) * rowsPerPage);
  const dCfg = DENSITY_CFG[density];
  const activeFilters = (statusFilter ? 1 : 0) + (supplierFilter ? 1 : 0) + (query ? 1 : 0);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
    setPage(0);
  }

  function resetFilters() { setQuery(""); setStatusFilter(""); setSupplierFilter(""); setPage(0); }

  return (
    <div className="min-h-screen" style={{ background: "var(--admin-background)" }}>
      {/* Header */}
      <div style={{ background: "var(--admin-surface)" }} className="relative">
        <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: "linear-gradient(90deg, var(--admin-primary-strong), var(--admin-primary), transparent)" }} />
        <div className="mx-auto max-w-[1600px] px-8 pt-6 pb-5">
          <nav className="mb-5 flex items-center gap-2 text-xs" style={{ color: "var(--admin-muted)" }}>
            <Link href={href("/admin/compras")} className="transition-colors hover:opacity-70">Compras</Link>
            <span className="opacity-40">/</span>
            <span className="font-medium" style={{ color: "var(--admin-text)" }}>Pedidos de compra</span>
          </nav>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight leading-none" style={{ color: "var(--admin-text)" }}>Pedidos de compra</h1>
              <p className="mt-2 text-sm" style={{ color: "var(--admin-muted)" }}>Gestiona los pedidos a proveedores</p>
            </div>
            <Link href={href("/admin/compras/pedidos/nuevo") as never} className="rounded-lg px-4 py-2 text-xs font-bold text-white transition-all hover:opacity-90" style={{ background: "var(--admin-primary-strong)" }}>
              + Nuevo pedido
            </Link>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="border-b" style={{ borderColor: "var(--admin-border)", background: "color-mix(in srgb, var(--admin-surface) 60%, var(--admin-background))" }}>
        <div className="mx-auto max-w-[1600px] flex flex-wrap items-center gap-2 px-8 py-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: "var(--admin-muted)" }} />
            <input className="input w-full py-1.5 pl-9 pr-3 text-xs rounded-lg" value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} placeholder="Buscar por numero o proveedor..." />
          </div>
          <select className="input py-1.5 px-3 text-[10px] rounded-lg" style={{ minWidth: "120px" }} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}>
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_CFG).map(([v, cfg]) => <option key={v} value={v}>{cfg.label}</option>)}
          </select>
          <select className="input py-1.5 px-3 text-[10px] rounded-lg" style={{ minWidth: "140px" }} value={supplierFilter} onChange={(e) => { setSupplierFilter(e.target.value); setPage(0); }}>
            <option value="">Todos los proveedores</option>
            {suppliers.map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
          </select>
          {activeFilters > 0 && (
            <button type="button" className="rounded-lg px-2 py-1.5 text-[10px] font-semibold transition-all" style={{ color: "var(--admin-danger)" }} onClick={resetFilters}>Limpiar ({activeFilters})</button>
          )}
          <div className="w-px h-5" style={{ background: "var(--admin-border)" }} />
          {/* Density */}
          <div className="relative">
            <button type="button" className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold transition-all" style={{ color: "var(--admin-muted)" }} onClick={() => setShowDensityMenu(!showDensityMenu)}>
              <Icon name="menu" className="text-[10px]" /> Densidad
            </button>
            {showDensityMenu && (
              <div className="absolute right-0 top-full z-30 mt-1 rounded-xl p-2 shadow-2xl min-w-[140px]" style={{ background: "var(--admin-surface)", border: "1px solid var(--admin-border)" }}>
                {(["compact", "normal", "comfortable"] as Density[]).map((d) => (
                  <button key={d} type="button" className="w-full text-left rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all"
                    style={{ color: density === d ? "var(--admin-primary)" : "var(--admin-text)", background: density === d ? "color-mix(in srgb, var(--admin-primary) 8%, transparent)" : "transparent" }}
                    onClick={() => { setDensity(d); setShowDensityMenu(false); }}>
                    {d === "compact" ? "Compacta" : d === "normal" ? "Normal" : "Comoda"}
                  </button>
                ))}
              </div>
            )}
          </div>
          <span className="ml-auto text-[10px] font-semibold" style={{ color: "var(--admin-muted)" }}>{sorted.length} resultado{sorted.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Table */}
      <div className="mx-auto max-w-[1600px] px-8 py-4">
        {sorted.length === 0 ? (
          <div className="rounded-xl p-12 text-center" style={{ border: "1px dashed var(--admin-border)" }}>
            <Icon name="package" className="mx-auto text-3xl mb-3" style={{ color: "var(--admin-muted)", opacity: 0.4 }} />
            <h3 className="text-lg font-bold" style={{ color: "var(--admin-text)" }}>No hay pedidos</h3>
            <p className="mt-1 text-sm" style={{ color: "var(--admin-muted)" }}>
              {activeFilters > 0 ? "No hay pedidos que coincidan con los filtros." : "Crea el primero para pedir mercaderia a un proveedor."}
            </p>
            {activeFilters > 0 && <button type="button" className="mt-3 rounded-lg px-3 py-1.5 text-xs font-semibold" style={{ color: "var(--admin-primary)" }} onClick={resetFilters}>Limpiar filtros</button>}
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ background: "var(--admin-surface)", border: "1px solid var(--admin-border)" }}>
            <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 340px)", minHeight: "320px", scrollbarColor: "var(--admin-border) transparent" }}>
              <table className="w-full text-left" style={{ minWidth: "750px" }}>
                <thead className="sticky top-0 z-10">
                  <tr style={{ borderBottom: "1px solid var(--admin-border)", background: "color-mix(in srgb, var(--admin-surface-elevated) 60%, var(--admin-surface))" }}>
                    {(["number", "supplier", "branch", "orderDate", "status"] as SortKey[]).map((key) => {
                      const labels: Record<string, string> = { number: "Pedido", supplier: "Proveedor", branch: "Sucursal", orderDate: "Fecha", status: "Estado" };
                      return (
                        <th key={key} className={`${dCfg.headerCell} text-[10px] font-semibold uppercase tracking-wider select-none cursor-pointer transition-colors`}
                          style={{ color: sortKey === key ? "var(--admin-primary)" : "var(--admin-muted)" }}
                          onClick={() => toggleSort(key)}>
                          <span className="flex items-center gap-1">
                            {labels[key]}
                            {sortKey === key && <Icon name="arrow-down" className="text-[8px]" style={{ transform: sortDir === "asc" ? "rotate(180deg)" : undefined }} />}
                          </span>
                        </th>
                      );
                    })}
                    <th className={`${dCfg.headerCell} text-[10px] font-semibold uppercase tracking-wider text-right`} style={{ color: "var(--admin-muted)" }}>Recepcion</th>
                    <th className={`${dCfg.headerCell} w-20`}>&nbsp;</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((order, idx) => {
                    const totalItems = order.items.length;
                    const pendingReceipt = order.items.filter((item) => (Number(item.quantity) || 0) - (Number(item.receivedQuantity) || 0) > 0).length;
                    const receiptPct = totalItems > 0 ? Math.round(((totalItems - pendingReceipt) / totalItems) * 100) : 0;
                    const st = STATUS_CFG[order.status] ?? STATUS_CFG.draft;
                    return (
                      <tr key={order.id} className="transition-colors"
                        style={{ borderBottom: "1px solid var(--admin-border)", background: idx % 2 === 1 ? "color-mix(in srgb, var(--admin-surface-elevated) 12%, var(--admin-surface))" : undefined }}>
                        <td className={`${dCfg.cell} ${dCfg.font}`}>
                          <Link href={href(`/admin/compras/pedidos/${order.id}`) as never} className="font-bold transition-opacity hover:opacity-80" style={{ color: "var(--admin-primary)" }}>{order.number}</Link>
                          {order.externalReference && <p className="text-[9px] mt-0.5" style={{ color: "var(--admin-muted)" }}>{order.externalReference}</p>}
                        </td>
                        <td className={`${dCfg.cell} ${dCfg.font} font-semibold`} style={{ color: "var(--admin-text)" }}>{order.supplier.name}</td>
                        <td className={`${dCfg.cell} ${dCfg.font}`} style={{ color: "var(--admin-muted)" }}>{order.branch.name}</td>
                        <td className={`${dCfg.cell} ${dCfg.font}`} style={{ color: "var(--admin-muted)" }}>{dateLabel(order.orderDate)}</td>
                        <td className={`${dCfg.cell} ${dCfg.font}`}>
                          <span className="rounded-full px-2 py-0.5 text-[9px] font-bold" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                        </td>
                        <td className={`${dCfg.cell} ${dCfg.font}`}>
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-14 rounded-full" style={{ background: "color-mix(in srgb, var(--admin-muted) 15%, transparent)" }}>
                              <div className="h-1.5 rounded-full transition-all" style={{ width: `${receiptPct}%`, background: receiptPct === 100 ? "var(--admin-success)" : receiptPct > 0 ? "var(--admin-warning)" : "var(--admin-muted)" }} />
                            </div>
                            <span className="text-[9px] tabular-nums" style={{ color: "var(--admin-muted)" }}>{receiptPct}%</span>
                          </div>
                        </td>
                        <td className={`${dCfg.cell} ${dCfg.font}`}>
                          <Link href={href(`/admin/compras/pedidos/${order.id}`) as never} className="rounded px-1.5 py-1 text-[9px] font-semibold transition-all hover:opacity-80" style={{ color: "var(--admin-muted)" }}>Abrir</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Footer / Pagination */}
            <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 px-4 py-2.5" style={{ borderTop: "1px solid var(--admin-border)", background: "color-mix(in srgb, var(--admin-surface-elevated) 40%, var(--admin-surface))" }}>
              <div className="flex items-center gap-2 text-[10px]" style={{ color: "var(--admin-muted)" }}>
                <span>Filas:</span>
                <select className="input py-0.5 px-1.5 text-[10px] rounded" style={{ minWidth: "50px" }} value={rowsPerPage} onChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(0); }}>
                  {ROWS_PER_PAGE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2 text-[10px]" style={{ color: "var(--admin-muted)" }}>
                <span>{page * rowsPerPage + 1}–{Math.min((page + 1) * rowsPerPage, sorted.length)} de {sorted.length}</span>
                <button type="button" className="rounded px-2 py-1 transition-colors disabled:opacity-30" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  <Icon name="arrow-down" className="text-[10px]" style={{ transform: "rotate(90deg)" }} />
                </button>
                <button type="button" className="rounded px-2 py-1 transition-colors disabled:opacity-30" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                  <Icon name="arrow-down" className="text-[10px]" style={{ transform: "rotate(-90deg)" }} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
