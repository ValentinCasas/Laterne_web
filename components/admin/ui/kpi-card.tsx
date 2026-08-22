import type { ReactNode } from "react";
import { NumberFlow } from "./number-flow";

/** @summary Tarjeta KPI genérica para cualquier módulo del admin. */
export function KpiCard({
  label,
  value,
  tone = "text-white",
  change,
  icon,
  size = "default",
  format,
  locale = "es-AR",
}: {
  label: string;
  value: string | number;
  tone?: string;
  change?: { value: number; label: string };
  icon?: ReactNode;
  size?: "default" | "compact";
  format?: Intl.NumberFormatOptions;
  locale?: string;
}) {
  const compact = size === "compact";
  return (
    <div
      className={`admin-kpi-card group relative overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 shadow-[var(--admin-shadow-sm)] transition-[transform,border-color,box-shadow] duration-150 hover:-translate-y-0.5 hover:border-[var(--admin-border-strong)] hover:shadow-[var(--admin-shadow-md)] sm:p-5 ${
        compact ? "" : "sm:p-6"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-[11px] font-bold uppercase tracking-wider text-[var(--admin-muted)]">
          {label}
        </p>
        {icon && (
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-elevated)] text-[var(--admin-primary)]">
            {icon}
          </span>
        )}
      </div>
      <p className={`mt-3 truncate font-black tabular-nums ${tone} ${compact ? "text-2xl" : "text-3xl"}`}>
        {typeof value === "number" ? <NumberFlow value={value} locale={locale} format={format} /> : value}
      </p>
      {change !== undefined && (
        <p
          className={`mt-2 text-xs font-semibold ${change.value >= 0 ? "text-emerald-300" : "text-red-300"}`}
        >
          {change.value >= 0 ? "+" : ""}
          {change.value.toFixed(1)}% {change.label}
        </p>
      )}
    </div>
  );
}
