"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** @summary Drawer lateral para formularios, detalles o filtros avanzados. */
export function Drawer({ open, onClose, title, width = "480px", children }: { open: boolean; onClose: () => void; title: string; width?: string; children: ReactNode }) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElement = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    previousActiveElement.current = document.activeElement;
    closeButtonRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      (previousActiveElement.current as HTMLElement | null)?.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true }));
      (previousActiveElement.current as HTMLElement | null)?.focus();
    }
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[120]">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full overflow-y-auto border-l border-white/10 bg-zinc-950 shadow-2xl sm:w-auto" style={{ maxWidth: width }}>
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-zinc-950/90 px-5 py-4 backdrop-blur">
          <h2 className="text-lg font-black">{title}</h2>
          <button ref={closeButtonRef} type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-white/5 text-sm text-zinc-400 transition-colors hover:bg-white/10 hover:text-white" aria-label="Cerrar">
            ×
          </button>
        </header>
        <div className="p-5">{children}</div>
      </aside>
    </div>
  );
}
