"use client";

import { useMemo, useState } from "react";
import Swal from "sweetalert2";
import { scopedFetch } from "@/lib/client-routing";

/**
 * Ficha detallada de proveedor con cuenta corriente, sucursales y ledger.
 */

export type Supplier = {
  id: number;
  code?: string | null;
  name: string;
  taxId?: string | null;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  paymentTerms?: string | null;
  currency?: string | null;
  status: string;
  category?: string | null;
  creditLimit?: number | null;
  currentBalance?: number | null;
  blockedAt?: string | null;
  blockedReason?: string | null;
  notes?: string | null;
  branches?: Array<{ branch: { id: number; name: string } }>;
};

type LedgerEntry = {
  id: number;
  type: string;
  documentNumber?: string | null;
  originalAmount: number;
  appliedAmount: number;
  remainingAmount: number;
  currency: string;
  dueDate?: string | null;
  paidAt?: string | null;
  status: string;
  notes?: string | null;
  createdAt: string;
  createdBy?: { name: string } | null;
};

type Statement = {
  supplier: { id: number; name: string; currency: string; currentBalance: number };
  balance: number;
  overdue: number;
  upcoming: Array<{ id: number; documentNumber?: string | null; type: string; originalAmount: number; appliedAmount: number; remainingAmount: number; dueDate?: string | null }>;
  recent: LedgerEntry[];
};

type BranchOption = { id: number; name: string };

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-300",
  blocked: "bg-rose-500/15 text-rose-300",
  suspended: "bg-amber-500/15 text-amber-300",
};

const TYPE_LABELS: Record<string, string> = {
  purchase_order: "Pedido",
  purchase_receipt: "Recepción",
  purchase_invoice: "Factura",
  expense: "Gasto",
  payment: "Pago",
  credit_note: "Nota de crédito",
  adjustment: "Ajuste",
  return: "Devolución",
};

/** @summary Formatea importe con moneda. */
function money(value: number, currency: string) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}

/** @summary Formatea fecha ISO. */
function dateLabel(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

/** @summary Petición API. */
async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await scopedFetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body?.error ?? "No se pudo completar la operación");
  return body;
}

/** @summary Error en panel. */
async function showError(title: string, reason: unknown) {
  await Swal.fire({
    title,
    text: reason instanceof Error ? reason.message : "Intentá nuevamente.",
    icon: "error",
    background: "#18181b",
    color: "#fafafa",
  });
}

