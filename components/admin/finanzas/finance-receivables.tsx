"use client";

import { useCallback, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { scopedFetch } from "@/lib/client-routing";

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

  return (
    <div>
      <div className="mb-4">
        <p className="section-eyebrow">Finanzas</p>
        <h1 className="text-2xl font-black tracking-tight">Cuentas a cobrar</h1>
        <p className="mt-1 text-sm text-[var(--admin-muted)]">
          Documentos pendientes de cobro a clientes
        </p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <AgingCard label="Al día" value={money(aging.current, currency)} tone="text-emerald-300" />
        <AgingCard label="1-30 días" value={money(aging.days1to30, currency)} tone="text-amber-300" />
        <AgingCard label="31-60 días" value={money(aging.days31to60, currency)} tone="text-orange-300" />
        <AgingCard label="61-90 días" value={money(aging.days61to90, currency)} tone="text-rose-300" />
        <AgingCard label="+90 días" value={money(aging.daysOver90, currency)} tone="text-red-300" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-2.5">
        <select
          className="input w-auto"
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
          className="btn btn-secondary"
          onClick={loadDocuments}
          disabled={busy}
        >
          Filtrar
        </button>
        <span className="ml-auto text-sm text-[var(--admin-muted)]">{filtered.length} resultados</span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl shadow-black/10">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--admin-border)] bg-white/[0.02] text-xs uppercase tracking-wider text-[var(--admin-muted)]">
                <th className="px-5 py-3 font-bold">Documento</th>
                <th className="px-5 py-3 font-bold">Cliente</th>
                <th className="px-5 py-3 font-bold">Fecha</th>
                <th className="px-5 py-3 font-bold">Vencimiento</th>
                <th className="px-5 py-3 font-bold text-right">Original</th>
                <th className="px-5 py-3 font-bold text-right">Pagado</th>
                <th className="px-5 py-3 font-bold text-right">Pendiente</th>
                <th className="px-5 py-3 font-bold">Estado</th>
                <th className="px-5 py-3 font-bold">Vencimiento</th>
                <th className="px-5 py-3 font-bold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--admin-border)]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-5 py-12 text-center text-[var(--admin-muted)]">
                    No hay documentos registrados
                  </td>
                </tr>
              ) : (
                filtered.map((doc) => (
                  <tr key={doc.id} className="hover:bg-white/[0.02]">
                    <td className="px-5 py-3 font-medium">{doc.number}</td>
                    <td className="px-5 py-3">{doc.customerName}</td>
                    <td className="px-5 py-3">{dateLabel(doc.documentDate)}</td>
                    <td className="px-5 py-3">{dateLabel(doc.dueDate)}</td>
                    <td className="px-5 py-3 text-right">{money(doc.originalAmount, currency)}</td>
                    <td className="px-5 py-3 text-right text-emerald-300">{money(doc.paidAmount, currency)}</td>
                    <td className="px-5 py-3 text-right font-black tabular-nums">{money(doc.pendingAmount, currency)}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          doc.status === "paid"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : doc.status === "cancelled"
                              ? "bg-zinc-500/15 text-zinc-300"
                              : doc.daysOverdue > 0
                                ? "bg-rose-500/15 text-rose-300"
                                : "bg-amber-500/15 text-amber-300"
                        }`}
                      >
                        {statusLabel(doc.status)}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {doc.daysOverdue > 0 ? (
                        <span className="text-rose-300">{doc.daysOverdue} días</span>
                      ) : (
                        <span className="text-[var(--admin-muted)]">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end">
                        {doc.status !== "paid" && doc.status !== "cancelled" && (
                          <button
                            type="button"
                            className="btn btn-secondary py-1 text-xs"
                            onClick={() => registerPayment(doc)}
                            disabled={busy}
                          >
                            Cobrar
                          </button>
                        )}
                      </div>
                    </td>
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

function AgingCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--admin-muted)]">{label}</p>
      <p className={`mt-1 truncate text-lg font-black tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}
