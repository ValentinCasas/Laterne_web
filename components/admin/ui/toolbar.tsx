import type { ReactNode } from "react";
import { Icon } from "@/components/admin/ui/icons";

/** @summary Barra de herramientas superior: búsqueda, filtros, acciones. */
export function Toolbar({
  search,
  onSearchChange,
  searchPlaceholder = "Buscar...",
  filtersButton,
  filtersActive,
  rightActions,
  children,
}: {
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filtersButton?: ReactNode;
  filtersActive?: boolean;
  rightActions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 items-center gap-2">
        {onSearchChange !== undefined && (
          <div className="relative flex-1 sm:max-w-xs">
            <input
              type="search"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 pl-9 text-sm text-zinc-300 outline-none transition-colors placeholder:text-zinc-500 focus:border-pink-500/50 focus:bg-white/10"
            />
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500"><Icon name="search" className="h-4 w-4" /></span>
          </div>
        )}
        {filtersButton}
      </div>
      <div className="flex items-center gap-2">
        {filtersActive !== undefined && filtersActive && (
          <span className="rounded-full bg-pink-500/10 px-2 py-1 text-[10px] font-bold text-pink-300">Filtros activos</span>
        )}
        {rightActions}
        {children}
      </div>
    </div>
  );
}