/** @summary Ficha de proveedor. */
export function SupplierDetailModal({
  supplier,
  branches,
  onClose,
  onUpdated,
}: {
  supplier: Supplier;
  branches: BranchOption[];
  onClose: () => void;
  onUpdated: (updated: Supplier) => Promise<void>;
}) {
  const [statement, setStatement] = useState<Statement | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"resumen" | "sucursales" | "ledger">("resumen");
  const [applyingPayment, setApplyingPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [selectedEntries, setSelectedEntries] = useState<Set<number>>(new Set());
  const [ledgerFilter, setLedgerFilter] = useState<string>("all");

  const openEntries = useMemo(() => ledger.filter((e) => e.status === "open" && e.remainingAmount > 0), [ledger]);
  const totalSelected = useMemo(() => openEntries.filter((e) => selectedEntries.has(e.id)).reduce((sum, e) => sum + e.remainingAmount, 0), [openEntries, selectedEntries]);

  /** @summary Aplica un pago a las partidas seleccionadas. */
  async function applyPayment() {
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      await Swal.fire({ title: "Ingresá un monto válido", icon: "warning", background: "#18181b", color: "#fafafa" });
      return;
    }
    const entries = openEntries.filter((e) => selectedEntries.has(e.id));
    if (!entries.length) {
      await Swal.fire({ title: "Seleccioná al menos una partida", icon: "warning", background: "#18181b", color: "#fafafa" });
      return;
    }

    setSaving(true);
    try {
      await api(`/api/admin/compras/proveedores/${supplier.id}/apply-payment`, {
        method: "POST",
        body: JSON.stringify({
          amount,
          entryIds: entries.map((e) => e.id),
          method: "transferencia",
          notes: `Aplicación manual desde ficha de proveedor`,
        }),
      });
      await Swal.fire({ title: "Pago aplicado correctamente", icon: "success", timer: 1500, showConfirmButton: false, background: "#18181b", color: "#fafafa" });
      setPaymentAmount("");
      setSelectedEntries(new Set());
      setApplyingPayment(false);
      const newStatement = await api<Statement>(`/api/admin/compras/proveedores/${supplier.id}/statement`);
      setStatement(newStatement);
      const newLedger = await api<{ items: LedgerEntry[] }>(`/api/admin/compras/proveedores/${supplier.id}/ledger?limit=50`);
      setLedger(newLedger.items);
    } catch (reason) {
      await showError("No se pudo aplicar el pago", reason);
    } finally {
      setSaving(false);
    }
  }

  /** @summary Revierte una entrada del ledger. */
  async function reverseEntry(entry: LedgerEntry) {
    const result = await Swal.fire({
      title: "¿Revertir movimiento?",
      text: `Se creará una reversión para ${entry.documentNumber ?? "este movimiento"}`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Revertir",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ef4444",
      background: "#18181b",
      color: "#fafafa",
      reverseButtons: true,
    });
    if (!result.isConfirmed) return;
    setSaving(true);
    try {
      await api(`/api/admin/compras/proveedores/${supplier.id}/ledger/${entry.id}/reverse`, { method: "POST" });
      await Swal.fire({ title: "Movimiento revertido", icon: "success", timer: 1500, showConfirmButton: false, background: "#18181b", color: "#fafafa" });
      const newStatement = await api<Statement>(`/api/admin/compras/proveedores/${supplier.id}/statement`);
      setStatement(newStatement);
      const newLedger = await api<{ items: LedgerEntry[] }>(`/api/admin/compras/proveedores/${supplier.id}/ledger?limit=50`);
      setLedger(newLedger.items);
    } catch (reason) {
      await showError("No se pudo revertir", reason);
    } finally {
      setSaving(false);
    }
  }

  useState(() => {
    api<Statement>(`/api/admin/compras/proveedores/${supplier.id}/statement`).then(setStatement).catch(() => {});
    api<{ items: LedgerEntry[] }>(`/api/admin/compras/proveedores/${supplier.id}/ledger?limit=50`)
      .then((result) => setLedger(result.items))
      .catch(() => {});
  });

  const selectedBranchIds = useMemo(() => new Set(supplier.branches?.map((b) => b.branch.id) ?? []), [supplier.branches]);

  /** @summary Guarda cambios del proveedor. */
  async function save() {
    setSaving(true);
    try {
      const updated = await api<{ item: Supplier }>(`/api/admin/compras/proveedores/${supplier.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: supplier.name,
          code: supplier.code,
          taxId: supplier.taxId,
          contactName: supplier.contactName,
          phone: supplier.phone,
          email: supplier.email,
          address: supplier.address,
          paymentTerms: supplier.paymentTerms,
          currency: supplier.currency,
          status: supplier.status,
          category: supplier.category,
          creditLimit: supplier.creditLimit,
          blockedAt: supplier.blockedAt,
          blockedReason: supplier.blockedReason,
          notes: supplier.notes,
          active: supplier.status !== "blocked",
          branchIds: Array.from(selectedBranchIds),
        }),
      });
      setEditing(false);
      await onUpdated(updated.item);
      const newStatement = await api<Statement>(`/api/admin/compras/proveedores/${supplier.id}/statement`);
      setStatement(newStatement);
    } catch (reason) {
      await showError("No se pudo guardar", reason);
    } finally {
      setSaving(false);
    }
  }

  if (!statement) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
        <div className="flex h-full w-full flex-col overflow-hidden rounded-none border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-2xl sm:h-auto sm:max-w-2xl sm:rounded-[1.5rem]">
          <div className="flex items-center justify-between border-b border-[var(--admin-border)] px-5 py-4">
            <h2 className="text-xl font-black">{supplier.name}</h2>
            <button onClick={onClose} className="btn btn-secondary" type="button">✕ Cerrar</button>
          </div>
          <div className="flex-1 overflow-y-auto p-5 text-center text-[var(--admin-muted)]">Cargando…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-0 backdrop-blur-sm sm:p-4">
      <div className="flex h-full w-full flex-col overflow-hidden rounded-none border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-2xl sm:h-auto sm:max-w-4xl sm:rounded-[1.5rem]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-border)] px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black">{supplier.code ? `${supplier.code} · ` : ""}{supplier.name}</h2>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${STATUS_COLORS[supplier.status] ?? STATUS_COLORS.active}`}>
                {supplier.status === "active" ? "Activo" : supplier.status === "blocked" ? "Bloqueado" : "Suspendido"}
              </span>
            </div>
            <p className="text-sm text-[var(--admin-muted)]">
              {supplier.category ?? "Sin categoría"} · {supplier.contactName ?? "Sin contacto"} · {supplier.paymentTerms ?? "Sin condiciones"}
            </p>
          </div>
          <button onClick={onClose} className="btn btn-secondary" type="button">✕ Cerrar</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {/* KPIs */}
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-[var(--admin-border)] bg-white/[0.02] p-3">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--admin-muted)]">Saldo</p>
              <p className={`mt-1 truncate text-lg font-black tabular-nums ${statement.balance > 0 ? "text-amber-300" : "text-emerald-300"}`}>
                {money(statement.balance, statement.supplier.currency)}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--admin-border)] bg-white/[0.02] p-3">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--admin-muted)]">Vencido</p>
              <p className="mt-1 truncate text-lg font-black tabular-nums text-rose-300">{money(statement.overdue, statement.supplier.currency)}</p>
            </div>
            <div className="rounded-2xl border border-[var(--admin-border)] bg-white/[0.02] p-3">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--admin-muted)]">Próximos 30 días</p>
              <p className="mt-1 truncate text-lg font-black tabular-nums text-sky-300">
                {money(statement.upcoming.reduce((sum, item) => sum + item.remainingAmount, 0), statement.supplier.currency)}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--admin-border)] bg-white/[0.02] p-3">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--admin-muted)]">Límite de crédito</p>
              <p className="mt-1 truncate text-lg font-black tabular-nums">{money(supplier.creditLimit ?? 0, statement.supplier.currency)}</p>
            </div>
          </div>

          {/* Pestañas */}
          <div className="mb-4 flex flex-wrap gap-1 rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-1">
            {(["resumen", "sucursales", "ledger"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                  activeTab === tab ? "bg-pink-500 text-white" : "text-[var(--admin-muted)] hover:bg-white/5"
                }`}
              >
                {tab === "resumen" ? "Resumen" : tab === "sucursales" ? "Sucursales" : "Historial"}
              </button>
            ))}
          </div>

          {activeTab === "resumen" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[var(--admin-border)] bg-white/[0.02] p-4">
                <h3 className="mb-2 text-sm font-black uppercase tracking-widest text-[var(--admin-muted)]">Datos del proveedor</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {editing ? (
                    <>
                      <label className="block">
                        <span className="field-label">Nombre</span>
                        <input className="input w-full" value={supplier.name} onChange={(e) => onUpdated({ ...supplier, name: e.target.value }).catch(() => {})} />
                      </label>
                      <label className="block">
                        <span className="field-label">Código</span>
                        <input className="input w-full" value={supplier.code ?? ""} onChange={(e) => onUpdated({ ...supplier, code: e.target.value }).catch(() => {})} />
                      </label>
                      <label className="block">
                        <span className="field-label">CUIT</span>
                        <input className="input w-full" value={supplier.taxId ?? ""} onChange={(e) => onUpdated({ ...supplier, taxId: e.target.value }).catch(() => {})} />
                      </label>
                      <label className="block">
                        <span className="field-label">Contacto</span>
                        <input className="input w-full" value={supplier.contactName ?? ""} onChange={(e) => onUpdated({ ...supplier, contactName: e.target.value }).catch(() => {})} />
                      </label>
                      <label className="block">
                        <span className="field-label">Email</span>
                        <input className="input w-full" value={supplier.email ?? ""} onChange={(e) => onUpdated({ ...supplier, email: e.target.value }).catch(() => {})} />
                      </label>
                      <label className="block">
                        <span className="field-label">Teléfono</span>
                        <input className="input w-full" value={supplier.phone ?? ""} onChange={(e) => onUpdated({ ...supplier, phone: e.target.value }).catch(() => {})} />
                      </label>
                      <label className="block sm:col-span-2">
                        <span className="field-label">Dirección</span>
                        <input className="input w-full" value={supplier.address ?? ""} onChange={(e) => onUpdated({ ...supplier, address: e.target.value }).catch(() => {})} />
                      </label>
                      <label className="block">
                        <span className="field-label">Condiciones de pago</span>
                        <input className="input w-full" value={supplier.paymentTerms ?? ""} onChange={(e) => onUpdated({ ...supplier, paymentTerms: e.target.value }).catch(() => {})} />
                      </label>
                      <label className="block">
                        <span className="field-label">Moneda</span>
                        <input className="input w-full" value={supplier.currency ?? "ARS"} onChange={(e) => onUpdated({ ...supplier, currency: e.target.value }).catch(() => {})} />
                      </label>
                      <label className="block">
                        <span className="field-label">Categoría</span>
                        <input className="input w-full" value={supplier.category ?? ""} onChange={(e) => onUpdated({ ...supplier, category: e.target.value }).catch(() => {})} />
                      </label>
                      <label className="block">
                        <span className="field-label">Límite de crédito</span>
                        <input className="input w-full" type="number" value={supplier.creditLimit ?? ""} onChange={(e) => onUpdated({ ...supplier, creditLimit: e.target.value ? Number(e.target.value) : null }).catch(() => {})} />
                      </label>
                    </>
                  ) : (
                    <>
                      <div className="text-sm"><span className="text-[var(--admin-muted)]">Nombre</span><p className="font-bold">{supplier.name}</p></div>
                      <div className="text-sm"><span className="text-[var(--admin-muted)]">Código</span><p className="font-bold">{supplier.code ?? "—"}</p></div>
                      <div className="text-sm"><span className="text-[var(--admin-muted)]">CUIT</span><p className="font-bold">{supplier.taxId ?? "—"}</p></div>
                      <div className="text-sm"><span className="text-[var(--admin-muted)]">Contacto</span><p className="font-bold">{supplier.contactName ?? "—"}</p></div>
                      <div className="text-sm"><span className="text-[var(--admin-muted)]">Email</span><p className="font-bold">{supplier.email ?? "—"}</p></div>
                      <div className="text-sm"><span className="text-[var(--admin-muted)]">Teléfono</span><p className="font-bold">{supplier.phone ?? "—"}</p></div>
                      <div className="text-sm sm:col-span-2"><span className="text-[var(--admin-muted)]">Dirección</span><p className="font-bold">{supplier.address ?? "—"}</p></div>
                      <div className="text-sm"><span className="text-[var(--admin-muted)]">Condiciones</span><p className="font-bold">{supplier.paymentTerms ?? "—"}</p></div>
                      <div className="text-sm"><span className="text-[var(--admin-muted)]">Moneda</span><p className="font-bold">{supplier.currency ?? "ARS"}</p></div>
                      <div className="text-sm"><span className="text-[var(--admin-muted)]">Categoría</span><p className="font-bold">{supplier.category ?? "—"}</p></div>
                      <div className="text-sm"><span className="text-[var(--admin-muted)]">Límite de crédito</span><p className="font-bold">{money(supplier.creditLimit ?? 0, statement.supplier.currency)}</p></div>
                    </>
                  )}
                </div>
                {!editing && (
                  <button type="button" className="mt-3 text-sm font-bold text-pink-300 hover:underline" onClick={() => setEditing(true)}>
                    ✎ Editar datos
                  </button>
                )}
              </div>

              {/* Próximos vencimientos */}
              {statement.upcoming.length > 0 && (
                <div className="rounded-2xl border border-[var(--admin-border)] bg-white/[0.02] p-4">
                  <h3 className="mb-2 text-sm font-black uppercase tracking-widest text-[var(--admin-muted)]">Próximos vencimientos</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-[var(--admin-border)] text-xs uppercase tracking-wider text-[var(--admin-muted)]">
                          <th className="px-4 py-2">Documento</th>
                          <th className="px-4 py-2">Tipo</th>
                          <th className="px-4 py-2 text-right">Original</th>
                          <th className="px-4 py-2 text-right">Aplicado</th>
                          <th className="px-4 py-2 text-right">Restante</th>
                          <th className="px-4 py-2">Vence</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--admin-border)]/70">
                        {statement.upcoming.map((item) => (
                          <tr key={item.id}>
                            <td className="px-4 py-2 font-semibold">{item.documentNumber ?? "—"}</td>
                            <td className="px-4 py-2 text-xs text-[var(--admin-muted)]">{TYPE_LABELS[item.type] ?? item.type}</td>
                            <td className="px-4 py-2 text-right tabular-nums">{money(item.originalAmount, statement.supplier.currency)}</td>
                            <td className="px-4 py-2 text-right tabular-nums">{money(item.appliedAmount, statement.supplier.currency)}</td>
                            <td className="px-4 py-2 text-right font-bold tabular-nums text-amber-300">{money(item.remainingAmount, statement.supplier.currency)}</td>
                            <td className="px-4 py-2 text-xs text-[var(--admin-muted)]">{dateLabel(item.dueDate)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "sucursales" && (
            <div className="rounded-2xl border border-[var(--admin-border)] bg-white/[0.02] p-4">
              <h3 className="mb-2 text-sm font-black uppercase tracking-widest text-[var(--admin-muted)]">Sucursales habilitadas</h3>
              <div className="flex flex-wrap gap-2">
                {branches.map((branch) => {
                  const enabled = selectedBranchIds.has(branch.id);
                  return (
                    <button
                      key={branch.id}
                      type="button"
                      onClick={() => {
                        const next = new Set(selectedBranchIds);
                        if (next.has(branch.id)) next.delete(branch.id); else next.add(branch.id);
                        onUpdated({ ...supplier, branches: Array.from(next).map((id) => ({ branch: { id, name: branches.find((b) => b.id === id)!.name } })) }).catch(() => {});
                      }}
                      className={`rounded-xl border px-3 py-2 text-sm font-bold transition-colors ${
                        enabled ? "border-pink-500/40 bg-pink-500/10 text-pink-300" : "border-[var(--admin-border)] text-[var(--admin-muted)] hover:bg-white/5"
                      }`}
                    >
                      {branch.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === "ledger" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-black uppercase tracking-widest text-[var(--admin-muted)]">Historial de movimientos</h3>
                <button type="button" className="btn" onClick={() => setApplyingPayment(true)}>
                  Aplicar pago
                </button>
              </div>

              {applyingPayment && (
                <div className="rounded-2xl border border-[var(--admin-border)] bg-white/[0.02] p-4">
                  <h4 className="mb-3 text-sm font-bold">Aplicar pago a partidas abiertas</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="field-label">Monto a aplicar</label>
                      <input
                        className="input w-full"
                        type="number"
                        step="0.01"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <p className="field-label mb-2">Partidas abiertas (se aplica en orden de vencimiento)</p>
                      <div className="max-h-48 overflow-y-auto space-y-2">
                        {openEntries.map((entry) => (
                          <label key={entry.id} className="flex items-center gap-3 rounded-xl border border-[var(--admin-border)] p-3">
                            <input
                              type="checkbox"
                              checked={selectedEntries.has(entry.id)}
                              onChange={(e) => {
                                const next = new Set(selectedEntries);
                                if (e.target.checked) next.add(entry.id); else next.delete(entry.id);
                                setSelectedEntries(next);
                              }}
                              className="accent-pink-500"
                            />
                            <div className="flex-1 text-sm">
                              <p className="font-semibold">{entry.documentNumber ?? "Sin número"} · {TYPE_LABELS[entry.type] ?? entry.type}</p>
                              <p className="text-xs text-[var(--admin-muted)]">Vence: {dateLabel(entry.dueDate)}</p>
                            </div>
                            <p className="text-sm font-bold tabular-nums text-amber-300">{money(entry.remainingAmount, entry.currency)}</p>
                          </label>
                        ))}
                      </div>
                      {openEntries.length === 0 && <p className="text-sm text-[var(--admin-muted)]">No hay partidas abiertas.</p>}
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-[var(--admin-muted)]">
                        Seleccionado: <span className="font-bold text-white">{money(totalSelected, statement.supplier.currency)}</span>
                      </p>
                      <div className="flex gap-2">
                        <button type="button" className="btn btn-secondary" onClick={() => { setApplyingPayment(false); setPaymentAmount(""); setSelectedEntries(new Set()); }}>
                          Cancelar
                        </button>
                        <button type="button" className="btn" onClick={() => void applyPayment()} disabled={saving}>
                          {saving ? "Aplicando…" : "Aplicar pago"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Partidas abiertas */}
              {openEntries.length > 0 && (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.03] p-4">
                  <h3 className="mb-3 text-sm font-black uppercase tracking-widest text-amber-300">Partidas abiertas</h3>
                  <div className="space-y-2">
                    {openEntries.map((entry) => (
                      <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--admin-border)] bg-white/[0.02] p-3">
                        <div>
                          <p className="text-sm font-bold">{entry.documentNumber ?? "Sin número"} · {TYPE_LABELS[entry.type] ?? entry.type}</p>
                          <p className="text-xs text-[var(--admin-muted)]">Vence: {dateLabel(entry.dueDate)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold tabular-nums text-amber-300">{money(entry.remainingAmount, entry.currency)}</p>
                          <p className="text-xs text-[var(--admin-muted)]">de {money(entry.originalAmount, entry.currency)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Filtros */}
              <div className="flex flex-wrap gap-2">
                {[
                  { key: "all", label: "Todos" },
                  { key: "open", label: "Abiertos" },
                  { key: "closed", label: "Cerrados" },
                  { key: "overdue", label: "Vencidos" },
                  { key: "purchase_invoice", label: "Facturas" },
                  { key: "payment", label: "Pagos" },
                  { key: "reversal", label: "Ajustes" },
                ].map((filter) => (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => setLedgerFilter(filter.key)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
                      ledgerFilter === filter.key ? "bg-pink-500 text-white" : "border border-[var(--admin-border)] text-[var(--admin-muted)] hover:bg-white/5"
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              <div className="rounded-2xl border border-[var(--admin-border)] bg-white/[0.02]">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[var(--admin-border)] text-xs uppercase tracking-wider text-[var(--admin-muted)]">
                        <th className="px-4 py-2">Fecha</th>
                        <th className="px-4 py-2">Tipo</th>
                        <th className="px-4 py-2">Documento</th>
                        <th className="px-4 py-2 text-right">Original</th>
                        <th className="px-4 py-2 text-right">Aplicado</th>
                        <th className="px-4 py-2 text-right">Restante</th>
                        <th className="px-4 py-2">Vence</th>
                        <th className="px-4 py-2">Estado</th>
                        <th className="px-4 py-2 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--admin-border)]/70">
                      {ledger
                        .filter((entry) => {
                          if (ledgerFilter === "all") return true;
                          if (ledgerFilter === "open") return entry.status === "open";
                          if (ledgerFilter === "closed") return entry.status === "closed";
                          if (ledgerFilter === "overdue") return entry.status === "open" && entry.dueDate && new Date(entry.dueDate) < new Date();
                          return entry.type === ledgerFilter;
                        })
                        .map((entry) => (
                          <tr key={entry.id}>
                            <td className="px-4 py-2 text-xs text-[var(--admin-muted)]">{dateLabel(entry.createdAt)}</td>
                            <td className="px-4 py-2 text-xs">{TYPE_LABELS[entry.type] ?? entry.type}</td>
                            <td className="px-4 py-2 font-semibold">{entry.documentNumber ?? "—"}</td>
                            <td className="px-4 py-2 text-right tabular-nums">{money(entry.originalAmount, entry.currency)}</td>
                            <td className="px-4 py-2 text-right tabular-nums">{money(entry.appliedAmount, entry.currency)}</td>
                            <td className={`px-4 py-2 text-right font-bold tabular-nums ${entry.remainingAmount > 0 ? "text-amber-300" : "text-emerald-300"}`}>
                              {money(entry.remainingAmount, entry.currency)}
                            </td>
                            <td className="px-4 py-2 text-xs text-[var(--admin-muted)]">{dateLabel(entry.dueDate)}</td>
                            <td className="px-4 py-2">
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${entry.status === "open" ? "bg-amber-500/15 text-amber-300" : entry.status === "reversed" ? "bg-zinc-500/15 text-zinc-400" : "bg-emerald-500/15 text-emerald-300"}`}>
                                {entry.status === "open" ? "Abierto" : entry.status === "reversed" ? "Revertido" : "Cerrado"}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-right">
                              {entry.status === "open" && entry.type !== "payment" && entry.type !== "reversal" && (
                                <button
                                  type="button"
                                  className="rounded-lg border border-red-500/20 px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/10"
                                  onClick={() => void reverseEntry(entry)}
                                >
                                  Revertir
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--admin-border)] px-5 py-4">
          {editing ? (
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)} disabled={saving}>Cancelar</button>
              <button type="button" className="btn" onClick={() => void save()} disabled={saving}>
                {saving ? "Guardando…" : "Guardar cambios"}
              </button>
            </>
          ) : (
            <button type="button" className="btn" onClick={() => setEditing(true)}>Editar proveedor</button>
          )}
        </div>
      </div>
    </div>
  );
}
