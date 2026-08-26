"use client";

import { type ReactNode } from "react";
import type { Density } from "@/components/admin/kanban/types";

export type BoardCardVariant = "default" | "selected" | "disabled" | "warning" | "error" | "completed";

const VARIANT_STYLES: Record<BoardCardVariant, string> = {
  default: "border-[var(--admin-border)] bg-[var(--admin-surface)] hover:border-[var(--admin-border-strong)] hover:bg-[var(--admin-surface-elevated)]",
  selected: "border-[var(--admin-primary)]/60 bg-[var(--admin-primary-soft)] ring-1 ring-[var(--admin-primary)]/20",
  disabled: "opacity-50 cursor-not-allowed",
  warning: "border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50",
  error: "border-red-500/30 bg-red-500/5 hover:border-red-500/50",
  completed: "border-emerald-500/20 bg-emerald-500/[.03]",
};

const DENSITY_CLASSES: Record<Density, { padding: string; gap: string; text: string; meta: string }> = {
  comfortable: {
    padding: "p-4",
    gap: "gap-3",
    text: "text-sm",
    meta: "text-xs",
  },
  compact: {
    padding: "p-2.5",
    gap: "gap-2",
    text: "text-xs",
    meta: "text-[11px]",
  },
};

/** @summary Card base para tableros con variantes de estado y densidades cómoda / compacta. */
export function BoardCard({
  variant = "default",
  density = "comfortable",
  header,
  content,
  metadata,
  actions,
  badges,
  className,
  onClick,
  draggable = false,
  onDragStart,
  onDragEnd,
}: {
  variant?: BoardCardVariant;
  density?: Density;
  header?: ReactNode;
  content?: ReactNode;
  metadata?: ReactNode;
  actions?: ReactNode;
  badges?: ReactNode;
  className?: string;
  onClick?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}) {
  const styles = DENSITY_CLASSES[density];

  return (
    <article
      className={`
        group relative rounded-xl border shadow-[var(--admin-shadow-sm)] transition-all duration-150
        ${VARIANT_STYLES[variant]}
        ${styles.padding}
        ${onClick ? "cursor-pointer" : ""}
        ${draggable ? "cursor-grab active:cursor-grabbing" : ""}
        ${className ?? ""}
      `}
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className={`flex flex-col ${styles.gap}`}>
        {header && (
          <div className={`flex items-start justify-between gap-2 ${styles.text}`}>
            <div className="min-w-0 flex-1">{header}</div>
            {badges && <div className="flex shrink-0 items-center gap-1.5">{badges}</div>}
          </div>
        )}

        {content && (
          <div className={`text-zinc-200 ${styles.text}`}>{content}</div>
        )}

        {metadata && (
          <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-zinc-500 ${styles.meta}`}>
            {metadata}
          </div>
        )}

        {actions && (
          <div className="flex items-center gap-2 pt-1">
            {actions}
          </div>
        )}
      </div>
    </article>
  );
}

/** @summary Icono de arrastre para tarjetas draggables. */
export function DragHandle({ className }: { className?: string }) {
  return (
    <span className={`flex h-4 w-4 cursor-grab items-center justify-center text-zinc-600 active:cursor-grabbing ${className ?? ""}`}>
      <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
        <circle cx="8" cy="4" r="1.5" />
        <circle cx="8" cy="8" r="1.5" />
        <circle cx="8" cy="12" r="1.5" />
      </svg>
    </span>
  );
}

/** @summary Badge de estado con punto indicador. */
export function StatusDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{label}</span>
    </span>
  );
}
