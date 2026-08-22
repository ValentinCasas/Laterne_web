"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * @summary Menú contextual reutilizable con posicionamiento automático.
 *
 * Se renderiza en un portal (`document.body`) para no ser recortado por
 * `overflow-hidden`/`border-radius` de la tabla o de su contenedor. Se posiciona
 * con `position: fixed` calculando arriba/abajo según el espacio disponible y
 * se ajusta dentro del viewport. Se recalcula ante scroll (incluso en
 * contenedores con scroll) y resize.
 */
export function ActionMenu({
  items,
  align = "right",
}: {
  items: Array<{
    label: string;
    tone?: "default" | "danger" | "primary";
    onClick: () => void;
  }>;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const panelId = useId();

  /** @summary Calcula la posición fija del panel evitando el recorte por overflow y el viewport. */
  const reposition = useCallback(() => {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const panelWidth = panel?.offsetWidth ?? 176;
    const panelHeight = panel?.offsetHeight ?? 180;
    const gap = 6;
    const margin = 8;

    const spaceBelow = window.innerHeight - rect.bottom;
    const placeUp = spaceBelow < panelHeight + gap && rect.top > spaceBelow;
    const top = placeUp ? rect.top - gap - panelHeight : rect.bottom + gap;
    let left = align === "right" ? rect.right - panelWidth : rect.left;

    left = Math.min(Math.max(left, margin), window.innerWidth - panelWidth - margin);
    const clampedTop = Math.min(Math.max(top, margin), window.innerHeight - panelHeight - margin);
    setCoords({ top: clampedTop, left });
  }, [align]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(reposition);
    const focusFrame = requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLButtonElement>("[role='menuitem']")?.focus();
    });

    const handlePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (!panelRef.current || !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      const entries = [...panelRef.current.querySelectorAll<HTMLButtonElement>("[role='menuitem']")];
      if (!entries.length) return;
      event.preventDefault();
      const current = entries.indexOf(document.activeElement as HTMLButtonElement);
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? entries.length - 1
            : event.key === "ArrowDown"
              ? (current + 1) % entries.length
              : (current - 1 + entries.length) % entries.length;
      entries[next]?.focus();
    };
    document.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    document.addEventListener("pointerdown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
      document.removeEventListener("pointerdown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, reposition]);

  const trigger = (
    <button
      ref={triggerRef}
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setOpen((current) => !current);
      }}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-elevated)] text-sm font-bold text-zinc-300 transition-colors hover:border-[var(--admin-border-strong)] hover:text-white"
      aria-haspopup="menu"
      aria-expanded={open}
      aria-controls={panelId}
      aria-label="Abrir acciones"
    >
      ⋯
    </button>
  );

  return (
    <>
      {trigger}
      {open &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="menu"
            style={{ position: "fixed", top: coords.top, left: coords.left }}
            className="dropdown-enter z-[100] w-48 overflow-hidden rounded-xl border border-[var(--admin-border-strong)] bg-[var(--admin-surface-overlay)] p-1.5 shadow-2xl shadow-black/35"
          >
            {items.map((item, index) => (
              <button
                key={index}
                type="button"
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  item.onClick();
                }}
                className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium outline-none transition-colors focus-visible:ring-0 ${
                  item.tone === "danger"
                    ? "text-red-300 hover:bg-red-500/10"
                    : item.tone === "primary"
                      ? "text-pink-300 hover:bg-pink-500/10"
                      : "text-zinc-300 hover:bg-white/5"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
