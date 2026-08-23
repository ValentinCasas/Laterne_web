"use client";

import { useEffect, useRef, useState } from "react";

/** @summary Barra de filtros colapsable con overlay en mobile. */
export function FiltersBar({
  title = "Filtros",
  activeCount = 0,
  onClear,
  children,
}: {
  title?: string;
  activeCount?: number;
  onClear?: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const lockBody = window.matchMedia("(max-width: 639px)").matches;
    const previousOverflow = document.body.style.overflow;
    if (lockBody) document.body.style.overflow = "hidden";
    function handlePointer(event: PointerEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) setOpen(false);
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointer);
    document.addEventListener("keydown", handleEscape);
    return () => {
      if (lockBody) document.body.style.overflow = previousOverflow;
      document.removeEventListener("pointerdown", handlePointer);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-11 items-center gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-elevated)] px-3 text-sm font-semibold text-zinc-300 transition-colors hover:border-[var(--admin-border-strong)] hover:text-white sm:h-9"
      >
        <span>{title}</span>
        {activeCount > 0 && (
          <span className="rounded-full bg-[var(--admin-primary-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--admin-primary)]">
            {activeCount}
          </span>
        )}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[150] bg-black/50 backdrop-blur-sm sm:relative sm:inset-auto sm:z-10 sm:bg-transparent sm:backdrop-blur-none"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            ref={panelRef}
            className="absolute bottom-0 left-0 right-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-2xl border border-[var(--admin-border-strong)] bg-[var(--admin-surface-overlay)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:relative sm:bottom-auto sm:left-auto sm:right-auto sm:top-full sm:mt-2 sm:max-h-none sm:w-80 sm:rounded-xl sm:pb-4"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <div className="flex items-center justify-between border-b border-[var(--admin-border)] pb-3">
              <span className="text-sm font-bold text-zinc-200">{title}</span>
              <div className="flex items-center gap-2">
                {onClear && (
                  <button
                    type="button"
                    onClick={onClear}
                    className="min-h-11 px-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200 sm:min-h-0 sm:px-0"
                  >
                    Limpiar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="min-h-11 px-2 text-xs font-bold text-zinc-500 hover:text-zinc-300 sm:min-h-0 sm:px-0"
                >
                  Cerrar
                </button>
              </div>
            </div>
            <div className="mt-3 space-y-3">{children}</div>
          </div>
        </div>
      )}
    </div>
  );
}
