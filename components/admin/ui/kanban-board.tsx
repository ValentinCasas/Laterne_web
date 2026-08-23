"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { NumberFlow } from "./number-flow";

/**
 * @summary Tablero Kanban con columnas, header sticky, scroll interno y columnas vacías colapsables.
 *
 * Cada columna tiene su propio scroll, header fijo y contador.
 * Las columnas vacías se muestran colapsadas para no desperdiciar espacio.
 */
export function KanbanBoard({
  columns,
  children,
}: {
  columns: Array<{ id: string; title: string; count?: number }>;
  children: (columnId: string) => ReactNode;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function toggleCollapse(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="admin-kanban flex min-h-[28rem] gap-3 overflow-x-auto pb-3 [scrollbar-color:var(--admin-primary)_transparent]">
      {columns.map((column) => {
        const isEmpty = column.count !== undefined && column.count === 0;
        const isCollapsed = collapsed.has(column.id);

        return (
          <section
            key={column.id}
            className={`flex max-h-[calc(100dvh-17rem)] shrink-0 flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] shadow-[var(--admin-shadow-sm)] transition-[width,border-color,background-color] duration-200 ${
              isCollapsed ? "w-12" : "w-[min(86vw,320px)]"
            }`}
          >
            {/* Header sticky */}
            <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2.5">
              {isCollapsed ? (
                <button
                  type="button"
                  onClick={() => toggleCollapse(column.id)}
                  className="flex h-11 w-11 items-center justify-center rounded-lg text-xs font-black text-zinc-400 transition-colors hover:bg-white/[.05] hover:text-white sm:h-8 sm:w-8"
                  title={`Expandir ${column.title}`}
                  aria-label={`Expandir ${column.title}`}
                >
                  <NumberFlow value={column.count ?? 0} />
                </button>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                      {column.title}
                    </h3>
                    {column.count !== undefined && (
                      <span className="rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-elevated)] px-1.5 py-0.5 text-[10px] font-bold text-zinc-400">
                        <NumberFlow value={column.count} />
                      </span>
                    )}
                  </div>
                  {isEmpty && (
                    <button
                      type="button"
                      onClick={() => toggleCollapse(column.id)}
                      className="grid h-11 w-11 place-items-center rounded text-zinc-600 transition-colors hover:bg-white/[.05] hover:text-zinc-400 sm:h-8 sm:w-8"
                      title="Colapsar columna vacía"
                      aria-label="Colapsar columna vacía"
                    >
                      <svg
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="h-3.5 w-3.5"
                      >
                        <path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  )}
                </>
              )}
            </header>

            {/* Content con scroll propio */}
            {!isCollapsed && (
              <div className="admin-custom-scroll flex-1 overflow-y-auto overscroll-contain p-2.5">
                {isEmpty ? (
                  <div className="rounded-lg border border-dashed border-[var(--admin-border)] p-6 text-center text-[11px] text-zinc-500">
                    Sin pedidos
                  </div>
                ) : (
                  <div className="space-y-2">{children(column.id)}</div>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
