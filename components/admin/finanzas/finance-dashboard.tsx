"use client";

import { useCallback, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { scopedFetch } from "@/lib/client-routing";

export type DashboardInitial = {
  tenantId: number;
  currency: string;
  activeBranchId: number | null;
  dashboard: {
    totalBalance: number;
    cashBalance: number;
    bankBalance: number;
    receivablesTotal: number;
    receivablesOverdue: number;
    payablesTotal: number;
    payablesOverdue: number;
    operatingResult: number;
    recentMovements: Array<{
      id: number;
      date: string;
      accountName: string;
      type: string;
      direction: string;
      amount: number;
      concept: string;
      reference?: string | null;
      origin: string;
    }>;
  };
};

/** @summary Formatea un importe con la moneda del negocio. */
function money(value: number | null | undefined, currency: string) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

/** @summary Formatea una fecha ISO. */
function dateLabel(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

/** @summary Ejecuta una petición de API. */
async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await scopedFetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body?.error ?? "No se pudo completar la operación");
  return body;
}

/** @summary Tarjeta KPI del dashboard. */
function KpiCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-5 py-4">
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--admin-muted)]">{label}</p>
      <p className={`mt-2 truncate text-2xl font-black tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

/** @summary Gestor del dashboard financiero. */
export function FinanceDashboardClient({ initial }: { initial: DashboardInitial }) {
  const [dashboard] = useState(initial.dashboard);
  const currency = initial.currency ?? "ARS";

  const kpis = useMemo(
    () => [
      { label: "Saldo total", value: money(dashboard.totalBalance, currency), tone: "text-emerald-300" },
      { label: "Cajas", value: money(dashboard.cashBalance, currency), tone: "text-sky-300" },
      { label: "Bancos", value: money(dashboard.bankBalance, currency), tone: "text-indigo-300" },
      { label: "Cuentas a cobrar", value: money(dashboard.receivablesTotal, currency), tone: "text-amber-300" },
      { label: "Vencido cobrar", value: money(dashboard.receivablesOverdue, currency), tone: "text-rose-300" },
      { label: "Cuentas a pagar", value: money(dashboard.payablesTotal, currency), tone: "text-orange-300" },
      { label: "Vencido pagar", value: money(dashboard.payablesOverdue, currency), tone: "text-red-300" },
      { label: "Resultado operativo", value: money(dashboard.operatingResult, currency), tone: "text-violet-300" },
    ],
    [dashboard, currency],
  );

  return (
    <div>
      <div className="mb-4">
        <p className="section-eyebrow">Finanzas</p>
        <h1 className="text-2xl font-black tracking-tight">Resumen financiero</h1>
        <p className="mt-1 text-sm text-[var(--admin-muted)]">
          Panorama general de cuentas, cobranzas, pagos y resultado operativo
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} label={kpi.label} value={kpi.value} tone={kpi.tone} />
        ))}
      </div>

      <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl shadow-black/10">
        <div className="border-b border-[var(--admin-border)] px-5 py-4">
          <h2 className="text-lg font-black">Movimientos recientes</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--admin-border)] bg-white/[0.02] text-xs uppercase tracking-wider text-[var(--admin-muted)]">
                <th className="px-5 py-3 font-bold">Fecha</th>
                <th className="px-5 py-3 font-bold">Cuenta</th>
                <th className="px-5 py-3 font-bold">Tipo</th>
                <th className="px-5 py-3 font-bold">Dirección</th>
                <th className="px-5 py-3 font-bold text-right">Importe</th>
                <th className="px-5 py-3 font-bold">Concepto</th>
                <th className="px-5 py-3 font-bold">Origen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--admin-border)]">
              {dashboard.recentMovements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-[var(--admin-muted)]">
                    No hay movimientos recientes
                  </td>
                </tr>
              ) : (
                dashboard.recentMovements.map((movement) => (
                  <tr key={movement.id} className="hover:bg-white/[0.02]">
                    <td className="px-5 py-3">{dateLabel(movement.date)}</td>
                    <td className="px-5 py-3 font-medium">{movement.accountName}</td>
                    <td className="px-5 py-3 capitalize">{movement.type}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          movement.direction === "in"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-rose-500/15 text-rose-300"
                        }`}
                      >
                        {movement.direction === "in" ? "Ingreso" : "Egreso"}
                      </span>
                    </td>
                    <td
                      className={`px-5 py-3 text-right font-black tabular-nums ${
                        movement.direction === "in" ? "text-emerald-300" : "text-rose-300"
                      }`}
                    >
                      {money(movement.amount, currency)}
                    </td>
                    <td className="px-5 py-3 max-w-xs truncate">{movement.concept}</td>
                    <td className="px-5 py-3 text-xs text-[var(--admin-muted)]">{movement.origin}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
