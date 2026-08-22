"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { ViewModeToggle, type ViewMode } from "@/components/admin/view-mode-toggle";

/**
 * @summary Grid de cards con las cuatro vistas (tarjeta, tarjeta compacta, lista, lista compacta)
 *          y estado vacío.
 */
export function CardGrid<T>({
  items,
  renderCard,
  renderListRow,
  keyExtractor,
  emptyMessage = "No hay elementos para mostrar.",
  viewMode: controlledViewMode,
  onViewModeChange,
  defaultViewMode = "list",
  listHeader,
  className,
}: {
  items: T[];
  renderCard: (item: T) => ReactNode;
  renderListRow?: (item: T) => ReactNode;
  keyExtractor: (item: T, index: number) => string | number;
  emptyMessage?: string;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  defaultViewMode?: ViewMode;
  listHeader?: ReactNode;
  className?: string;
}) {
  const [internalMode, setInternalMode] = useState<ViewMode>(defaultViewMode);
  const viewMode = controlledViewMode ?? internalMode;
  const applyMode = onViewModeChange ?? setInternalMode;
  const isCards = viewMode === "cards" || viewMode === "cards-compact";
  const compact = viewMode === "cards-compact" || viewMode === "list-compact";

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--admin-border-strong)] bg-[var(--admin-surface)] p-8 text-center text-sm text-[var(--admin-muted)]">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="mb-4 flex items-center justify-between gap-3">
        {listHeader}
        <ViewModeToggle value={viewMode} onChange={applyMode} />
      </div>
      {isCards ? (
        <div
          className={`grid ${compact ? "grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4" : "grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"}`}
        >
          {items.map((item, index) => (
            <div key={keyExtractor(item, index)}>{renderCard(item)}</div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[var(--admin-shadow-sm)]">
          <table className={`w-full text-left ${compact ? "text-xs" : "text-sm"}`}>
            <tbody className="divide-y divide-[var(--admin-border)]">
              {items.map((item, index) => (
                <tr
                  className="admin-row-enter transition-colors hover:bg-[var(--admin-row-hover)]"
                  key={keyExtractor(item, index)}
                >
                  {renderListRow?.(item)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
