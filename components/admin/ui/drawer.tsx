"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

/** @summary Drawer lateral para formularios, detalles o filtros avanzados. */
export function Drawer({
  open,
  onClose,
  title,
  width = "480px",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  width?: string;
  children: ReactNode;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElement = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    previousActiveElement.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      (previousActiveElement.current as HTMLElement | null)?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "Tab") {
        const panel = closeButtonRef.current?.closest("aside");
        const focusable = panel?.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
        );
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[120]" role="presentation">
      <div className="modal-backdrop-in absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <aside
        className="salon-drawer absolute right-0 top-0 h-full w-full overflow-y-auto border-l border-[var(--admin-border-strong)] bg-[var(--admin-surface-overlay)] shadow-2xl sm:w-[var(--drawer-width)] sm:max-w-[calc(100vw-1rem)]"
        style={{ "--drawer-width": width } as CSSProperties}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-overlay)] px-4 py-3 pt-[max(.75rem,env(safe-area-inset-top))] backdrop-blur sm:px-5 sm:py-4">
          <h2 className="min-w-0 break-words text-lg font-bold">{title}</h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-elevated)] text-sm text-zinc-400 transition-colors hover:text-white sm:h-8 sm:w-8"
            aria-label="Cerrar"
          >
            ×
          </button>
        </header>
        <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5">{children}</div>
      </aside>
    </div>
  );
}
