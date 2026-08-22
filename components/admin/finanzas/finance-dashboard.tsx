"use client";

import { useMemo, useState } from "react";
import { PageHeader, KpiCard, DataTable, StatusBadge } from "@/components/admin/ui";
import { money, dateLabel } from "@/lib/finance-helpers";
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
export function FinanceDashboardClient({ initial }: { initial: DashboardInitial }) {
  const [dashboard] = useState(initial.dashboard);
  const currency = initial.currency ?? "ARS";

  const kpis = useMemo(
    () => [
      { label: "Saldo total", value: money(dashboard.totalBalance, currency), tone: "text-emerald-300" },
      { label: "Vencido cobrar", value: money(dashboard.receivablesOverdue, currency), tone: "text-rose-300" },
      { label: "Vencido pagar", value: money(dashboard.payablesOverdue, currency), tone: "text-red-300" },
      { label: "Resultado operativo", value: money(dashboard.operatingResult, currency), tone: "text-violet-300" },
    ],
    [dashboard, currency],
  );

  const detailRows = useMemo(
    () => [
      { label: "Cajas", value: money(dashboard.cashBalance, currency), tone: "text-sky-300" },
      { label: "Bancos", value: money(dashboard.bankBalance, currency), tone: "text-indigo-300" },
      { label: "Cuentas a cobrar", value: money(dashboard.receivablesTotal, currency), tone: "text-amber-300" },
      { label: "Cuentas a pagar", value: money(dashboard.payablesTotal, currency), tone: "text-orange-300" },
    ],
    [dashboard, currency],
  );

  const tableData = useMemo(
    () =>
      dashboard.recentMovements.map((movement) => ({
        id: movement.id,
        fecha: dateLabel(movement.date),
        cuenta: <span className="font-medium">{movement.accountName}</span>,
        tipo: <span className="capitalize">{movement.type}</span>,
        direccion: (
          <StatusBadge
            status={movement.direction === "in" ? "Ingreso" : "Egreso"}
            tone={movement.direction === "in" ? "success" : "danger"}
          />
        ),
        importe: (
          <span className={`text-right font-black tabular-nums block ${movement.direction === "in" ? "text-emerald-300" : "text-rose-300"}`}>
            {money(movement.amount, currency)}
          </span>
        ),
        concepto: <span className="max-w-xs truncate block">{movement.concept}</span>,
        origen: <span className="text-xs text-[var(--admin-muted)]">{movement.origin}</span>,
      })),
    [dashboard.recentMovements, currency],
  );

  return (
    <div>
      <PageHeader
        section="Finanzas"
        title="Resumen financiero"
        description="Panorama general de cuentas, cobranzas, pagos y resultado operativo"
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} label={kpi.label} value={kpi.value} tone={kpi.tone} />
        ))}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
            <h3 className="mb-3 text-sm font-black uppercase tracking-wider text-[var(--admin-muted)]">Detalle</h3>
            <div className="space-y-2">
              {detailRows.map((row) => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-sm text-[var(--admin-muted)]">{row.label}</span>
                  <span className={`text-sm font-black tabular-nums ${row.tone}`}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="lg:col-span-2">
          <div className="overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl shadow-black/10">
        <div className="px-5 py-4">
          <h2 className="text-sm font-black uppercase tracking-wider text-[var(--admin-muted)]">Movimientos recientes</h2>
        </div>
        <DataTable
          viewStorageKey="dashboard-cuentas"
          columns={[
            { key: "fecha", label: "Fecha" },
            { key: "cuenta", label: "Cuenta" },
            { key: "tipo", label: "Tipo" },
            { key: "direccion", label: "Dirección" },
            { key: "importe", label: "Importe", align: "right" },
            { key: "concepto", label: "Concepto" },
            { key: "origen", label: "Origen", hideOnMobile: true },
          ]}
          data={tableData}
          keyExtractor={(row) => row.id as number}
          emptyMessage="No hay movimientos registrados. Creá una cuenta y empezá a operar."
          density="compact"
        />
          </div>
        </div>
      </div>
    </div>
  );
}
