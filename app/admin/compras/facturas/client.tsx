"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useMemo, useCallback } from "react";
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

type Density = "compact" | "normal" | "comfortable";

type ColumnDef = { key: string; label: string; visible: boolean };

const STATUS_STYLES: Record<string, { bg: string; label: string; color: string }> = {
  draft: { bg: "color-mix(in srgb, var(--admin-muted) 12%, transparent)", label: "Borrador", color: "var(--admin-muted)" },
  pending: { bg: "color-mix(in srgb, var(--admin-warning) 15%, transparent)", label: "Pendiente", color: "var(--admin-warning)" },
  partially_paid: { bg: "color-mix(in srgb, #60a5fa 15%, transparent)", label: "Parcial", color: "#60a5fa" },
  paid: { bg: "color-mix(in srgb, var(--admin-success) 15%, transparent)", label: "Pagado", color: "var(--admin-success)" },
  cancelled: { bg: "color-mix(in srgb, var(--admin-danger) 12%, transparent)", label: "Anulado", color: "var(--admin-danger)" },
};

const DENSITY_CFG: Record<Density, { row: string; cell: string; font: string; headerCell: string }> = {
  compact: { row: "py-1.5", cell: "px-3 py-1.5", font: "text-[10px]", headerCell: "px-3 py-2" },
  normal: { row: "py-2.5", cell: "px-4 py-2.5", font: "text-[11px]", headerCell: "px-4 py-3" },
  comfortable: { row: "py-3.5", cell: "px-5 py-3.5", font: "text-xs", headerCell: "px-5 py-3.5" },
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
  const [density, setDensity] = useState<Density>("compact");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [showDensityMenu, setShowDensityMenu] = useState(false);

  /* Filtering */
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("es");
    return initialInvoices.filter((inv) => {
      if (statusFilter && inv.status !== statusFilter) return false;
      if (q && !inv.number.toLocaleLowerCase("es").includes(q) && !inv.supplier.name.toLocaleLowerCase("es").includes(q) && !(inv.externalNumber ?? "").toLocaleLowerCase("es").includes(q)) return false;
      return true;
    });
  }, [initialInvoices, query, statusFilter]);

  /* Sorting */
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

  /* Pagination */
  const totalPages = Math.ceil(sorted.length / rowsPerPage);
  const paged = sorted.slice(page * rowsPerPage, (page + 1) * rowsPerPage);
  const visibleCols = columns.filter((c) => c.visible);

  function toggleSort(key: SortKey) {
    if (sortKey === key) { setSortDir((d) => d === "asc" ? "desc" : "asc"); } else { setSortKey(key); setSortDir(key === "total" || key === "paidAmount" ? "desc" : "asc"); }
    setPage(0);
  }

  function toggleColumn(key: string) {
    setColumns((prev) => prev.map((c) => c.key === key ? { ...c, visible: !c.visible } : c));
  }

  function resetFilters() { setQuery(""); setStatusFilter(""); setPage(0); }

  const dCfg = DENSITY_CFG[density];
  const activeFilters = (statusFilter ? 1 : 0) + (query ? 1 : 0);

  return (
    <div className="min-h-screen" style={{ background: "var(--admin-background)" }}>
      {/* ── Header ── */}
      <div style={{ background: "var(--admin-surface)" }} className="relative">
        <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: "linear-gradient(90deg, var(--admin-primary-strong), var(--admin-primary), transparent)" }} />
        <div className="mx-auto max-w-[1600px] px-8 pt-6 pb-5">
          <nav className="mb-5 flex items-center gap-2 text-xs" style={{ color: "var(--admin-muted)" }}>
            <Link href={href("/admin/compras")} className="transition-colors hover:opacity-70">Compras</Link>
            <span className="opacity-40">/</span>
            <span className="font-medium" style={{ color: "var(--admin-text)" }}>Facturas de compra</span>
          </nav>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight leading-none" style={{ color: "var(--admin-text)" }}>Facturas de compra</h1>
              <p className="mt-2 text-sm" style={{ color: "var(--admin-muted)" }}>Documentos de compra y pagos a proveedores</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="border-b" style={{ borderColor: "var(--admin-border)", background: "color-mix(in srgb, var(--admin-surface) 60%, var(--admin-background))" }}>
        <div className="mx-auto max-w-[1600px] flex flex-wrap items-center gap-2 px-8 py-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: "var(--admin-muted)" }} />
            <input className="input w-full py-1.5 pl-9 pr-3 text-xs rounded-lg" value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} placeholder="Buscar por numero, proveedor o comprobante..." />
          </div>

          {/* Status filter */}
          <select className="input py-1.5 px-3 text-[10px] rounded-lg" style={{ minWidth: "120px" }} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}>
            <option value="">Todos</option>
            {Object.entries(STATUS_STYLES).map(([v, cfg]) => <option key={v} value={v}>{cfg.label}</option>)}
          </select>

          {activeFilters > 0 && (
            <button type="button" className="rounded-lg px-2 py-1.5 text-[10px] font-semibold transition-all" style={{ color: "var(--admin-danger)" }} onClick={resetFilters}>
              Limpiar ({activeFilters})
            </button>
          )}

          {/* Divider */}
          <div className="w-px h-5" style={{ background: "var(--admin-border)" }} />

          {/* Sort button */}
          <div className="relative">
            <button type="button" className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold transition-all" style={{ color: sortKey !== "documentDate" || sortDir !== "desc" ? "var(--admin-primary)" : "var(--admin-muted)" }}
              onClick={() => toggleSort(sortKey)}>
              <Icon name="arrow-down" className="text-[10px]" style={{ transform: sortDir === "asc" ? "rotate(180deg)" : undefined }} />
              Ordenar
            </button>
          </div>

          {/* Column visibility */}
          <div className="relative">
            <button type="button" className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold transition-all" style={{ color: "var(--admin-muted)" }} onClick={() => { setShowColumnPicker(!showColumnPicker); setShowDensityMenu(false); }}>
              <Icon name="grid" className="text-[10px]" /> Columnas
            </button>
            {showColumnPicker && (
              <div className="absolute right-0 top-full z-30 mt-1 rounded-xl p-3 shadow-2xl min-w-[180px]" style={{ background: "var(--admin-surface)", border: "1px solid var(--admin-border)" }}>
                {columns.map((col) => (
                  <label key={col.key} className="flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer text-[11px] font-medium" style={{ color: "var(--admin-text)" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "color-mix(in srgb, var(--admin-primary) 6%, transparent)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                    <input type="checkbox" checked={col.visible} onChange={() => toggleColumn(col.key)} className="rounded" />
                    {col.label}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Density */}
          <div className="relative">
            <button type="button" className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold transition-all" style={{ color: "var(--admin-muted)" }} onClick={() => { setShowDensityMenu(!showDensityMenu); setShowColumnPicker(false); }}>
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

          <span className="ml-auto text-[10px] font-semibold" style={{ color: "var(--admin-muted)" }}>
            {sorted.length} resultado{sorted.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* ── Sort popover (when clicking Ordenar) ── */}
      {false && (
        <div className="absolute z-40 right-0 mt-1 rounded-xl p-3 shadow-2xl" style={{ background: "var(--admin-surface)", border: "1px solid var(--admin-border)" }}>
          {/* reserved for future sort menu */}
        </div>
      )}

      {/* ── Table ── */}
      <div className="mx-auto max-w-[1600px] px-8 py-4">
        {sorted.length === 0 ? (
          <div className="rounded-xl p-12 text-center" style={{ border: "1px dashed var(--admin-border)" }}>
            <Icon name="receipt" className="mx-auto text-3xl mb-3" style={{ color: "var(--admin-muted)", opacity: 0.4 }} />
            <h3 className="text-lg font-bold" style={{ color: "var(--admin-text)" }}>No hay facturas</h3>
            <p className="mt-1 text-sm" style={{ color: "var(--admin-muted)" }}>
              {activeFilters > 0 ? "No hay comprobantes que coincidan con los filtros." : "Crea una factura y vinculala a las recepciones del proveedor."}
            </p>
            {activeFilters > 0 && (
              <button type="button" className="mt-3 rounded-lg px-3 py-1.5 text-xs font-semibold" style={{ color: "var(--admin-primary)" }} onClick={resetFilters}>Limpiar filtros</button>
            )}
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ background: "var(--admin-surface)", border: "1px solid var(--admin-border)" }}>
            <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 340px)", minHeight: "320px", scrollbarColor: "var(--admin-border) transparent" }}>
              <table className="w-full text-left" style={{ minWidth: "800px" }}>
                <thead className="sticky top-0 z-10">
                  <tr style={{ borderBottom: "1px solid var(--admin-border)", background: "color-mix(in srgb, var(--admin-surface-elevated) 60%, var(--admin-surface))" }}>
                    {visibleCols.map((col) => (
                      <th key={col.key}
                        className={`${dCfg.headerCell} text-[10px] font-semibold uppercase tracking-wider select-none cursor-pointer transition-colors`}
                        style={{ color: sortKey === col.key ? "var(--admin-primary)" : "var(--admin-muted)" }}
                        onClick={() => col.key === "total" || col.key === "paidAmount" || col.key === "documentDate" || col.key === "dueDate" || col.key === "number" || col.key === "supplier" || col.key === "status" ? toggleSort(col.key as SortKey) : undefined}>
                        <span className="flex items-center gap-1">
                          {col.label}
                          {sortKey === col.key && <Icon name="arrow-down" className="text-[8px]" style={{ transform: sortDir === "asc" ? "rotate(180deg)" : undefined }} />}
                        </span>
                      </th>
                    ))}
                    <th className={`${dCfg.headerCell} text-[10px] font-semibold uppercase tracking-wider w-16`} style={{ color: "var(--admin-muted)" }}>&nbsp;</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((inv, idx) => {
                    const balance = (Number(inv.total) || 0) - (Number(inv.paidAmount) || 0);
                    const cfg = STATUS_STYLES[inv.status] ?? STATUS_STYLES.draft;
                    return (
                      <tr key={inv.id} className="transition-colors"
                        style={{ borderBottom: "1px solid var(--admin-border)", background: idx % 2 === 1 ? "color-mix(in srgb, var(--admin-surface-elevated) 12%, var(--admin-surface))" : undefined }}>
                        {visibleCols.map((col) => {
                          const c = `${dCfg.cell} ${dCfg.font}`;
                          switch (col.key) {
                            case "number":
                              return <td key={col.key} className={c}>
                                <Link href={href(`/admin/compras/facturas/${inv.id}`) as never} className="font-bold transition-opacity hover:opacity-80" style={{ color: "var(--admin-primary)" }}>{inv.number}</Link>
                                {inv.externalNumber && <p className="text-[9px] mt-0.5" style={{ color: "var(--admin-muted)" }}>Comp. {inv.externalNumber}</p>}
                              </td>;
                            case "supplier":
                              return <td key={col.key} className={`${c} font-semibold`} style={{ color: "var(--admin-text)" }}>{inv.supplier.name}</td>;
                            case "documentDate":
                              return <td key={col.key} className={c} style={{ color: "var(--admin-muted)" }}>{dateLabel(inv.documentDate)}</td>;
                            case "dueDate":
                              return <td key={col.key} className={c} style={{ color: "var(--admin-muted)" }}>{dateLabel(inv.dueDate)}</td>;
                            case "total":
                              return <td key={col.key} className={`${c} text-right font-bold tabular-nums`} style={{ color: "var(--admin-text)" }}>{money(inv.total, "ARS")}</td>;
                            case "paidAmount":
                              return <td key={col.key} className={`${c} text-right tabular-nums`} style={{ color: "var(--admin-success)" }}>{money(inv.paidAmount, "ARS")}</td>;
                            case "status":
                              return <td key={col.key} className={c}>
                                <span className="rounded-full px-2 py-0.5 text-[9px] font-bold" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                              </td>;
                            default:
                              return <td key={col.key} className={c}>&nbsp;</td>;
                          }
                        })}
                        <td className={`${dCfg.cell} ${dCfg.font}`}>
                          <Link href={href(`/admin/compras/facturas/${inv.id}`) as never} className="rounded px-1.5 py-1 text-[9px] font-semibold transition-all hover:opacity-80" style={{ color: "var(--admin-muted)" }}>Abrir</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Footer / Pagination ── */}
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
