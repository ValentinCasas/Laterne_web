import type { ReactNode } from "react";

/** @summary Tarjeta KPI genérica para cualquier módulo del admin. */
export function KpiCard({ label, value, tone = "text-white", change, icon }: { label: string; value: string | number; tone?: string; change?: { value: number; label: string }; icon?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 transition-colors hover:border-white/10">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--admin-muted)]">{label}</p>
        {icon && <span className="text-zinc-500">{icon}</span>}
      </div>
      <p className={`mt-3 truncate text-3xl font-black tabular-nums ${tone}`}>{typeof value === "number" ? value.toLocaleString("es-AR") : value}</p>
      {change !== undefined && (
        <p className={`mt-2 text-xs font-semibold ${change.value >= 0 ? "text-emerald-300" : "text-red-300"}`}>
          {change.value >= 0 ? "+" : ""}{change.value.toFixed(1)}% {change.label}
        </p>
      )}
    </div>
  );
}
