import type { ReactNode } from "react";

/** @summary Tarjeta KPI genérica para cualquier módulo del admin. */
export function KpiCard({
  label,
  value,
  tone = "text-white",
  change,
  icon,
  size = "default",
}: {
  label: string;
  value: string | number;
  tone?: string;
  change?: { value: number; label: string };
  icon?: ReactNode;
  size?: "default" | "compact";
}) {
  const compact = size === "compact";
  return (
    <div
      className={`group rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 transition-colors hover:border-white/20 sm:p-5 ${
        compact ? "" : "sm:p-6"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-[11px] font-bold uppercase tracking-wider text-[var(--admin-muted)]">
          {label}
        </p>
        {icon && (
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/5 text-[var(--admin-primary)]">
            {icon}
          </span>
        )}
      </div>
      <p
        className={`mt-3 truncate font-black tabular-nums ${tone} ${
          compact ? "text-2xl" : "text-3xl"
        }`}
      >
        {typeof value === "number" ? value.toLocaleString("es-AR") : value}
      </p>
      {change !== undefined && (
        <p
          className={`mt-2 text-xs font-semibold ${
            change.value >= 0 ? "text-emerald-300" : "text-red-300"
          }`}
        >
          {change.value >= 0 ? "+" : ""}
          {change.value.toFixed(1)}% {change.label}
        </p>
      )}
    </div>
  );
}
