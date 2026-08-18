"use client";

import { useMemo } from "react";
import { PageHeader, DataTable } from "@/components/admin/ui";

export type PlInitial = {
  tenantId: number;
  currency: string;
  activeBranchId: number | null;
  pl: {
    grossSales: number;
    discounts: number;
    netSales: number;
    cog: number;
    grossProfit: number;
    operatingExpenses: number;
    operatingResult: number;
    otherIncome: number;
    otherExpenses: number;
    netResult: number;
    previousPeriod: {
      grossSales: number;
      discounts: number;
      netSales: number;
      cog: number;
      grossProfit: number;
      operatingExpenses: number;
      operatingResult: number;
      otherIncome: number;
      otherExpenses: number;
      netResult: number;
    };
    expensesByCategory: Array<{
      category: string;
      amount: number;
      previousAmount: number;
    }>;
  };
};

/** @summary Formatea un importe. */
function money(value: number | null | undefined, currency: string) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

/** @summary Formatea un porcentaje. */
function percent(value: number, total: number) {
  if (!total || total === 0) return "—";
  const pct = (value / total) * 100;
  return `${pct.toFixed(1)}%`;
}

/** @summary Formatea variación. */
function variation(current: number, previous: number) {
  if (!previous || previous === 0) return current > 0 ? "Nuevo" : "—";
  const var_ = ((current - previous) / Math.abs(previous)) * 100;
  const sign = var_ >= 0 ? "+" : "";
  return `${sign}${var_.toFixed(1)}%`;
}

/** @summary Estado de resultados. */
export function FinancePlClient({ initial }: { initial: PlInitial }) {
  const pl = initial.pl;
  const currency = initial.currency ?? "ARS";

  const rows = useMemo(
    () => [
      { label: "Ventas brutas", value: pl.grossSales, prev: pl.previousPeriod.grossSales, bold: false },
      { label: "Descuentos", value: -pl.discounts, prev: -pl.previousPeriod.discounts, bold: false, negative: true },
      { label: "Ventas netas", value: pl.netSales, prev: pl.previousPeriod.netSales, bold: true },
      { label: "Costo de mercadería vendida", value: -pl.cog, prev: -pl.previousPeriod.cog, bold: false, negative: true },
      { label: "Ganancia bruta", value: pl.grossProfit, prev: pl.previousPeriod.grossProfit, bold: true },
      { label: "Gastos operativos", value: -pl.operatingExpenses, prev: -pl.previousPeriod.operatingExpenses, bold: false, negative: true },
      { label: "Resultado operativo", value: pl.operatingResult, prev: pl.previousPeriod.operatingResult, bold: true },
      { label: "Otros ingresos", value: pl.otherIncome, prev: pl.previousPeriod.otherIncome, bold: false },
      { label: "Otros egresos", value: -pl.otherExpenses, prev: -pl.previousPeriod.otherExpenses, bold: false, negative: true },
      { label: "Resultado neto", value: pl.netResult, prev: pl.previousPeriod.netResult, bold: true },
    ],
    [pl],
  );

  return (
    <div>
      <PageHeader
        section="Finanzas"
        title="Estado de resultados"
        description="Rentabilidad, gastos y comparación con el período anterior"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl shadow-black/10">
          <div className="border-b border-[var(--admin-border)] px-5 py-4">
            <h2 className="text-lg font-black">Resultado del período</h2>
          </div>
          <DataTable
            columns={[
              { key: "concepto", label: "Concepto" },
              { key: "importe", label: "Importe", align: "right" },
              { key: "porcentaje", label: "% sobre ventas", align: "right" },
              { key: "anterior", label: "Período anterior", align: "right" },
              { key: "variacion", label: "Variación", align: "right" },
            ]}
            data={useMemo(() => rows.map((row) => ({
              id: row.label,
              concepto: <span className={row.bold ? "font-black" : "font-medium"}>{row.label}</span>,
              importe: (
                <span className={`text-right tabular-nums block ${row.value >= 0 ? "text-emerald-300" : "text-rose-300"} ${row.bold ? "font-black text-base" : ""}`}>
                  {money(Math.abs(row.value), currency)}
                </span>
              ),
              porcentaje: <span className="text-right text-[var(--admin-muted)] block">{percent(Math.abs(row.value), pl.netSales)}</span>,
              anterior: (
                <span className={`text-right tabular-nums block ${row.prev >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                  {money(Math.abs(row.prev), currency)}
                </span>
              ),
              variacion: (
                <span className={`text-right tabular-nums font-bold block ${row.prev <= row.value ? "text-emerald-300" : "text-rose-300"}`}>
                  {variation(row.value, row.prev)}
                </span>
              ),
            })), [pl, currency, rows])}
            keyExtractor={(row) => row.id as string}
            emptyMessage=""
            density="normal"
          />
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
            <h3 className="mb-3 text-sm font-black uppercase tracking-wider text-[var(--admin-muted)]">Resumen</h3>
            <div className="space-y-3">
              <SummaryRow label="Ventas netas" value={pl.netSales} currency={currency} />
              <SummaryRow label="Ganancia bruta" value={pl.grossProfit} currency={currency} />
              <SummaryRow label="Resultado operativo" value={pl.operatingResult} currency={currency} />
              <SummaryRow label="Resultado neto" value={pl.netResult} currency={currency} bold />
            </div>
          </div>

          {pl.expensesByCategory.length > 0 && (
            <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
              <h3 className="mb-3 text-sm font-black uppercase tracking-wider text-[var(--admin-muted)]">Gastos por categoría</h3>
              <div className="space-y-2">
                {pl.expensesByCategory.map((cat) => (
                  <div key={cat.category} className="flex items-center justify-between">
                    <span className="text-sm text-[var(--admin-muted)]">{cat.category}</span>
                    <div className="text-right">
                      <span className="text-sm font-black tabular-nums text-rose-300">
                        {money(cat.amount, currency)}
                      </span>
                      <span className="ml-2 text-xs text-[var(--admin-muted)]">
                        ({variation(cat.amount, cat.previousAmount)})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  currency,
  bold,
}: { label: string; value: number; currency: string; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${bold ? "border-t border-[var(--admin-border)] pt-2" : ""}`}>
      <span className={`text-sm ${bold ? "font-black" : "text-[var(--admin-muted)]"}`}>{label}</span>
      <span className={`tabular-nums ${value >= 0 ? "text-emerald-300" : "text-rose-300"} ${bold ? "font-black text-base" : ""}`}>
        {money(Math.abs(value), currency)}
      </span>
    </div>
  );
}
