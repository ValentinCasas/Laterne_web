"use client";

import { useCallback, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { scopedFetch } from "@/lib/client-routing";
import { PageHeader, KpiCard, DataTable, StatusBadge, ActionMenu, FiltersBar, ActiveFilterChip } from "@/components/admin/ui";
import { money, dateLabel } from "@/lib/finance-helpers";

export type ReceivablesInitial = {
  tenantId: number;
  currency: string;
  activeBranchId: number | null;
  documents: Array<{
    id: number;
    number: string;
    customerName: string;
    orderNumber?: string | null;
    documentDate: string;
    dueDate: string;
    originalAmount: number;
    paidAmount: number;
    pendingAmount: number;
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

const STATUS_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "open", label: "Abierto" },
  { value: "partially_paid", label: "Parcial" },
  { value: "paid", label: "Pagado" },
  { value: "cancelled", label: "Cancelado" },
];

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

/** @summary Gestor de cuentas a cobrar. */
export function FinanceReceivablesClient({ initial }: { initial: ReceivablesInitial }) {
  const [documents, setDocuments] = useState(initial.documents);
  const [aging] = useState(initial.aging);
  const [statusFilter, setStatusFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const currency = initial.currency ?? "ARS";

  const filtered = useMemo(() => {
    if (!statusFilter) return documents;
    return documents.filter((doc) => doc.status === statusFilter);
  }, [documents, statusFilter]);

  const loadDocuments = useCallback(async () => {
    setBusy(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (initial.activeBranchId) params.set("branchId", String(initial.activeBranchId));
      const data = await api<{ items: ReceivablesInitial["documents"]; aging: ReceivablesInitial["aging"] }>(
        `/api/admin/finanzas/cuentas-cobrar?${params.toString()}&aging=1`,
      );
      setDocuments(data.items);
    } catch (reason) {
      await Swal.fire({
        title: "Error",
        text: reason instanceof Error ? reason.message : "No se pudieron cargar los documentos",
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
    } finally {
      setBusy(false);
    }
  }, [statusFilter, initial.activeBranchId]);

  const registerPayment = useCallback(
    async (document: ReceivablesInitial["documents"][number]) => {
      const result = await Swal.fire({
        title: "Registrar cobro",
        html: `
          <div class="text-left space-y-3">
            <p class="text-sm text-zinc-400">Documento: <strong class="text-white">${document.number}</strong></p>
            <p class="text-sm text-zinc-400">Cliente: <strong class="text-white">${document.customerName}</strong></p>
            <p class="text-sm text-zinc-400">Pendiente: <strong class="text-emerald-300">${money(document.pendingAmount, currency)}</strong></p>
            <div>
              <label class="block text-sm font-bold text-zinc-400 mb-1">Monto a cobrar</label>
              <input id="rp-amount" type="number" step="0.01" max="${document.pendingAmount}" class="w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-white" />
            </div>
            <div>
              <label class="block text-sm font-bold text-zinc-400 mb-1">Método</label>
              <select id="rp-method" class="w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-white">
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="otro">Otro</option>
              </select>
            </div>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: "Registrar cobro",
        cancelButtonText: "Cancelar",
        background: "#18181b",
        color: "#fafafa",
        preConfirm: () => {
          const amount = Number((window.document.getElementById("rp-amount") as HTMLInputElement | null)?.value);
          const method = (window.document.getElementById("rp-method") as HTMLSelectElement | null)?.value;
          if (!amount || amount <= 0) {
            Swal.showValidationMessage("Ingresá un monto válido");
            return false;
          }
          return { amount, method };
        },
      });

      if (result.isConfirmed && result.value) {
        setBusy(true);
        try {
          await api("/api/admin/finanzas/cuentas-cobrar", {
            method: "POST",
            body: JSON.stringify({
              documentId: document.id,
              amount: result.value.amount,
              method: result.value.method,
            }),
          });
          await loadDocuments();
          await Swal.fire({
            title: "Cobro registrado",
            icon: "success",
            background: "#18181b",
            color: "#fafafa",
            timer: 1500,
            showConfirmButton: false,
          });
        } catch (reason) {
          await Swal.fire({
            title: "Error",
            text: reason instanceof Error ? reason.message : "No se pudo registrar el cobro",
            icon: "error",
            background: "#18181b",
            color: "#fafafa",
          });
        } finally {
          setBusy(false);
        }
      }
    },
    [currency, loadDocuments],
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
        title="Cuentas a cobrar"
        description="Documentos pendientes de cobro a clientes"
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard label="Al día" value={money(aging.current, currency)} tone="text-emerald-300" />
        <KpiCard label="1-30 días" value={money(aging.days1to30, currency)} tone="text-amber-300" />
        <KpiCard label="31-60 días" value={money(aging.days31to60, currency)} tone="text-orange-300" />
        <KpiCard label="61-90 días" value={money(aging.days61to90, currency)} tone="text-rose-300" />
        <KpiCard label="+90 días" value={money(aging.daysOver90, currency)} tone="text-red-300" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FiltersBar title="Filtros" activeCount={activeFilterCount} onClear={() => { setStatusFilter(""); loadDocuments(); }}>
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
              onClick={loadDocuments}
              disabled={busy}
            >
              Filtrar
            </button>
          </div>
        </FiltersBar>
        {statusFilter && (
          <ActiveFilterChip
            label={`Estado: ${STATUS_OPTIONS.find((s) => s.value === statusFilter)?.label ?? statusFilter}`}
            onRemove={() => { setStatusFilter(""); loadDocuments(); }}
          />
        )}
      </div>

      <div className="shadow-xl shadow-black/10">
        <DataTable
          viewStorageKey="cuentas-a-cobrar"
          columns={[
            { key: "documento", label: "Documento" },
            { key: "cliente", label: "Cliente" },
            { key: "fecha", label: "Fecha" },
            { key: "vencimiento", label: "Vencimiento" },
            { key: "original", label: "Original", align: "right" },
            { key: "pagado", label: "Pagado", align: "right" },
            { key: "pendiente", label: "Pendiente", align: "right" },
            { key: "estado", label: "Estado" },
            { key: "diasVencimiento", label: "Vencimiento" },
            { key: "acciones", label: "Acciones", align: "right" },
          ]}
          data={useMemo(() => filtered.map((doc) => ({
            id: doc.id,
            documento: <span className="font-medium">{doc.number}</span>,
            cliente: doc.customerName,
            fecha: dateLabel(doc.documentDate),
            vencimiento: dateLabel(doc.dueDate),
            original: money(doc.originalAmount, currency),
            pagado: <span className="text-emerald-300">{money(doc.paidAmount, currency)}</span>,
            pendiente: <span className="font-black tabular-nums">{money(doc.pendingAmount, currency)}</span>,
            estado: (
              <StatusBadge
                status={statusLabel(doc.status)}
                tone={
                  doc.status === "paid" ? "success" : doc.status === "cancelled" ? "danger" : doc.daysOverdue > 0 ? "danger" : "warning"
                }
              />
            ),
            diasVencimiento: doc.daysOverdue > 0 ? <span className="text-rose-300">{doc.daysOverdue} días</span> : <span className="text-[var(--admin-muted)]">—</span>,
            acciones: (
              doc.status !== "paid" && doc.status !== "cancelled" ? (
                <ActionMenu
                  align="right"
                  items={[
                    { label: "Cobrar", onClick: () => registerPayment(doc), tone: "primary" },
                  ]}
                />
              ) : null
            ),
          })), [filtered, currency, registerPayment])}
          keyExtractor={(row) => row.id as number}
          emptyMessage="No hay cuentas a cobrar registradas"
          density="normal"
        />
      </div>
    </div>
  );
}
