"use client";

import { useId, useRef, useState, type ReactNode } from "react";

/** @summary Preview contextual con datos precargados, disponible por hover o foco y desactivado en dispositivos táctiles. */
export function HoverPreview({
  children,
  content,
  align = "start",
  className,
}: {
  children: ReactNode;
  content: ReactNode;
  align?: "start" | "end";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const timer = useRef<number | null>(null);
  const previewId = useId();

  function show() {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(true), 160);
  }

  function hide() {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(false), 90);
  }

  return (
    <span
      className={`relative inline-flex min-w-0 ${className ?? ""}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      aria-describedby={open ? previewId : undefined}
    >
      {children}
      {open && (
        <span
          id={previewId}
          role="tooltip"
          className={`hover-preview-panel absolute top-[calc(100%+.55rem)] z-40 hidden w-72 overflow-hidden rounded-xl border border-[var(--admin-border-strong)] bg-[var(--admin-surface-overlay)] p-3.5 text-left shadow-2xl shadow-black/35 motion-safe:animate-[dropdown-enter_.16s_ease-out] md:block ${
            align === "end" ? "right-0" : "left-0"
          }`}
        >
          {content}
        </span>
      )}
    </span>
  );
}
