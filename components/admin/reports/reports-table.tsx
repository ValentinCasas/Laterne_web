"use client";

import type { ReactNode } from "react";
import { DataTable } from "@/components/admin/ui";

/** @summary Tabla reutilizable con paginación, estado vacío y botón de exportación CSV. */
export function ReportsTable<T>({
  headers,
  rows,
  emptyMessage,
  page,
  pageSize,
  total,
  onPageChange,
  csvData,
  csvFilename,
  renderRow,
  density = "normal",
}: {
  headers: string[];
  rows: T[];
  emptyMessage: string;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  csvData?: string;
  csvFilename?: string;
  renderRow?: (row: T, index: number) => ReactNode;
  density?: "compact" | "normal" | "comfortable";
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasMore = page < totalPages;

  function downloadCsv() {
    if (!csvData) return;
    const blob = new Blob([`\uFEFF${csvData}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = csvFilename || "reporte.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!renderRow) {
    const columns = headers.map((header, index) => ({
      key: `col-${index}`,
      label: header,
    }));
    const data = rows.map((row, index) => {
      const record: Record<string, ReactNode> = { id: index };
      columns.forEach((col, idx) => {
        const lower = headers[idx].toLowerCase();
        record[col.key] = String((row as Record<string, unknown>)[lower] ?? (row as Record<string, unknown>)[headers[idx]] ?? "");
      });
      return record;
    });
    return (
      <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl shadow-black/10">
        <div className="flex items-center justify-between border-b border-[var(--admin-border)] px-5 py-3">
          <p className="text-xs font-semibold text-zinc-400">
            Página {page} de {totalPages} · {total} registros
          </p>
          {csvData && (
            <button
              type="button"
              onClick={downloadCsv}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-zinc-300 transition-colors hover:bg-white/10"
            >
              Exportar CSV
            </button>
          )}
        </div>
        <DataTable
          columns={columns}
          data={data}
          keyExtractor={(row) => row.id as number}
          emptyMessage={emptyMessage}
          density={density}
        />
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[var(--admin-border)] px-5 py-3">
            <p className="text-xs text-zinc-500">
              {page > 1 && `Página ${page} de ${totalPages}`}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
                className="btn btn-secondary"
              >
                ← Anterior
              </button>
              <button
                type="button"
                disabled={!hasMore}
                onClick={() => onPageChange(page + 1)}
                className="btn btn-secondary"
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl shadow-black/10">
      <div className="flex items-center justify-between border-b border-[var(--admin-border)] px-5 py-3">
        <p className="text-xs font-semibold text-zinc-400">
          Página {page} de {totalPages} · {total} registros
        </p>
        {csvData && (
          <button
            type="button"
            onClick={downloadCsv}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-zinc-300 transition-colors hover:bg-white/10"
          >
            Exportar CSV
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className={`w-full text-left ${density === "compact" ? "text-xs" : density === "comfortable" ? "text-base" : "text-sm"}`}>
          <thead>
            <tr className="border-b border-[var(--admin-border)] bg-white/[0.02] text-xs uppercase tracking-wider text-[var(--admin-muted)]">
              {headers.map((header, index) => (
                <th key={index} className="px-5 py-3 font-bold">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--admin-border)]">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={headers.length} className="px-5 py-16 text-center text-[var(--admin-muted)]">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => renderRow(row, index))
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-[var(--admin-border)] px-5 py-3">
          <p className="text-xs text-zinc-500">
            {page > 1 && `Página ${page} de ${totalPages}`}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="btn btn-secondary"
            >
              ← Anterior
            </button>
            <button
              type="button"
              disabled={!hasMore}
              onClick={() => onPageChange(page + 1)}
              className="btn btn-secondary"
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
