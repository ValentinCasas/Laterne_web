"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

/**
 * @summary Menú contextual reutilizable con posicionamiento inteligente.
 *
 * Usa un portal para renderizar fuera del contenedor padre (evita clipping
 * por overflow-hidden o border-radius). Se posiciona arriba o abajo según
 * el espacio disponible en el viewport. Se cierra con click afuera o Escape.
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
  const [position, setPosition] = useState<"bottom" | "top">("bottom");
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const panelId = useId();

  /** @summary Calcula si el menú debe abrirse hacia arriba o hacia abajo. */
  const computePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    setPosition(spaceBelow < 220 ? "top" : "bottom");
  }, []);

  useEffect(() => {
    if (!open) return;

    computePosition();

    /** @summary Cierra el menú al hacer click fuera o presionar Escape. */
    function handlePointer(event: PointerEvent) {
      const target = event.target as Node;
      if (
        panelRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      )
        return;
      setOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, computePosition]);

  return (
    <div className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-xs font-black text-zinc-300 transition-colors hover:bg-white/10"
        aria-haspopup="menu"
        aria-expanded={open}          aria-controls={panelId}
      >
        ⋯
      </button>
      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="menu"
          className={`absolute z-[100] mt-1 w-44 overflow-hidden rounded-xl border border-white/10 bg-zinc-900 p-1 shadow-xl shadow-black/30 ${
            position === "top" ? "bottom-full mb-1" : "top-full"
          } ${align === "right" ? "right-0" : "left-0"}`}
        >
          {items.map((item, index) => (
            <button
              key={index}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors ${
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
        </div>
      )}
    </div>
  );
}
