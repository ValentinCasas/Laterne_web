"use client";

import { useCallback, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { scopedFetch } from "@/lib/client-routing";
import { PageHeader, DataTable, StatusBadge, FiltersBar, ActiveFilterChip, FactBox } from "@/components/admin/ui";
import { money, dateLabel } from "@/lib/finance-helpers";

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

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.accountId) count++;
    if (filters.type) count++;
    if (filters.direction) count++;
    if (filters.from) count++;
    if (filters.to) count++;
    return count;
  }, [filters]);

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ label: string; onRemove: () => void }> = [];
    if (filters.accountId) {
      const account = initial.accounts.find((a) => String(a.id) === filters.accountId);
      chips.push({
        label: `Cuenta: ${account?.name ?? filters.accountId}`,
        onRemove: () => setFilters((f) => ({ ...f, accountId: "" })),
      });
    }
    if (filters.type) {
      const typeLabel = MOVEMENT_TYPES.find((t) => t.value === filters.type)?.label ?? filters.type;
      chips.push({
        label: `Tipo: ${typeLabel}`,
        onRemove: () => setFilters((f) => ({ ...f, type: "" })),
      });
    }
    if (filters.direction) {
      const dirLabel = DIRECTION_OPTIONS.find((d) => d.value === filters.direction)?.label ?? filters.direction;
      chips.push({
        label: `Dirección: ${dirLabel}`,
        onRemove: () => setFilters((f) => ({ ...f, direction: "" })),
      });
    }
    if (filters.from) {
      chips.push({
        label: `Desde: ${filters.from}`,
        onRemove: () => setFilters((f) => ({ ...f, from: "" })),
      });
    }
    if (filters.to) {
      chips.push({
        label: `Hasta: ${filters.to}`,
        onRemove: () => setFilters((f) => ({ ...f, to: "" })),
      });
    }
    return chips;
  }, [filters, initial.accounts]);

  return (
    <div>
      <PageHeader
        section="Finanzas"
        title="Movimientos"
        description="Registro de ingresos y egresos financieros"
        actions={
          <button type="button" className="btn" onClick={handleCreate} disabled={busy}>
            + Nuevo movimiento
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FiltersBar title="Filtros" activeCount={activeFilterCount} onClear={() => setFilters({ accountId: "", type: "", direction: "", from: "", to: "" })}>
          <div className="space-y-3">
            <select
              className="input w-full"
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
              className="input w-full"
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
              className="input w-full"
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
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                className="input w-full"
                value={filters.from}
                onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
                aria-label="Fecha desde"
              />
              <input
                type="date"
                className="input w-full"
                value={filters.to}
                onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
                aria-label="Fecha hasta"
              />
            </div>
            <button
              type="button"
              className="btn btn-secondary w-full"
              onClick={() => loadMovements(true)}
              disabled={busy}
            >
              Filtrar
            </button>
          </div>
        </FiltersBar>
        {activeFilterChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {activeFilterChips.map((chip) => (
              <ActiveFilterChip key={chip.label} label={chip.label} onRemove={chip.onRemove} />
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="shadow-xl shadow-black/10">
            <DataTable
          viewStorageKey="movimientos"
          columns={[
            { key: "fecha", label: "Fecha" },
            { key: "cuenta", label: "Cuenta" },
            { key: "tipo", label: "Tipo" },
            { key: "direccion", label: "Dirección" },
            { key: "importe", label: "Importe", align: "right" },
            { key: "concepto", label: "Concepto" },
            { key: "referencia", label: "Referencia", hideOnMobile: true },
            { key: "origen", label: "Origen", hideOnMobile: true },
            { key: "usuario", label: "Usuario", hideOnMobile: true },
          ]}
          data={useMemo(() => movements.map((movement) => ({
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
            referencia: <span className="text-xs text-[var(--admin-muted)]">{movement.reference || "—"}</span>,
            origen: <span className="text-xs text-[var(--admin-muted)]">{movement.origin}</span>,
            usuario: <span className="text-xs text-[var(--admin-muted)]">{movement.userName || "—"}</span>,
          })), [movements, currency])}
          keyExtractor={(row) => row.id as number}
          emptyMessage="No hay movimientos financieros todavía"
          density="compact"
        />
          </div>
        </div>
        <div className="lg:col-span-1">
          <FactBox title="Resumen del período">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--admin-muted)]">Total movimientos</span>
                <span className="text-sm font-black">{total}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--admin-muted)]">Página actual</span>
                <span className="text-sm font-black">{page + 1} de {pageCount}</span>
              </div>
              <div className="border-t border-[var(--admin-border)] pt-2">
                <p className="text-xs text-zinc-500">Los filtros aplicados se muestran arriba. Usá la tabla para navegar por los registros.</p>
              </div>
            </div>
          </FactBox>
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
