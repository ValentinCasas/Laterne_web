"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useMemo, useCallback, useEffect } from "react";
import { Icon } from "@/components/admin/ui/icons";
import { dateLabel, money } from "@/lib/helpers";
import { adminHrefFromPathname } from "@/lib/routes";

/* ────────────────────────── Types ────────────────────────── */

type InvoiceRow = {
  id: number;
  number: string;
  status: string;
  documentDate: string;
  dueDate?: string | null;
  externalNumber?: string | null;
  supplier: { id: number; name: string };
  branch?: { id: number; name: string } | null;
  subtotal: string | number;
  taxAmount: string | number;
  total: string | number;
  paidAmount: string | number;
  receipts?: Array<{ receipt: { id: number; number: string } }>;
};

type SortKey = "number" | "supplier" | "documentDate" | "dueDate" | "total" | "paidAmount" | "status";
type SortDir = "asc" | "desc";
type ColumnDef = { key: string; label: string; visible: boolean };

const STATUS_STYLES: Record<string, { bg: string; label: string; color: string }> = {
  draft: { bg: "color-mix(in srgb, var(--admin-muted) 12%, transparent)", label: "Borrador", color: "var(--admin-muted)" },
  pending: { bg: "color-mix(in srgb, var(--admin-warning) 15%, transparent)", label: "Pendiente", color: "var(--admin-warning)" },
  partially_paid: { bg: "color-mix(in srgb, #60a5fa 15%, transparent)", label: "Parcial", color: "#60a5fa" },
  paid: { bg: "color-mix(in srgb, var(--admin-success) 15%, transparent)", label: "Pagado", color: "var(--admin-success)" },
  cancelled: { bg: "color-mix(in srgb, var(--admin-danger) 12%, transparent)", label: "Anulado", color: "var(--admin-danger)" },
};

const DEFAULT_COLUMNS: ColumnDef[] = [
  { key: "number", label: "Nº", visible: true },
  { key: "supplier", label: "Proveedor", visible: true },
  { key: "documentDate", label: "Fecha", visible: true },
  { key: "dueDate", label: "Vencimiento", visible: true },
  { key: "total", label: "Total", visible: true },
  { key: "paidAmount", label: "Pagado", visible: true },
  { key: "status", label: "Estado", visible: true },
];

const ROWS_PER_PAGE_OPTIONS = [15, 25, 50, 100];

/* ────────────────────────── Main Component ────────────────────────── */

