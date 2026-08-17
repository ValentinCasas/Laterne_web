"use client";

import { useCallback, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { scopedFetch } from "@/lib/client-routing";

export type MovementsInitial = {
  tenantId: number;
  currency: string;
  activeBranchId: number | null;
  movements: Array<{
    id: number;
    date: string;
    accountId: number;
    accountName: string;
    type: string;
    direction: string;
    amount: number;
    concept: string;
    reference?: string | null;
    origin: string;
    referenceType?: string | null;
    userName?: string | null;
  }>;
  accounts: Array<{ id: number; name: string; type: string }>;
  total: number;
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

const MOVEMENT_TYPES = [
  { value: "", label: "Todos" },
  { value: "sale", label: "Venta" },
  { value: "payment", label: "Pago" },
  { value: "transfer", label: "Transferencia" },
  { value: "expense", label: "Gasto" },
  { value: "cog", label: "CMV" },
  { value: "adjustment", label: "Ajuste" },
  { value: "other", label: "Otro" },
];

const DIRECTION_OPTIONS = [
  { value: "", label: "Todas" },
  { value: "in", label: "Ingreso" },
  { value: "out", label: "Egreso" },
];

/** @summary Gestor de movimientos financieros. */
export function FinanceMovementsClient({ initial }: { initial: MovementsInitial }) {
  const [movements, setMovements] = useState(initial.movements);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(initial.total);
  const [filters, setFilters] = useState({
    accountId: "",
    type: "",
    direction: "",
    from: "",
    to: "",
  });
  const [busy, setBusy] = useState(false);
  const currency = initial.currency ?? "ARS";
  const pageSize = 20;

  const filteredTotal = useMemo(() => total, [total]);

  const pageCount = Math.max(1, Math.ceil(filteredTotal / pageSize));

  const loadMovements = useCallback(
    async (reset = false) => {
      setBusy(true);
      try {
        const params = new URLSearchParams();
        if (filters.accountId) params.set("accountId", filters.accountId);
        if (filters.type) params.set("type", filters.type);
        if (filters.direction) params.set("direction", filters.direction);
        if (filters.from) params.set("from", filters.from);
        if (filters.to) params.set("to", filters.to);
        params.set("limit", String(pageSize));
        params.set("offset", String(reset ? 0 : page * pageSize));
        if (initial.activeBranchId) params.set("branchId", String(initial.activeBranchId));

        const data = await api<{ items: MovementsInitial["movements"]; total: number }>(
          `/api/admin/finanzas/movimientos?${params.toString()}`,
        );
        setMovements(data.items);
        setTotal(data.total);
        if (reset) setPage(0);
      } catch (reason) {
        await Swal.fire({
          title: "Error",
          text: reason instanceof Error ? reason.message : "No se pudieron cargar los movimientos",
          icon: "error",
          background: "#18181b",
          color: "#fafafa",
        });
      } finally {
        setBusy(false);
      }
    },
    [filters, page, pageSize, initial.activeBranchId],
  );

  const handleCreate = useCallback(async () => {
    setBusy(true);
    try {
      const result = await Swal.fire({
        title: "Nuevo movimiento",
        html: `
          <div class="text-left space-y-3">
            <div>
              <label class="block text-sm font-bold text-zinc-400 mb-1">Cuenta</label>
              <select id="mc-account" class="w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-white">
                ${initial.accounts.map((a) => `<option value="${a.id}">${a.name}</option>`).join("")}
              </select>
            </div>
            <div>
              <label class="block text-sm font-bold text-zinc-400 mb-1">Tipo</label>
              <select id="mc-type" class="w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-white">
                <option value="sale">Venta</option>
                <option value="payment">Pago</option>
                <option value="transfer">Transferencia</option>
                <option value="expense">Gasto</option>
                <option value="cog">CMV</option>
                <option value="adjustment">Ajuste</option>
                <option value="other">Otro</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-bold text-zinc-400 mb-1">Dirección</label>
              <select id="mc-direction" class="w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-white">
                <option value="in">Ingreso</option>
                <option value="out">Egreso</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-bold text-zinc-400 mb-1">Importe</label>
              <input id="mc-amount" type="number" step="0.01" class="w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-white" />
            </div>
            <div>
              <label class="block text-sm font-bold text-zinc-400 mb-1">Concepto</label>
              <input id="mc-concept" class="w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-white" />
            </div>
            <div>
              <label class="block text-sm font-bold text-zinc-400 mb-1">Referencia</label>
              <input id="mc-reference" class="w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-white" />
            </div>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: "Crear",
        cancelButtonText: "Cancelar",
        background: "#18181b",
        color: "#fafafa",
        preConfirm: () => {
          const accountId = Number((document.getElementById("mc-account") as HTMLSelectElement)?.value);
          const type = (document.getElementById("mc-type") as HTMLSelectElement)?.value;
          const direction = (document.getElementById("mc-direction") as HTMLSelectElement)?.value;
          const amount = Number((document.getElementById("mc-amount") as HTMLInputElement)?.value);
          const concept = (document.getElementById("mc-concept") as HTMLInputElement)?.value;
          const reference = (document.getElementById("mc-reference") as HTMLInputElement)?.value;
          if (!accountId || !amount || !concept.trim()) {
            Swal.showValidationMessage("Completá todos los campos requeridos");
            return false;
          }
          return { accountId, type, direction, amount, concept, reference: reference || null };
        },
      });

      if (result.isConfirmed && result.value) {
        await api("/api/admin/finanzas/movimientos", {
          method: "POST",
          body: JSON.stringify({
            ...result.value,
            origin: "manual",
          }),
        });
        await loadMovements(true);
        await Swal.fire({
          title: "Creado",
          icon: "success",
          background: "#18181b",
          color: "#fafafa",
          timer: 1500,
          showConfirmButton: false,
        });
      }
    } catch (reason) {
      await Swal.fire({
        title: "Error",
        text: reason instanceof Error ? reason.message : "No se pudo crear el movimiento",
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
    } finally {
      setBusy(false);
    }
  }, [initial.accounts, loadMovements]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="section-eyebrow">Finanzas</p>
          <h1 className="text-2xl font-black tracking-tight">Movimientos</h1>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">Registro de ingresos y egresos financieros</p>
        </div>
        <button type="button" className="btn" onClick={handleCreate} disabled={busy}>
          + Nuevo movimiento
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-2.5">
        <select
          className="input w-auto"
          value={filters.accountId}
          onChange={(e) => setFilters((f) => ({ ...f, accountId: e.target.value }))}
          aria-label="Filtrar por cuenta"
        >
          <option value="">Todas las cuentas</option>
          {initial.accounts.map((a) => (
            <option key={a.id} value={String(a.id)}>
              {a.name}
            </option>
          ))}
        </select>
        <select
          className="input w-auto"
          value={filters.type}
          onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
          aria-label="Filtrar por tipo"
        >
          {MOVEMENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <select
          className="input w-auto"
          value={filters.direction}
          onChange={(e) => setFilters((f) => ({ ...f, direction: e.target.value }))}
          aria-label="Filtrar por dirección"
        >
          {DIRECTION_OPTIONS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
        <input
          type="date"
          className="input w-auto"
          value={filters.from}
          onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
          aria-label="Fecha desde"
        />
        <input
          type="date"
          className="input w-auto"
          value={filters.to}
          onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
          aria-label="Fecha hasta"
        />
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => loadMovements(true)}
          disabled={busy}
        >
          Filtrar
        </button>
        <span className="ml-auto text-sm text-[var(--admin-muted)]">{filteredTotal} resultados</span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl shadow-black/10">
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
                <th className="px-5 py-3 font-bold">Referencia</th>
                <th className="px-5 py-3 font-bold">Origen</th>
                <th className="px-5 py-3 font-bold">Usuario</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--admin-border)]">
              {movements.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-[var(--admin-muted)]">
                    No hay movimientos financieros todavía
                  </td>
                </tr>
              ) : (
                movements.map((movement) => (
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
                    <td className="px-5 py-3 text-xs text-[var(--admin-muted)]">{movement.reference || "—"}</td>
                    <td className="px-5 py-3 text-xs text-[var(--admin-muted)]">{movement.origin}</td>
                    <td className="px-5 py-3 text-xs text-[var(--admin-muted)]">{movement.userName || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {pageCount > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0 || busy}
          >
            ← Anterior
          </button>
          <span className="text-sm text-[var(--admin-muted)]">
            Página {page + 1} de {pageCount}
          </span>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={page >= pageCount - 1 || busy}
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}
