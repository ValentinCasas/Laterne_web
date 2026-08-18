"use client";

import { useCallback, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { scopedFetch } from "@/lib/client-routing";
import { PageHeader, KpiCard, DataTable, StatusBadge, FiltersBar } from "@/components/admin/ui";

export type CashflowInitial = {
  tenantId: number;
  currency: string;
  activeBranchId: number | null;
  cashFlow: {
    startDate: string;
    endDate: string;
    openingBalance: number;
    sales: number;
    collections: number;
    otherIncome: number;
    suppliers: number;
    expenses: number;
    otherExpenses: number;
    transfers: number;
    closingBalance: number;
    details: Array<{
      id: number;
      date: string;
      type: string;
      category: string;
      direction: string;
      amount: number;
      concept: string;
      accountName: string;
    }>;
  };
  branches: Array<{ id: number; name: string; slug: string; active: boolean }>;
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

const PERIOD_OPTIONS = [
  { value: "day", label: "Hoy" },
  { value: "week", label: "Esta semana" },
  { value: "month", label: "Este mes" },
  { value: "custom", label: "Personalizado" },
];

/** @summary Gestor de flujo de caja. */
export function FinanceCashflowClient({ initial }: { initial: CashflowInitial }) {
  const [cashFlow, setCashFlow] = useState(initial.cashFlow);
  const [period, setPeriod] = useState("month");
  const [branchId, setBranchId] = useState(initial.activeBranchId ? String(initial.activeBranchId) : "");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [busy, setBusy] = useState(false);
  const currency = initial.currency ?? "ARS";

  const loadCashFlow = useCallback(async () => {
    setBusy(true);
    try {
      const params = new URLSearchParams();
      params.set("period", period);
      if (branchId) params.set("branchId", branchId);
      if (period === "custom") {
        if (customFrom) params.set("from", customFrom);
        if (customTo) params.set("to", customTo);
      }
      const data = await api<CashflowInitial["cashFlow"]>(
        `/api/admin/finanzas/flujo-caja?${params.toString()}`,
      );
      setCashFlow(data);
    } catch (reason) {
      await Swal.fire({
        title: "Error",
        text: reason instanceof Error ? reason.message : "No se pudo cargar el flujo de caja",
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
    } finally {
      setBusy(false);
    }
  }, [period, branchId, customFrom, customTo]);

  const totalIncome = useMemo(
    () => cashFlow.sales + cashFlow.collections + cashFlow.otherIncome,
    [cashFlow],
  );
  const totalExpenses = useMemo(
    () => cashFlow.suppliers + cashFlow.expenses + cashFlow.otherExpenses + cashFlow.transfers,
    [cashFlow],
  );

  return (
    <div>
      <PageHeader
        section="Finanzas"
        title="Flujo de caja"
        description="Entradas, salidas y saldo del período seleccionado"
      />

      <div className="mb-4">
        <FiltersBar title="Filtros" activeCount={period !== "month" || branchId ? 1 : 0} onClear={() => { setPeriod("month"); setBranchId(""); }}>
          <div className="space-y-3">
            <select
              className="input w-full"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              aria-label="Período"
            >
              {PERIOD_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            {period === "custom" && (
              <>
                <input
                  type="date"
                  className="input w-full"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  aria-label="Fecha desde"
                />
                <input
                  type="date"
                  className="input w-full"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  aria-label="Fecha hasta"
                />
              </>
            )}
            <select
              className="input w-full"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              aria-label="Sucursal"
            >
              <option value="">Todas las sucursales</option>
              {initial.branches.map((b) => (
                <option key={b.id} value={String(b.id)}>
                  {b.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-secondary w-full"
              onClick={loadCashFlow}
              disabled={busy}
            >
              Actualizar
            </button>
          </div>
        </FiltersBar>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard label="Saldo inicial" value={money(cashFlow.openingBalance, currency)} tone="text-zinc-300" />
        <KpiCard label="Ingresos" value={money(totalIncome, currency)} tone="text-emerald-300" />
        <KpiCard label="Egresos" value={money(totalExpenses, currency)} tone="text-rose-300" />
        <KpiCard label="Transferencias" value={money(cashFlow.transfers, currency)} tone="text-sky-300" />
        <KpiCard label="Saldo final" value={money(cashFlow.closingBalance, currency)} tone="text-violet-300" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
            <h3 className="mb-3 text-sm font-black uppercase tracking-wider text-[var(--admin-muted)]">Ingresos</h3>
            <div className="space-y-2">
              <CashRow label="Ventas" value={cashFlow.sales} currency={currency} />
              <CashRow label="Cobros" value={cashFlow.collections} currency={currency} />
              <CashRow label="Otros ingresos" value={cashFlow.otherIncome} currency={currency} />
              <div className="border-t border-[var(--admin-border)] pt-2">
                <CashRow label="Total ingresos" value={totalIncome} currency={currency} bold />
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
            <h3 className="mb-3 text-sm font-black uppercase tracking-wider text-[var(--admin-muted)]">Egresos</h3>
            <div className="space-y-2">
              <CashRow label="Proveedores" value={cashFlow.suppliers} currency={currency} />
              <CashRow label="Gastos" value={cashFlow.expenses} currency={currency} />
              <CashRow label="Otros egresos" value={cashFlow.otherExpenses} currency={currency} />
              <CashRow label="Transferencias" value={cashFlow.transfers} currency={currency} />
              <div className="border-t border-[var(--admin-border)] pt-2">
                <CashRow label="Total egresos" value={totalExpenses} currency={currency} bold />
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl shadow-black/10">
          <div className="border-b border-[var(--admin-border)] px-5 py-4">
            <h2 className="text-lg font-black">Detalle del período</h2>
            <p className="text-xs text-[var(--admin-muted)]">
              {dateLabel(cashFlow.startDate)} — {dateLabel(cashFlow.endDate)}
            </p>
          </div>
          <DataTable
            columns={[
              { key: "fecha", label: "Fecha" },
              { key: "cuenta", label: "Cuenta" },
              { key: "tipo", label: "Tipo" },
              { key: "categoria", label: "Categoría" },
              { key: "direccion", label: "Dirección" },
              { key: "importe", label: "Importe", align: "right" },
            ]}
            data={useMemo(() => cashFlow.details.map((detail) => ({
              id: detail.id,
              fecha: dateLabel(detail.date),
              cuenta: <span className="font-medium">{detail.accountName}</span>,
              tipo: <span className="capitalize">{detail.type}</span>,
              categoria: detail.category,
              direccion: (
                <StatusBadge
                  status={detail.direction === "in" ? "Ingreso" : "Egreso"}
                  tone={detail.direction === "in" ? "success" : "danger"}
                />
              ),
              importe: (
                <span className={`text-right font-black tabular-nums block ${detail.direction === "in" ? "text-emerald-300" : "text-rose-300"}`}>
                  {money(detail.amount, currency)}
                </span>
              ),
            })), [cashFlow.details, currency])}
            keyExtractor={(row) => row.id as number}
            emptyMessage="No hay movimientos en este período"
            density="compact"
          />
        </div>
      </div>
    </div>
  );
}

function CashRow({
  label,
  value,
  currency,
  bold,
}: { label: string; value: number; currency: string; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${bold ? "font-black" : ""}`}>
      <span className="text-sm text-[var(--admin-muted)]">{label}</span>
      <span className={`tabular-nums ${value >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
        {money(value, currency)}
      </span>
    </div>
  );
}
