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
    <div className="admin-toolbar flex flex-col gap-2 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-2 shadow-[var(--admin-shadow-sm)] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {onSearchChange !== undefined && (
          <div className="relative flex-1 sm:max-w-xs">
            <input
              type="search"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
              className="admin-control h-9 w-full rounded-lg border border-transparent bg-[var(--admin-surface-elevated)] px-3 pl-9 text-sm text-zinc-200 outline-none placeholder:text-zinc-500 focus:border-[var(--admin-primary)]/55"
            />
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
              <Icon name="search" className="h-4 w-4" />
            </span>
          </div>
        )}
        {filtersButton}
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {filtersActive !== undefined && filtersActive && (
          <span className="rounded-full bg-pink-500/10 px-2 py-1 text-[10px] font-bold text-pink-300">
            Filtros activos
          </span>
        )}
        {rightActions}
        {children}
      </div>
    </div>
  );
}
