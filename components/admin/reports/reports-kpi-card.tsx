"use client";

/** @summary Tarjeta KPI para reportes con tema oscuro consistente. */
export function ReportsKpiCard({ label, value, tone = "text-white", change }: { label: string; value: string | number; tone?: string; change?: { value: number; label: string } }) {
  return (
    <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-5 py-4">
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--admin-muted)]">{label}</p>
      <p className={`mt-2 truncate text-2xl font-black tabular-nums ${tone}`}>{typeof value === "number" ? value.toLocaleString("es-AR") : value}</p>
      {change !== undefined && (
        <p className={`mt-1 text-xs font-semibold ${change.value >= 0 ? "text-emerald-300" : "text-red-300"}`}>
          {change.value >= 0 ? "+" : ""}{change.value.toFixed(1)}% {change.label}
        </p>
      )}
    </div>
  );
}
