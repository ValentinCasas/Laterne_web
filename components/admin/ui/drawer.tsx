"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * @summary Drawer lateral con header sticky, contenido scrollable y footer sticky opcional.
 *
 * Renderiza via `createPortal` a `document.body` para escapar stacking contexts
 * de padres (ej: animaciones CSS en admin-main > *).
 *
 * Desktop (≥640px): panel derecho, `position: fixed`, top = navbarHeight, bottom = 0,
 *   ancho configurable, pegado al borde derecho del viewport.
 * Mobile (<640px): fullscreen sheet, safe-area aware.
 * Scroll único dentro del contenido. Header y footer siempre visibles.
 */
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

  /* ── Portal mount: null until first client render ── */
  const [portalTarget, setPortalTarget] = useState<Element | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- portal mount after SSR
    setPortalTarget(document.body);
  }, []);

  /* ── Body scroll lock ── */
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

  /* ── Keyboard: Escape + Tab trap ── */
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

  if (!open || !portalTarget) return null;

  const panelStyle = {
    "--drawer-width": width,
  } as CSSProperties;

  const content = (
    <div className="fixed inset-0 z-[120]" role="presentation">
      {/* ── Backdrop ── */}
      <div
        className="modal-backdrop-in absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* ── Panel ── */}
      <aside
        className="salon-drawer fixed flex flex-col overflow-hidden bg-[var(--admin-surface-overlay)] shadow-2xl
          inset-0 z-10
          sm:inset-auto sm:right-0 sm:top-0 sm:bottom-0 sm:border-l sm:border-[var(--admin-border-strong)]"
        style={panelStyle}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {/* ── Header ── */}
        <header className="shrink-0 border-b border-[var(--admin-border)] bg-[var(--admin-surface-overlay)] backdrop-blur">
          {/* Spacer: safe-area on mobile, navbar-height on desktop */}
          <div
            className="sm:h-[var(--site-navbar-height,56px)]"
            style={{ height: "max(.75rem, env(safe-area-inset-top, 0px))" } as CSSProperties}
            aria-hidden
          />
          {/* Actual header content */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-4">
            <h2 className="min-w-0 flex-1 truncate break-words text-base font-bold sm:text-lg">
              {title}
            </h2>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-elevated)] text-lg text-zinc-400 transition-colors hover:text-white sm:h-9 sm:w-9 sm:rounded-lg sm:text-sm"
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>
        </header>

        {/* ── Content (única zona scrollable) ── */}
        <div
          className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5"
          style={{
            paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))",
          } as CSSProperties}
        >
          {children}
        </div>

        {/* ── Footer / Actions (sticky bottom, always visible) ── */}
        {footer && (
          <footer
            className="shrink-0 border-t border-[var(--admin-border)] bg-[var(--admin-surface-overlay)] backdrop-blur px-4 py-3 sm:px-5 sm:py-4"
            style={{
              paddingBottom: "max(.75rem, env(safe-area-inset-bottom, 0px))",
            } as CSSProperties}
          >
            {footer}
          </footer>
        )}
      </aside>
    </div>
  );

  return createPortal(content, portalTarget);
}
