"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

/** @summary Drawer lateral con header sticky, contenido scrollable y footer sticky opcional. Desktop: pegado a la derecha, debajo del navbar. Mobile: bottom sheet / fullscreen. */
export function Drawer({
  open,
  onClose,
  title,
  width = "480px",
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  width?: string;
  children: ReactNode;
  footer?: ReactNode;
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
        const panel = closeButtonRef.current?.closest("[role='dialog']");
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
      {/* Backdrop */}
      <div className="modal-backdrop-in absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={onClose} aria-hidden="true" />

      {/* Panel — Desktop: right side, below navbar. Mobile: bottom sheet. */}
      <aside
        className="salon-drawer fixed flex flex-col overflow-hidden border-l border-[var(--admin-border-strong)] bg-[var(--admin-surface-overlay)] shadow-2xl
          /* Mobile: bottom sheet — full width, from bottom, safe-area aware */
          inset-x-0 bottom-0 top-auto h-[85vh] max-h-[90vh] rounded-t-[2rem] border-t border-[var(--admin-border-strong)]
          /* Desktop: below navbar, fixed width, full height */
          sm:inset-x-auto sm:right-0 sm:top-[var(--site-navbar-height, 56px)] sm:bottom-auto sm:h-[calc(100dvh-var(--site-navbar-height,56px))] sm:w-[var(--drawer-width)] sm:max-w-[calc(100vw-1rem)] sm:rounded-none sm:border-t-0"
        style={{
          "--drawer-width": width,
        } as CSSProperties}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {/* Header — sticky arriba */}
        <header className="shrink-0 flex items-center justify-between gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-overlay)] px-4 py-3 pt-[max(.75rem,env(safe-area-inset-top))] backdrop-blur sm:px-5 sm:py-4">
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

        {/* Contenido — única zona scrollable */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5">
          {children}
        </div>

        {/* Footer — sticky abajo (opcional) */}
        {footer && (
          <footer className="shrink-0 border-t border-[var(--admin-border)] bg-[var(--admin-surface-overlay)] px-4 py-3 pb-[max(.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:px-5 sm:py-4">
            {footer}
          </footer>
        )}
      </aside>
    </div>
  );
}
