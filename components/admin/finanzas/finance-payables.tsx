"use client";

import { useCallback, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { scopedFetch } from "@/lib/client-routing";
import { PageHeader, KpiCard, DataTable, StatusBadge, ActionMenu, FiltersBar, ActiveFilterChip } from "@/components/admin/ui";

export type PayablesInitial = {
  tenantId: number;
  currency: string;
  activeBranchId: number | null;
  items: Array<{
    id: number;
    supplierName: string;
    documentNumber?: string | null;
    type: string;
    date: string;
    dueDate?: string | null;
    originalAmount: number;
    appliedAmount: number;
    remainingAmount: number;
    currency: string;
    status: string;
    daysOverdue: number;
    branchId?: number | null;
  }>;
  aging: {
    current: number;
    days1to30: number;
    days31to60: number;
    days61to90: number;
    daysOver90: number;
    total: number;
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

const STATUS_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "open", label: "Abierto" },
  { value: "partially_paid", label: "Parcial" },
  { value: "paid", label: "Pagado" },
  { value: "cancelled", label: "Cancelado" },
];

/** @summary Gestor de cuentas a pagar. */
export function FinancePayablesClient({ initial }: { initial: PayablesInitial }) {
  const [items, setItems] = useState(initial.items);
  const [aging] = useState(initial.aging);
  const [statusFilter, setStatusFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const currency = initial.currency ?? "ARS";

  const filtered = useMemo(() => {
    if (!statusFilter) return items;
    return items.filter((item) => item.status === statusFilter);
  }, [items, statusFilter]);

  const loadItems = useCallback(async () => {
    setBusy(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (initial.activeBranchId) params.set("branchId", String(initial.activeBranchId));
      const data = await api<{ items: PayablesInitial["items"]; aging: PayablesInitial["aging"] }>(
        `/api/admin/finanzas/cuentas-pagar?${params.toString()}&aging=1`,
      );
      setItems(data.items);
    } catch (reason) {
      await Swal.fire({
        title: "Error",
        text: reason instanceof Error ? reason.message : "No se pudieron cargar las cuentas a pagar",
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
    } finally {
      setBusy(false);
    }
  }, [statusFilter, initial.activeBranchId]);

  const registerPayment = useCallback(
    async (item: PayablesInitial["items"][number]) => {
      const result = await Swal.fire({
        title: "Registrar pago",
        html: `
          <div class="text-left space-y-3">
            <p class="text-sm text-zinc-400">Proveedor: <strong class="text-white">${item.supplierName}</strong></p>
            <p class="text-sm text-zinc-400">Documento: <strong class="text-white">${item.documentNumber || "—"}</strong></p>
            <p class="text-sm text-zinc-400">Restante: <strong class="text-rose-300">${money(item.remainingAmount, currency)}</strong></p>
            <div>
              <label class="block text-sm font-bold text-zinc-400 mb-1">Monto a pagar</label>
              <input id="pp-amount" type="number" step="0.01" max="${item.remainingAmount}" class="w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-white" />
            </div>
            <div>
              <label class="block text-sm font-bold text-zinc-400 mb-1">Método</label>
              <select id="pp-method" class="w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-white">
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="otro">Otro</option>
              </select>
            </div>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: "Registrar pago",
        cancelButtonText: "Cancelar",
        background: "#18181b",
        color: "#fafafa",
        preConfirm: () => {
          const amount = Number((document.getElementById("pp-amount") as HTMLInputElement)?.value);
          const method = (document.getElementById("pp-method") as HTMLSelectElement)?.value;
          if (!amount || amount <= 0) {
            Swal.showValidationMessage("Ingresá un monto válido");
            return false;
          }
          return { amount, method };
        },
      });

      if (result.isConfirmed && result.value) {
        await Swal.fire({
          title: "Pago registrado",
          text: "El pago se ha registrado correctamente",
          icon: "success",
          background: "#18181b",
          color: "#fafafa",
          timer: 1500,
          showConfirmButton: false,
        });
      }
    },
    [currency],
  );

  const statusLabel = (status: string) => {
    const labels: Record<string, string> = {
      open: "Abierto",
      partially_paid: "Parcial",
      paid: "Pagado",
      cancelled: "Cancelado",
    };
    return labels[status] || status;
  };

  const activeFilterCount = useMemo(() => (statusFilter ? 1 : 0), [statusFilter]);

  return (
    <div>
      <PageHeader
        section="Finanzas"
        title="Cuentas a pagar"
        description="Obligaciones pendientes con proveedores"
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard label="Al día" value={money(aging.current, currency)} tone="text-emerald-300" />
        <KpiCard label="1-30 días" value={money(aging.days1to30, currency)} tone="text-amber-300" />
        <KpiCard label="31-60 días" value={money(aging.days31to60, currency)} tone="text-orange-300" />
        <KpiCard label="61-90 días" value={money(aging.days61to90, currency)} tone="text-rose-300" />
        <KpiCard label="+90 días" value={money(aging.daysOver90, currency)} tone="text-red-300" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FiltersBar title="Filtros" activeCount={activeFilterCount} onClear={() => { setStatusFilter(""); loadItems(); }}>
          <div className="space-y-3">
            <select
              className="input w-full"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filtrar por estado"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-secondary w-full"
              onClick={loadItems}
              disabled={busy}
            >
              Filtrar
            </button>
          </div>
        </FiltersBar>
        {statusFilter && (
          <ActiveFilterChip
            label={`Estado: ${STATUS_OPTIONS.find((s) => s.value === statusFilter)?.label ?? statusFilter}`}
            onRemove={() => { setStatusFilter(""); loadItems(); }}
          />
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl shadow-black/10">
        <DataTable
          columns={[
            { key: "proveedor", label: "Proveedor" },
            { key: "documento", label: "Documento" },
            { key: "fecha", label: "Fecha" },
            { key: "vencimiento", label: "Vencimiento" },
            { key: "original", label: "Original", align: "right" },
            { key: "aplicado", label: "Aplicado", align: "right" },
            { key: "restante", label: "Restante", align: "right" },
            { key: "estado", label: "Estado" },
            { key: "diasVencimiento", label: "Vencimiento" },
            { key: "acciones", label: "Acciones", align: "right" },
          ]}
          data={useMemo(() => filtered.map((item) => ({
            id: item.id,
            proveedor: item.supplierName,
            documento: item.documentNumber || "—",
            fecha: dateLabel(item.date),
            vencimiento: dateLabel(item.dueDate),
            original: money(item.originalAmount, item.currency),
            aplicado: <span className="text-emerald-300">{money(item.appliedAmount, item.currency)}</span>,
            restante: <span className="font-black tabular-nums">{money(item.remainingAmount, item.currency)}</span>,
            estado: (
              <StatusBadge
                status={statusLabel(item.status)}
                tone={
                  item.status === "paid" ? "success" : item.status === "cancelled" ? "danger" : item.daysOverdue > 0 ? "danger" : "warning"
                }
              />
            ),
            diasVencimiento: item.daysOverdue > 0 ? <span className="text-rose-300">{item.daysOverdue} días</span> : <span className="text-[var(--admin-muted)]">—</span>,
            acciones: (
              item.status !== "paid" && item.status !== "cancelled" ? (
                <ActionMenu
                  align="right"
                  items={[
                    { label: "Pagar", onClick: () => registerPayment(item), tone: "primary" },
                  ]}
                />
              ) : null
            ),
          })), [filtered, registerPayment])}
          keyExtractor={(row) => row.id as number}
          emptyMessage="No hay cuentas a pagar registradas"
          density="normal"
        />
      </div>
    </div>
  );
}