export function ComprasFacturasClient({ initialInvoices, total }: { initialInvoices: InvoiceRow[]; total: number }) {
  const pathname = usePathname();
  const href = useCallback((path: string) => adminHrefFromPathname(pathname, path), [pathname]);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("documentDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [columns, setColumns] = useState<ColumnDef[]>(DEFAULT_COLUMNS);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);

  /* Counts for KPIs */
  const totalCount = initialInvoices.length;
  const draftCount = initialInvoices.filter((i) => i.status === "draft").length;
  const pendingCount = initialInvoices.filter((i) => i.status === "pending" || i.status === "partially_paid").length;
  const paidCount = initialInvoices.filter((i) => i.status === "paid").length;
  const cancelledCount = initialInvoices.filter((i) => i.status === "cancelled").length;

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("es");
    return initialInvoices.filter((inv) => {
      if (statusFilter && inv.status !== statusFilter) return false;
      if (q && !inv.number.toLocaleLowerCase("es").includes(q) && !inv.supplier.name.toLocaleLowerCase("es").includes(q) && !(inv.externalNumber ?? "").toLocaleLowerCase("es").includes(q)) return false;
      return true;
    });
  }, [initialInvoices, query, statusFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let av: string | number, bv: string | number;
      switch (sortKey) {
        case "number": av = a.number; bv = b.number; break;
        case "supplier": av = a.supplier.name; bv = b.supplier.name; break;
        case "documentDate": av = a.documentDate; bv = b.documentDate; break;
        case "dueDate": av = a.dueDate ?? "9999-12-31"; bv = b.dueDate ?? "9999-12-31"; break;
        case "total": av = Number(a.total) || 0; bv = Number(b.total) || 0; break;
        case "paidAmount": av = Number(a.paidAmount) || 0; bv = Number(b.paidAmount) || 0; break;
        case "status": av = a.status; bv = b.status; break;
        default: return 0;
      }
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv as string, "es") : (bv as string).localeCompare(av, "es");
      return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / rowsPerPage);
  const paged = sorted.slice(page * rowsPerPage, (page + 1) * rowsPerPage);
  const visibleCols = columns.filter((c) => c.visible);
  const activeFilters = (statusFilter ? 1 : 0) + (query ? 1 : 0);
  const hasManyRows = sorted.length > 10;

  function toggleSort(key: SortKey) {
    if (sortKey === key) { setSortDir((d) => d === "asc" ? "desc" : "asc"); } else { setSortKey(key); setSortDir(key === "total" || key === "paidAmount" ? "desc" : "asc"); }
    setPage(0);
  }

  function toggleColumn(key: string) {
    setColumns((prev) => prev.map((c) => c.key === key ? { ...c, visible: !c.visible } : c));
  }

  function resetFilters() { setQuery(""); setStatusFilter(""); setPage(0); }

  function filterByStatus(s: string) { setStatusFilter(statusFilter === s ? "" : s); setPage(0); }

  useEffect(() => {
    function handleClick() { if (showSortMenu) setShowSortMenu(false); if (showColumnPicker) setShowColumnPicker(false); }
    if (showSortMenu || showColumnPicker) document.addEventListener("click", handleClick, { once: true });
    return () => document.removeEventListener("click", handleClick);
  }, [showSortMenu, showColumnPicker]);

  return (
    <div className="min-h-screen" style={{ background: "var(--admin-background)" }}>
      {/* ── Header ── */}
      <div style={{ background: "var(--admin-surface)" }} className="relative">
        <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: "linear-gradient(90deg, var(--admin-primary-strong), var(--admin-primary), transparent)" }} />
        <div className="mx-auto max-w-[1600px] px-4 pt-5 pb-4 sm:px-8 sm:pt-7 sm:pb-6">
          <nav className="mb-4 flex items-center gap-2 text-xs sm:text-sm" style={{ color: "var(--admin-muted)" }}>
            <Link href={href("/admin/compras")} className="transition-colors hover:opacity-70">Compras</Link>
            <span className="opacity-40">/</span>
            <span className="font-medium" style={{ color: "var(--admin-text)" }}>Facturas de compra</span>
          </nav>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight leading-none sm:text-[28px]" style={{ color: "var(--admin-text)" }}>Facturas de compra</h1>
              <p className="mt-2 text-sm sm:text-base" style={{ color: "var(--admin-muted)" }}>Documentos de compra y pagos a proveedores</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="mx-auto max-w-[1600px] px-4 pt-6 pb-2 sm:px-8 sm:pt-6 sm:pb-2">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <KpiCard label="Total" value={totalCount} active={!statusFilter} onClick={() => { setStatusFilter(""); setPage(0); }} />
          <KpiCard label="Borradores" value={draftCount} color="var(--admin-muted)" active={statusFilter === "draft"} onClick={() => filterByStatus("draft")} />
          <KpiCard label="Pendientes" value={pendingCount} color="var(--admin-warning)" active={statusFilter === "pending"} onClick={() => filterByStatus("pending")} />
          <KpiCard label="Pagados" value={paidCount} color="var(--admin-success)" active={statusFilter === "paid"} onClick={() => filterByStatus("paid")} />
          <KpiCard label="Anulados" value={cancelledCount} active={statusFilter === "cancelled"} onClick={() => filterByStatus("cancelled")} />
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
              placeholder="Buscar por numero, proveedor o comprobante..." />
          </div>

          <select className="py-2.5 px-3 text-base rounded-lg outline-none sm:py-2 sm:text-sm"
            style={{ background: "var(--admin-surface)", border: "1px solid var(--admin-border)", color: "var(--admin-text)", minWidth: "130px" }}
            value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}>
            <option value="">Todos</option>
            {Object.entries(STATUS_STYLES).map(([v, cfg]) => <option key={v} value={v}>{cfg.label}</option>)}
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
              style={{ color: (sortKey !== "documentDate" || sortDir !== "desc") ? "var(--admin-primary)" : "var(--admin-muted)", background: (sortKey !== "documentDate" || sortDir !== "desc") ? "color-mix(in srgb, var(--admin-primary) 8%, transparent)" : "transparent" }}
              onClick={(e) => { e.stopPropagation(); setShowSortMenu(!showSortMenu); }}>
              <Icon name="sort" className="text-base sm:text-sm" /> Ordenar
            </button>
            {showSortMenu && (
              <div className="absolute right-0 top-full z-30 mt-1.5 rounded-xl p-2 shadow-2xl min-w-[180px] sm:min-w-[220px]"
                style={{ background: "var(--admin-surface)", border: "1px solid var(--admin-border)" }}
                onClick={(e) => e.stopPropagation()}>
                {([
                  { key: "documentDate" as SortKey, label: "Fecha — mas reciente", dir: "desc" as SortDir },
                  { key: "documentDate" as SortKey, label: "Fecha — mas antigua", dir: "asc" as SortDir },
                  { key: "total" as SortKey, label: "Total — mayor", dir: "desc" as SortDir },
                  { key: "total" as SortKey, label: "Total — menor", dir: "asc" as SortDir },
                  { key: "supplier" as SortKey, label: "Proveedor A-Z", dir: "asc" as SortDir },
                  { key: "number" as SortKey, label: "Numero", dir: "asc" as SortDir },
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

          <div className="relative">
            <button type="button"
              className="flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-base font-medium transition-all sm:px-3 sm:py-2 sm:text-sm"
              style={{ color: "var(--admin-muted)" }}
              onClick={(e) => { e.stopPropagation(); setShowColumnPicker(!showColumnPicker); setShowSortMenu(false); }}>
              <Icon name="grid" className="text-base sm:text-sm" /> Columnas
            </button>
            {showColumnPicker && (
              <div className="absolute right-0 top-full z-30 mt-1.5 rounded-xl p-3 shadow-2xl min-w-[180px] sm:min-w-[180px]"
                style={{ background: "var(--admin-surface)", border: "1px solid var(--admin-border)" }}
                onClick={(e) => e.stopPropagation()}>
                {columns.map((col) => (
                  <label key={col.key} className="flex items-center gap-2.5 py-2.5 px-2.5 rounded-lg cursor-pointer text-base font-medium transition-all sm:py-2 sm:text-sm"
                    style={{ color: "var(--admin-text)" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "color-mix(in srgb, var(--admin-primary) 6%, transparent)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                    <input type="checkbox" checked={col.visible} onChange={() => toggleColumn(col.key)} className="rounded" />
                    {col.label}
                  </label>
                ))}
              </div>
            )}
          </div>

          <span className="ml-auto text-sm font-medium sm:text-xs" style={{ color: "var(--admin-muted)" }}>
            {sorted.length} resultado{sorted.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-8 sm:py-5">
        {sorted.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/15 p-12 text-center">
            <Icon name="receipt" className="mx-auto text-4xl text-zinc-600" />
            <h3 className="mt-3 text-xl font-black sm:text-2xl" style={{ color: "var(--admin-text)" }}>No hay facturas</h3>
            <p className="mt-2 text-sm sm:text-base" style={{ color: "var(--admin-muted)" }}>
              {activeFilters > 0 ? "No hay comprobantes que coincidan con los filtros." : "Creá una factura y vinculala a las recepciones del proveedor."}
            </p>
            {activeFilters > 0 && (
              <button type="button" className="mt-4 btn btn-secondary" onClick={resetFilters}>Limpiar filtros</button>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl shadow-black/10">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-base sm:text-sm" style={{ minWidth: "700px" }}>
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-[var(--admin-border)] bg-white/[0.02] text-base uppercase tracking-wider text-[var(--admin-muted)] sm:text-xs sm:tracking-wider">
                    {visibleCols.map((col) => (
                      <th key={col.key}
                        className="px-3 py-3 select-none cursor-pointer transition-colors sm:px-4 sm:py-3"
                        style={{ color: sortKey === col.key ? "var(--admin-primary)" : undefined }}
                        onClick={() => toggleSort(col.key as SortKey)}>
                        <span className="flex items-center gap-1.5">
                          {col.label}
                          {sortKey === col.key && <Icon name="arrow-down" className="text-[10px] sm:text-[10px]" style={{ transform: sortDir === "asc" ? "rotate(180deg)" : undefined }} />}
                        </span>
                      </th>
                    ))}
                    <th className="px-3 py-3 w-20 sm:px-4 sm:py-3">&nbsp;</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--admin-border)]/70">
                  {paged.map((inv) => {
                    const balance = (Number(inv.total) || 0) - (Number(inv.paidAmount) || 0);
                    const cfg = STATUS_STYLES[inv.status] ?? STATUS_STYLES.draft;
                    return (
                      <tr key={inv.id} className="transition-colors hover:bg-white/[0.02] cursor-pointer"
                        onClick={() => { window.location.href = href(`/admin/compras/facturas/${inv.id}`); }}>
                        {visibleCols.map((col) => {
                          switch (col.key) {
                            case "number":
                              return <td key={col.key} className="px-3 py-3 sm:px-4 sm:py-3">
                                <div className="font-black text-pink-300 text-base sm:text-sm">{inv.number}</div>
                                {inv.externalNumber && <p className="text-xs mt-0.5 sm:text-xs" style={{ color: "var(--admin-muted)" }}>Comp. {inv.externalNumber}</p>}
                              </td>;
                            case "supplier":
                              return <td key={col.key} className="px-3 py-3 font-semibold text-base sm:text-sm sm:px-4 sm:py-3" style={{ color: "var(--admin-text)" }}>{inv.supplier.name}</td>;
                            case "documentDate":
                              return <td key={col.key} className="px-3 py-3 text-[var(--admin-muted)] text-base sm:text-sm sm:px-4 sm:py-3">{dateLabel(inv.documentDate)}</td>;
                            case "dueDate":
                              return <td key={col.key} className="px-3 py-3 text-[var(--admin-muted)] text-base sm:text-sm sm:px-4 sm:py-3">{dateLabel(inv.dueDate)}</td>;
                            case "total":
                              return <td key={col.key} className="px-3 py-3 text-right font-bold tabular-nums text-base sm:text-sm sm:px-4 sm:py-3">{money(inv.total, "ARS")}</td>;
                            case "paidAmount":
                              return <td key={col.key} className="px-3 py-3 text-right tabular-nums text-base sm:text-sm sm:px-4 sm:py-3" style={{ color: "var(--admin-success)" }}>{money(inv.paidAmount, "ARS")}</td>;
                            case "status":
                              return <td key={col.key} className="px-3 py-3 sm:px-4 sm:py-3">
                                <span className="rounded-full px-2.5 py-1 text-xs font-black sm:text-[10px]" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                              </td>;
                            default:
                              return <td key={col.key} className="px-3 py-3 sm:px-4 sm:py-3">&nbsp;</td>;
                          }
                        })}
                        <td className="px-3 py-3 text-right sm:px-4 sm:py-3">
                          <Link href={href(`/admin/compras/facturas/${inv.id}`) as never}
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

            {/* ── Footer / Pagination ── */}
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
                <span className="tabular-nums">{page * rowsPerPage + 1}–{Math.min((page + 1) * rowsPerPage, sorted.length)} de {sorted.length}</span>
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

/* ────────────────────────── KPI Card ────────────────────────── */

function KpiCard({ label, value, color, active, onClick }: { label: string; value: number; color?: string; active?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="text-left rounded-xl p-4 transition-all duration-150 sm:p-4"
      style={{
        background: active ? "color-mix(in srgb, var(--admin-primary) 8%, var(--admin-surface))" : "var(--admin-surface)",
        border: `1px solid ${active ? "color-mix(in srgb, var(--admin-primary) 25%, transparent)" : "var(--admin-border)"}`,
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.borderColor = "color-mix(in srgb, var(--admin-primary) 15%, transparent)"; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.borderColor = "var(--admin-border)"; }}>
      <p className="text-xs font-semibold uppercase tracking-wider sm:text-xs" style={{ color: "var(--admin-muted)" }}>{label}</p>
      <p className="text-2xl font-extrabold tabular-nums mt-1.5 leading-none sm:text-2xl" style={{ color: color || (active ? "var(--admin-primary)" : "var(--admin-text)") }}>{value}</p>
    </button>
  );
}
