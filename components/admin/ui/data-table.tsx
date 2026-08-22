"use client";

import type { ReactNode } from "react";
import { useViewMode, ViewModeToggle, type ViewMode } from "@/components/admin/view-mode-toggle";
import { DENSITY_CELL_CLASSES } from "./view-options";

type Column = {
  key: string;
  label: string;
  align?: "left" | "right";
  width?: string;
  hideOnMobile?: boolean;
};

/**
 * @summary Tabla de datos consistente con header sticky, hover, acciones, estado vacío,
 *          densidad configurable, vista responsive (cards apiladas en celular) y
 *          las cuatro vistas (tarjeta / tarjeta compacta / lista / lista compacta).
 */
export function DataTable({
  columns,
  data,
  keyExtractor,
  emptyMessage = "No hay registros para mostrar.",
  rowActions,
  onRowClick,
  className,
  density = "normal",
  view,
  onViewChange,
  viewStorageKey,
}: {
  columns: Column[];
  data: readonly Record<string, unknown>[];
  keyExtractor: (row: Record<string, unknown>, index: number) => string | number;
  emptyMessage?: string;
  rowActions?: (row: Record<string, unknown>) => ReactNode;
  onRowClick?: (row: Record<string, unknown>) => void;
  className?: string;
  density?: "compact" | "normal" | "comfortable";
  view?: ViewMode;
  onViewChange?: (view: ViewMode) => void;
  viewStorageKey?: string;
}) {
  const [persistedView, setPersistedView] = useViewMode(viewStorageKey ?? "data-table");
  const effectiveView: ViewMode = view ?? (viewStorageKey || onViewChange ? persistedView : "list");
  const applyView = onViewChange ?? setPersistedView;

  const isCards = effectiveView === "cards" || effectiveView === "cards-compact";
  const compact = effectiveView === "list-compact" || effectiveView === "cards-compact";
  const cellClass = DENSITY_CELL_CLASSES[density];

  const mobileColumns = columns.filter((column) => !column.hideOnMobile);
  const titleColumn = mobileColumns[0];
  const bodyColumns = mobileColumns.slice(1);

  if (data.length === 0) {
    return (
      <div>
        {(viewStorageKey || onViewChange) && (
          <div className="mb-3 flex justify-end">
            <ViewModeToggle value={effectiveView} onChange={applyView} />
          </div>
        )}
        <div className="rounded-3xl border border-dashed border-white/15 p-12 text-center">
          <p className="text-sm text-[var(--admin-muted)]">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  const renderLabelValue = (row: Record<string, unknown>) =>
    bodyColumns.map((column) => (
      <div key={column.key} className="flex items-center justify-between gap-3">
        <dt className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-[var(--admin-muted)]">
          {column.label}
        </dt>
        <dd className={`min-w-0 text-right font-semibold ${compact ? "text-xs" : "text-sm"}`}>
          {row[column.key] as ReactNode}
        </dd>
      </div>
    ));

  const renderRowActions = (row: Record<string, unknown>) =>
    rowActions && <div onClick={(event) => event.stopPropagation()}>{rowActions(row)}</div>;

  function handleRowPointer(event: React.MouseEvent, row: Record<string, unknown>) {
    if (!onRowClick) return;
    const target = event.target as HTMLElement;
    if (target.closest("a, button, input, select, textarea, [role='menuitem']")) return;
    onRowClick(row);
  }

  if (isCards) {
    return (
      <div className={className}>
        {(viewStorageKey || onViewChange) && (
          <div className="mb-3 flex justify-end">
            <ViewModeToggle value={effectiveView} onChange={applyView} />
          </div>
        )}
        <div className={`grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 ${compact ? "gap-2.5" : "gap-4"}`}>
          {data.map((row, rowIndex) => (
            <div
              key={keyExtractor(row, rowIndex)}
              onClick={(event) => handleRowPointer(event, row)}
              onKeyDown={
                onRowClick
                  ? (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onRowClick(row);
                      }
                    }
                  : undefined
              }
              tabIndex={onRowClick ? 0 : undefined}
              className={`admin-row-enter rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[var(--admin-shadow-sm)] ${
                compact ? "p-3" : "p-4"
              } transition-[transform,border-color,background-color,box-shadow] duration-150 hover:-translate-y-0.5 hover:border-[var(--admin-border-strong)] hover:bg-[var(--admin-row-hover)] hover:shadow-[var(--admin-shadow-md)] ${onRowClick ? "cursor-pointer" : ""}`}
            >
              <div className={`flex items-start justify-between gap-3 ${compact ? "text-sm" : "text-base"}`}>
                <div className="font-bold">{row[titleColumn.key] as ReactNode}</div>
                {renderRowActions(row)}
              </div>
              <dl className={`space-y-1 ${compact ? "mt-1.5" : "mt-2"}`}>{renderLabelValue(row)}</dl>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {(viewStorageKey || onViewChange) && (
        <div className="mb-3 flex justify-end">
          <ViewModeToggle value={effectiveView} onChange={applyView} />
        </div>
      )}
      <div className="sm:hidden">
        <div className="space-y-2">
          {data.map((row, rowIndex) => (
            <div
              key={`mobile-${keyExtractor(row, rowIndex)}`}
              onClick={(event) => handleRowPointer(event, row)}
              onKeyDown={
                onRowClick
                  ? (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onRowClick(row);
                      }
                    }
                  : undefined
              }
              tabIndex={onRowClick ? 0 : undefined}
              className={`admin-row-enter rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3 shadow-[var(--admin-shadow-sm)] transition-colors duration-150 hover:bg-[var(--admin-row-hover)] ${onRowClick ? "cursor-pointer" : ""}`}
            >
              <div className="flex items-start justify-between gap-3 text-sm">
                <div className="font-bold">{row[titleColumn.key] as ReactNode}</div>
                {renderRowActions(row)}
              </div>
              <dl className="mt-1.5 space-y-1">{renderLabelValue(row)}</dl>
            </div>
          ))}
        </div>
      </div>
      <div className="hidden max-h-[calc(100dvh-19rem)] overflow-auto rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[var(--admin-shadow-sm)] sm:block">
        <table className={`w-full text-left text-sm`}>
          <thead className="sticky top-0 z-10">
            <tr
              className={`border-b border-[var(--admin-border)] bg-[var(--admin-surface-elevated)] text-[10px] uppercase tracking-[.12em] text-[var(--admin-muted)] ${cellClass}`}
            >
              {columns.map((column) => (
                <th
                  key={column.key}
                  style={{ width: column.width, textAlign: column.align ?? "left" }}
                  className={`font-semibold ${column.hideOnMobile ? "hidden md:table-cell" : ""}`}
                >
                  {column.label}
                </th>
              ))}
              {rowActions && <th className={`text-right font-semibold ${cellClass}`} aria-label="Acciones" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--admin-border)]/70">
            {data.map((row, rowIndex) => (
              <tr
                key={keyExtractor(row, rowIndex)}
                onClick={(event) => handleRowPointer(event, row)}
                onKeyDown={
                  onRowClick
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
                tabIndex={onRowClick ? 0 : undefined}
                className={`admin-row-enter transition-colors duration-150 hover:bg-[var(--admin-row-hover)] focus-visible:bg-[var(--admin-row-hover)] ${onRowClick ? "cursor-pointer" : ""}`}
              >
                {columns.map((column) => (
                  <td key={column.key} style={{ textAlign: column.align ?? "left" }} className={cellClass}>
                    {row[column.key] as ReactNode}
                  </td>
                ))}
                {rowActions && <td className={`text-right ${cellClass}`}>{rowActions(row)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
