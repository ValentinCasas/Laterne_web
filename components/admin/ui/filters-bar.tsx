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
    function handlePointer(event: PointerEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) setOpen(false);
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointer);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handlePointer);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-zinc-300 transition-colors hover:bg-white/10"
      >
        <span>{title}</span>
        {activeCount > 0 && (
          <span className="rounded-full bg-pink-500/15 px-1.5 py-0.5 text-[10px] font-black text-pink-300">{activeCount}</span>
        )}
      </button>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm sm:relative sm:inset-auto sm:z-10 sm:bg-transparent sm:backdrop-blur-none" onClick={() => setOpen(false)}>
          <div
            ref={panelRef}
            className="absolute bottom-0 left-0 right-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl border border-white/10 bg-[var(--admin-surface)] p-4 sm:relative sm:bottom-auto sm:left-auto sm:right-auto sm:top-full sm:mt-2 sm:max-h-none sm:w-80 sm:rounded-xl sm:shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <span className="text-sm font-bold text-zinc-200">{title}</span>
              <div className="flex items-center gap-2">
                {onClear && (
                  <button type="button" onClick={onClear} className="text-xs font-semibold text-zinc-400 hover:text-zinc-200">
                    Limpiar
                  </button>
                )}
                <button type="button" onClick={() => setOpen(false)} className="text-xs font-bold text-zinc-500 hover:text-zinc-300">
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
