"use client";

import type { ReactNode } from "react";

/** @summary Tablero Kanban con columnas arrastrables y tarjetas apilables. */
export function KanbanBoard({ columns, children }: { columns: Array<{ id: string; title: string; count?: number }>; children: (columnId: string) => ReactNode }) {
  return (
    <div className="flex snap-x gap-4 overflow-x-auto pb-4 [scrollbar-color:var(--admin-primary)_transparent]">
      {columns.map((column) => (
        <section key={column.id} className="w-[min(86vw,320px)] shrink-0 snap-start space-y-3">
          <header className="flex items-center justify-between rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3">
            <h3 className="text-sm font-black uppercase tracking-wider text-zinc-300">{column.title}</h3>
            {column.count !== undefined && <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-zinc-500">{column.count}</span>}
          </header>
          <div className="space-y-3">{children(column.id)}</div>
        </section>
      ))}
    </div>
  );
}
