"use client";

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

/** @summary Navegación paginada compartida para listados administrativos. */
export function Pagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
}: {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: readonly number[];
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const from = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(totalItems, safePage * pageSize);

  return (
    <div className="flex flex-col gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-elevated)]/55 px-3 py-3 text-xs text-[var(--admin-muted)] sm:flex-row sm:items-center sm:justify-between">
      <p aria-live="polite">
        Mostrando <span className="font-semibold text-[var(--admin-text)]">{from}–{to}</span> de{" "}
        <span className="font-semibold text-[var(--admin-text)]">{totalItems}</span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2">
          <span className="sr-only sm:not-sr-only">Filas</span>
          <select
            className="h-11 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 text-xs font-semibold text-[var(--admin-text)] outline-none focus:border-[var(--admin-primary)] sm:h-8"
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            aria-label="Filas por página"
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option} por página
              </option>
            ))}
          </select>
        </label>
        <span className="min-w-16 text-center tabular-nums">
          {safePage} / {totalPages}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            className="grid h-11 w-11 place-items-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] font-bold transition hover:border-[var(--admin-border-strong)] hover:text-white disabled:cursor-not-allowed disabled:opacity-35 sm:h-8 sm:w-8"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
            aria-label="Página anterior"
          >
            ‹
          </button>
          <button
            type="button"
            className="grid h-11 w-11 place-items-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] font-bold transition hover:border-[var(--admin-border-strong)] hover:text-white disabled:cursor-not-allowed disabled:opacity-35 sm:h-8 sm:w-8"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(safePage + 1)}
            aria-label="Página siguiente"
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );
}
