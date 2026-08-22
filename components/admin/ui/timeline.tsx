"use client";

import { useMemo, useState, type ReactNode } from "react";

export type TimelineItem = {
  id: string | number;
  date: string | Date;
  title: ReactNode;
  description?: ReactNode;
  actor?: ReactNode;
  icon?: ReactNode;
  tone?: "default" | "info" | "success" | "warning" | "danger";
};

const toneClass = {
  default: "border-zinc-500/35 bg-zinc-500/15 text-zinc-300",
  info: "border-sky-500/35 bg-sky-500/15 text-sky-300",
  success: "border-emerald-500/35 bg-emerald-500/15 text-emerald-300",
  warning: "border-amber-500/35 bg-amber-500/15 text-amber-300",
  danger: "border-red-500/35 bg-red-500/15 text-red-300",
} as const;

function dateKey(value: string | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return date.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function timeLabel(value: string | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

function isoLabel(value: string | Date) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/** @summary Presenta eventos agrupados por día con progresión visual, scroll y expansión accesible. */
export function Timeline({
  items,
  initialLimit = 8,
  emptyMessage = "Todavía no hay actividad registrada.",
  className = "",
}: {
  items: readonly TimelineItem[];
  initialLimit?: number;
  emptyMessage?: string;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const ordered = useMemo(
    () => [...items].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [items],
  );
  const visible = expanded ? ordered : ordered.slice(0, initialLimit);
  const grouped = visible.reduce<Array<{ label: string; items: TimelineItem[] }>>((groups, item) => {
    const label = dateKey(item.date);
    const current = groups.at(-1);
    if (current?.label === label) current.items.push(item);
    else groups.push({ label, items: [item] });
    return groups;
  }, []);

  if (items.length === 0) {
    return <p className={`rounded-xl border border-dashed border-[var(--admin-border)] p-6 text-center text-sm text-[var(--admin-muted)] ${className}`}>{emptyMessage}</p>;
  }

  return (
    <div className={className}>
      <div className="max-h-[32rem] space-y-5 overflow-y-auto overscroll-contain pr-1">
        {grouped.map((group) => (
          <section key={group.label} aria-label={group.label}>
            <h3 className="sticky top-0 z-[1] mb-2 bg-[var(--admin-surface-overlay)]/95 py-1 text-[10px] font-bold uppercase tracking-[.16em] text-[var(--admin-muted)] backdrop-blur">
              {group.label}
            </h3>
            <ol className="space-y-0">
              {group.items.map((item, index) => {
                const tone = item.tone ?? "default";
                return (
                  <li key={item.id} className="relative grid grid-cols-[2rem_minmax(0,1fr)_auto] gap-3 pb-4">
                    {index < group.items.length - 1 && (
                      <span className="absolute bottom-0 left-[.95rem] top-8 w-px bg-[var(--admin-border)]" aria-hidden="true" />
                    )}
                    <span className={`relative z-[1] grid h-8 w-8 place-items-center rounded-full border text-xs font-bold ${toneClass[tone]}`} aria-hidden="true">
                      {item.icon ?? "•"}
                    </span>
                    <div className="min-w-0 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2.5">
                      <p className="text-sm font-semibold text-[var(--admin-text)]">{item.title}</p>
                      {item.description && <div className="mt-0.5 text-xs leading-5 text-[var(--admin-muted)]">{item.description}</div>}
                      {item.actor && <div className="mt-1 text-[11px] text-zinc-500">Por {item.actor}</div>}
                    </div>
                    <time className="pt-2 text-[11px] tabular-nums text-zinc-500" dateTime={isoLabel(item.date)}>
                      {timeLabel(item.date)}
                    </time>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
      {ordered.length > initialLimit && (
        <button type="button" className="mt-2 text-xs font-bold text-[var(--admin-primary)] transition hover:text-white" onClick={() => setExpanded((current) => !current)}>
          {expanded ? "Ver menos" : `Ver todo (${ordered.length})`}
        </button>
      )}
    </div>
  );
}
