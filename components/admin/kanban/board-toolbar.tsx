"use client";

import { type ReactNode } from "react";
import { Icon } from "@/components/admin/ui/icons";
import { ActiveFilterChip } from "@/components/admin/ui/active-filter-chip";
import type { Density, BoardView } from "./types";

/** @summary Toolbar de tablero con búsqueda, filtros, toggle de densidad y selector de vista. */
export function BoardToolbar({
  title,
  subtitle,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  density,
  onDensityChange,
  view,
  onViewChange,
  filters,
  onClearFilters,
  className,
  actions,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  density: Density;
  onDensityChange: (density: Density) => void;
  view: BoardView;
  onViewChange: (view: BoardView) => void;
  filters?: Array<{ key: string; label: string; onRemove: () => void }>;
  onClearFilters?: () => void;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className ?? ""}`}>
      <div className="flex flex-1 items-center gap-3">
        {title && (
          <div className="min-w-0">
            <h2 className="truncate text-lg font-black text-white">{title}</h2>
            {subtitle && <p className="text-xs text-[var(--admin-muted)]">{subtitle}</p>}
          </div>
        )}

        {onSearchChange && (
          <div className="relative ml-auto">
            <input
              type="search"
              value={searchValue ?? ""}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder ?? "Buscar…"}
              className="h-9 w-48 rounded-lg border border-white/10 bg-white/5 pl-8 pr-3 text-xs text-zinc-300 outline-none transition-colors placeholder:text-zinc-500 focus:border-white/20 focus:bg-white/[.07]"
            />
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-zinc-500">
              <Icon name="search" className="h-3.5 w-3.5" />
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {filters && filters.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {filters.map((filter) => (
              <ActiveFilterChip key={filter.key} label={filter.label} onRemove={filter.onRemove} />
            ))}
            {onClearFilters && (
              <button
                type="button"
                className="text-xs font-bold text-zinc-400 hover:text-white"
                onClick={onClearFilters}
              >
                Limpiar
              </button>
            )}
          </div>
        )}

        <div className="flex rounded-lg bg-white/5 p-0.5" role="group" aria-label="Densidad">
          {(["comfortable", "compact"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onDensityChange(option)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-bold transition ${
                density === option
                  ? "bg-[var(--admin-primary-strong)] text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
              title={option === "comfortable" ? "Cómodo" : "Compacto"}
              aria-label={option === "comfortable" ? "Cómodo" : "Compacto"}
            >
              {option === "comfortable" ? "Cómodo" : "Compacto"}
            </button>
          ))}
        </div>

        {onViewChange && (
          <div className="flex rounded-lg bg-white/5 p-0.5" role="group" aria-label="Vista">
            {(["board", "list"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onViewChange(option)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-bold transition ${
                  view === option
                    ? "bg-[var(--admin-primary-strong)] text-white"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
                title={option === "board" ? "Tablero" : "Lista"}
                aria-label={option === "board" ? "Tablero" : "Lista"}
              >
                <Icon name={option === "board" ? "grid" : "list"} className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        )}

        {actions}
      </div>
    </div>
  );
}
