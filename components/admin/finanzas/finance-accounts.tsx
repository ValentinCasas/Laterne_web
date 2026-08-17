"use client";

import { useCallback, useState } from "react";
import Swal from "sweetalert2";
import { scopedFetch } from "@/lib/client-routing";

export type AccountsInitial = {
  tenantId: number;
  currency: string;
  activeBranchId: number | null;
  accounts: Array<{
    id: number;
    name: string;
    code: string | null;
    type: string;
    currency: string;
    status: string;
    openingBalance: number;
    balance: number;
    notes?: string | null;
    branchId?: number | null;
  }>;
};

type AccountForm = {
  name: string;
  code: string;
  type: string;
  currency: string;
  branchId: string;
  openingBalance: string;
  notes: string;
};

const ACCOUNT_TYPES = [
  { value: "caja", label: "Caja" },
  { value: "banco", label: "Banco" },
  { value: "billetera", label: "Billetera virtual" },
  { value: "otro", label: "Otro" },
];

/** @summary Formatea un importe. */
function money(value: number | null | undefined, currency: string) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
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

const emptyForm: AccountForm = {
  name: "",
  code: "",
  type: "caja",
  currency: "ARS",
  branchId: "",
  openingBalance: "0",
  notes: "",
};

/** @summary Gestor de cuentas financieras. */
export function FinanceAccountsClient({ initial }: { initial: AccountsInitial }) {
  const [accounts, setAccounts] = useState(initial.accounts);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AccountsInitial["accounts"][number] | null>(null);
  const [form, setForm] = useState<AccountForm>(emptyForm);
  const [busy, setBusy] = useState(false);
  const currency = initial.currency ?? "ARS";

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const data = await api<{ items: AccountsInitial["accounts"] }>(
        `/api/admin/finanzas/cuentas?branchId=${initial.activeBranchId ?? ""}`,
      );
      setAccounts(data.items);
    } catch (reason) {
      await Swal.fire({
        title: "Error",
        text: reason instanceof Error ? reason.message : "No se pudieron actualizar las cuentas",
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
    } finally {
      setBusy(false);
    }
  }, [initial.activeBranchId]);

  const openCreate = useCallback(() => {
    setForm(emptyForm);
    setCreating(true);
  }, []);

  const openEdit = useCallback((account: AccountsInitial["accounts"][number]) => {
    setEditing(account);
    setForm({
      name: account.name,
      code: account.code || "",
      type: account.type,
      currency: account.currency,
      branchId: account.branchId ? String(account.branchId) : "",
      openingBalance: String(account.openingBalance),
      notes: account.notes || "",
    });
    setCreating(true);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!form.name.trim()) {
      await Swal.fire({
        title: "Campo requerido",
        text: "El nombre de la cuenta es obligatorio",
        icon: "warning",
        background: "#18181b",
        color: "#fafafa",
      });
      return;
    }

    setBusy(true);
    try {
      if (editing) {
        await api(`/api/admin/finanzas/cuentas?id=${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: form.name,
            code: form.code || null,
            type: form.type,
            status: editing.status,
            notes: form.notes || null,
          }),
        });
      } else {
        await api("/api/admin/finanzas/cuentas", {
          method: "POST",
          body: JSON.stringify({
            name: form.name,
            code: form.code || null,
            type: form.type,
            currency: form.currency,
            branchId: form.branchId ? Number(form.branchId) : null,
            openingBalance: Number(form.openingBalance) || 0,
            notes: form.notes || null,
          }),
        });
      }
      await refresh();
      setCreating(false);
      setEditing(null);
      setForm(emptyForm);
    } catch (reason) {
      await Swal.fire({
        title: "Error",
        text: reason instanceof Error ? reason.message : "No se pudo guardar la cuenta",
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
    } finally {
      setBusy(false);
    }
  }, [editing, form, refresh]);

  const toggleStatus = useCallback(
    async (account: AccountsInitial["accounts"][number]) => {
      const newStatus = account.status === "active" ? "inactive" : "active";
      setBusy(true);
      try {
        await api(`/api/admin/finanzas/cuentas?id=${account.id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: newStatus }),
        });
        await refresh();
      } catch (reason) {
        await Swal.fire({
          title: "Error",
          text: reason instanceof Error ? reason.message : "No se pudo actualizar el estado",
          icon: "error",
          background: "#18181b",
          color: "#fafafa",
        });
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="section-eyebrow">Finanzas</p>
          <h1 className="text-2xl font-black tracking-tight">Cuentas financieras</h1>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">
            Cajas, bancos, billeteras y otras cuentas del negocio
          </p>
        </div>
        <button type="button" className="btn" onClick={openCreate} disabled={busy}>
          + Nueva cuenta
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl shadow-black/10">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--admin-border)] bg-white/[0.02] text-xs uppercase tracking-wider text-[var(--admin-muted)]">
                <th className="px-5 py-3 font-bold">Nombre</th>
                <th className="px-5 py-3 font-bold">Código</th>
                <th className="px-5 py-3 font-bold">Tipo</th>
                <th className="px-5 py-3 font-bold">Moneda</th>
                <th className="px-5 py-3 font-bold text-right">Saldo</th>
                <th className="px-5 py-3 font-bold">Estado</th>
                <th className="px-5 py-3 font-bold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--admin-border)]">
              {accounts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-[var(--admin-muted)]">
                    No hay cuentas financieras todavía
                  </td>
                </tr>
              ) : (
                accounts.map((account) => (
                  <tr key={account.id} className="hover:bg-white/[0.02]">
                    <td className="px-5 py-3 font-medium">{account.name}</td>
                    <td className="px-5 py-3 text-[var(--admin-muted)]">{account.code || "—"}</td>
                    <td className="px-5 py-3 capitalize">{account.type}</td>
                    <td className="px-5 py-3">{account.currency}</td>
                    <td className={`px-5 py-3 text-right font-black tabular-nums ${account.balance >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                      {money(account.balance, currency)}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          account.status === "active"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : account.status === "closed"
                              ? "bg-zinc-500/15 text-zinc-300"
                              : "bg-amber-500/15 text-amber-300"
                        }`}
                      >
                        {account.status === "active" ? "Activa" : account.status === "closed" ? "Cerrada" : "Inactiva"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="btn btn-secondary py-1 text-xs"
                          onClick={() => openEdit(account)}
                          disabled={busy}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary py-1 text-xs"
                          onClick={() => toggleStatus(account)}
                          disabled={busy}
                        >
                          {account.status === "active" ? "Desactivar" : "Activar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--admin-border)] px-5 py-4">
              <div>
                <h2 className="text-xl font-black">{editing ? "Editar cuenta" : "Nueva cuenta"}</h2>
                <p className="text-sm text-[var(--admin-muted)]">
                  {editing ? "Modificá los datos de la cuenta" : "Completá los datos de la nueva cuenta financiera"}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setCreating(false);
                  setEditing(null);
                  setForm(emptyForm);
                }}
                disabled={busy}
              >
                ✕ Cerrar
              </button>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <label className="mb-1 block text-sm font-bold text-[var(--admin-muted)]">Nombre</label>
                <input
                  className="input w-full"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ej: Caja principal"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-bold text-[var(--admin-muted)]">Código</label>
                  <input
                    className="input w-full"
                    value={form.code}
                    onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                    placeholder="Opcional"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-bold text-[var(--admin-muted)]">Tipo</label>
                  <select
                    className="input w-full"
                    value={form.type}
                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  >
                    {ACCOUNT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-bold text-[var(--admin-muted)]">Moneda</label>
                  <select
                    className="input w-full"
                    value={form.currency}
                    onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                  >
                    <option value="ARS">ARS</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-bold text-[var(--admin-muted)]">Saldo inicial</label>
                  <input
                    type="number"
                    className="input w-full"
                    value={form.openingBalance}
                    onChange={(e) => setForm((f) => ({ ...f, openingBalance: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-bold text-[var(--admin-muted)]">Notas</label>
                <textarea
                  className="input w-full"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--admin-border)] px-5 py-4">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setCreating(false);
                  setEditing(null);
                  setForm(emptyForm);
                }}
                disabled={busy}
              >
                Cancelar
              </button>
              <button type="button" className="btn" onClick={handleSubmit} disabled={busy}>
                {editing ? "Guardar cambios" : "Crear cuenta"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
