import type { ReactNode } from "react";
import { DENSITY_CLASSES, DENSITY_CELL_CLASSES } from "./view-options";

/** @summary Tabla de datos consistente: header sticky, hover, acciones, empty state, responsive y densidad configurable. */
export function DataTable({
  columns,
  data,
  keyExtractor,
  emptyMessage = "No hay registros para mostrar.",
  rowActions,
  onRowClick,
  className,
  density = "normal",
}: {
  columns: Array<{ key: string; label: string; align?: "left" | "right"; width?: string; hideOnMobile?: boolean }>;
  data: readonly Record<string, unknown>[];
  keyExtractor: (row: Record<string, unknown>, index: number) => string | number;
  emptyMessage?: string;
  rowActions?: (row: Record<string, unknown>) => ReactNode;
  onRowClick?: (row: Record<string, unknown>) => void;
  className?: string;
  density?: "compact" | "normal" | "comfortable";
}) {
  const cellClass = DENSITY_CELL_CLASSES[density];
  return (
    <div className={`overflow-x-auto rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] ${className ?? ""}`}>
      <table className={`w-full text-left ${DENSITY_CLASSES[density]}`}>
        <thead>
          <tr className={`border-b border-[var(--admin-border)] bg-white/[0.02] text-xs uppercase tracking-wider text-[var(--admin-muted)] ${cellClass}`}>
            {columns.map((column) => (
              <th
                key={column.key}
                style={{ width: column.width, textAlign: column.align ?? "left" }}
                className={`font-bold ${column.hideOnMobile ? "hidden md:table-cell" : ""}`}
              >
                {column.label}
              </th>
            ))}
            {rowActions && <th className={`text-right ${cellClass}`} aria-label="Acciones" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--admin-border)]">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (rowActions ? 1 : 0)} className={`px-5 py-16 text-center text-[var(--admin-muted)]`}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, rowIndex) => (
              <tr
                key={keyExtractor(row, rowIndex)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`transition-colors duration-150 hover:bg-white/[0.02] ${onRowClick ? "cursor-pointer" : ""}`}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    style={{ textAlign: column.align ?? "left" }}
                    className={cellClass}
                  >
                    {row[column.key] as ReactNode}
                  </td>
                ))}
                {rowActions && (
                  <td className={`text-right ${cellClass}`}>{rowActions(row)}</td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
