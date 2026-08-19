"use client";

import { useCallback, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { scopedFetch } from "@/lib/client-routing";
import { PageHeader, DataTable, StatusBadge, ActionMenu, FactBox, Drawer } from "@/components/admin/ui";
import { money } from "@/lib/finance-helpers";

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
      const response = await scopedFetch(`/api/admin/finanzas/cuentas?branchId=${initial.activeBranchId ?? ""}`);
      const body = (await response.json().catch(() => ({}))) as { items?: AccountsInitial["accounts"] };
      if (!response.ok || !body.items) throw new Error();
      setAccounts(body.items);
    } catch {
      await Swal.fire({
        title: "Error",
        text: "No se pudieron actualizar las cuentas",
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
        await scopedFetch(`/api/admin/finanzas/cuentas?id=${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            code: form.code || null,
            type: form.type,
            status: editing.status,
            notes: form.notes || null,
          }),
        });
      } else {
        await scopedFetch("/api/admin/finanzas/cuentas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
      await Swal.fire({
        title: editing ? "Cuenta actualizada" : "Cuenta creada",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
        background: "#18181b",
        color: "#fafafa",
      });
    } catch {
      await Swal.fire({
        title: "Error",
        text: "No se pudo guardar la cuenta",
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
        await scopedFetch(`/api/admin/finanzas/cuentas?id=${account.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });
        await refresh();
      } catch {
        await Swal.fire({
          title: "Error",
          text: "No se pudo actualizar el estado",
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

  const totalBalance = useMemo(
    () => accounts.reduce((sum, account) => sum + account.balance, 0),
    [accounts],
  );

  return (
    <div>
      <PageHeader
        section="Finanzas"
        title="Cuentas financieras"
        description="Cajas, bancos, billeteras y otras cuentas del negocio"
        actions={
          <button type="button" className="btn" onClick={openCreate} disabled={busy}>
            + Nueva cuenta
          </button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DataTable
            viewStorageKey="cuentas"
            columns={[
              { key: "nombre", label: "Nombre" },
              { key: "codigo", label: "Código" },
              { key: "tipo", label: "Tipo" },
              { key: "moneda", label: "Moneda" },
              { key: "saldo", label: "Saldo", align: "right" },
              { key: "estado", label: "Estado" },
              { key: "acciones", label: "Acciones", align: "right" },
            ]}
            data={useMemo(() => accounts.map((account) => ({
              id: account.id,
              nombre: account.name,
              codigo: account.code || "—",
              tipo: <span className="capitalize">{account.type}</span>,
              moneda: account.currency,
              saldo: (
                <span className={`text-right font-black tabular-nums block ${account.balance >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                  {money(account.balance, currency)}
                </span>
              ),
              estado: (
                <StatusBadge
                  status={
                    account.status === "active" ? "Activa" : account.status === "closed" ? "Cerrada" : "Inactiva"
                  }
                  tone={account.status === "active" ? "success" : account.status === "closed" ? "danger" : "warning"}
                />
              ),
              acciones: (
                <ActionMenu
                  align="right"
                  items={[
                    { label: "Editar", onClick: () => openEdit(account) },
                    {
                      label: account.status === "active" ? "Desactivar" : "Activar",
                      onClick: () => toggleStatus(account),
                      tone: account.status === "active" ? "danger" : "primary",
                    },
                  ]}
                />
              ),
            })), [accounts, currency, openEdit, toggleStatus])}
            keyExtractor={(row) => row.id as number}
            emptyMessage="No hay cuentas financieras todavía"
            density="normal"
          />
        </div>
        <div className="lg:col-span-1">
          <FactBox title="Resumen de cuentas">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--admin-muted)]">Total cuentas</span>
                <span className="text-sm font-black">{accounts.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--admin-muted)]">Saldo consolidado</span>
                <span className={`text-sm font-black tabular-nums ${totalBalance >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                  {money(totalBalance, currency)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--admin-muted)]">Activas</span>
                <span className="text-sm font-black text-emerald-300">
                  {accounts.filter((a) => a.status === "active").length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--admin-muted)]">Inactivas</span>
                <span className="text-sm font-black text-amber-300">
                  {accounts.filter((a) => a.status === "inactive").length}
                </span>
              </div>
            </div>
          </FactBox>
        </div>
      </div>

      <Drawer
        open={creating}
        onClose={() => {
          setCreating(false);
          setEditing(null);
          setForm(emptyForm);
        }}
        title={editing ? "Editar cuenta" : "Nueva cuenta"}
        width="520px"
      >
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-bold text-[var(--admin-muted)]">Nombre</label>
                <input
                  className="input w-full"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ej: Caja principal"
                />
                <p className="mt-1 text-xs text-zinc-500">Nombre identificatorio de la cuenta.</p>
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
                  <p className="mt-1 text-xs text-zinc-500">Alias corto para reportes.</p>
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
                  <p className="mt-1 text-xs text-zinc-500">Saldo al crear la cuenta.</p>
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
      </Drawer>
    </div>
  );
}
