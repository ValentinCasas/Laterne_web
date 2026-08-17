"use client";

import { useMemo } from "react";

/** @summary Barra de filtros para reportes con período, sucursal, categoría, producto, proveedor, usuario, medio de pago y origen. */
export function ReportsFilters({
  filters,
  onChange,
  branches,
  categories,
  products,
  suppliers,
  users,
  paymentMethods,
  channels,
  sources,
  disabled = false,
  periodPreset,
}: {
  filters: {
    from?: string;
    to?: string;
    branchId?: number | null;
    categoryId?: number | null;
    productId?: number | null;
    supplierId?: number | null;
    userId?: number | null;
    paymentMethod?: string | null;
    channel?: string | null;
    source?: string | null;
    period?: string;
  };
  onChange: (patch: Record<string, unknown>) => void;
  branches: Array<{ id: number; name: string }>;
  categories: Array<{ id: number; name: string }>;
  products: Array<{ id: number; name: string }>;
  suppliers: Array<{ id: number; name: string }>;
  users: Array<{ id: number; name: string }>;
  paymentMethods: string[];
  channels: string[];
  sources: string[];
  disabled?: boolean;
  periodPreset?: string;
}) {
  const selectClass = useMemo(
    () =>
      "rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-300 outline-none transition-colors focus:border-pink-500/50 focus:bg-white/10 disabled:opacity-50",
    [],
  );

  function patchWithAutoCustom(patch: Record<string, unknown>) {
    if ((patch.from !== undefined || patch.to !== undefined) && filters.period && filters.period !== "custom") {
      return { ...patch, period: "custom" };
    }
    return patch;
  }

  function handleFromChange(value: string) {
    onChange(patchWithAutoCustom({ from: value }));
  }

  function handleToChange(value: string) {
    onChange(patchWithAutoCustom({ to: value }));
  }

  function handlePeriodChange(preset: string) {
    if (preset === "custom") {
      onChange({ period: preset });
      return;
    }
    const now = new Date();
    let from: Date;
    if (preset === "7d") {
      from = new Date(now);
      from.setUTCDate(from.getUTCDate() - 7);
      from.setUTCHours(0, 0, 0, 0);
    } else if (preset === "30d") {
      from = new Date(now);
      from.setUTCDate(from.getUTCDate() - 30);
      from.setUTCHours(0, 0, 0, 0);
    } else if (preset === "3m") {
      from = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    } else if (preset === "6m") {
      from = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    } else if (preset === "12m") {
      from = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    } else {
      from = new Date(now.getTime() - 30 * 86_400_000);
      from.setUTCHours(0, 0, 0, 0);
    }
    const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    onChange({ from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), period: preset });
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
      {periodPreset !== undefined && (
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Período</label>
          <select
            className={selectClass}
            value={periodPreset}
            onChange={(event) => handlePeriodChange(event.target.value)}
            disabled={disabled}
          >
            <option value="7d">7 días</option>
            <option value="30d">30 días</option>
            <option value="3m">3 meses</option>
            <option value="6m">6 meses</option>
            <option value="12m">12 meses</option>
            <option value="custom">Personalizado</option>
          </select>
        </div>
      )}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Desde</label>
        <input
          type="date"
          className={selectClass}
          value={filters.from || ""}
          onChange={(event) => handleFromChange(event.target.value)}
          disabled={disabled}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Hasta</label>
        <input
          type="date"
          className={selectClass}
          value={filters.to || ""}
          onChange={(event) => handleToChange(event.target.value)}
          disabled={disabled}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Sucursal</label>
        <select
          className={selectClass}
          value={filters.branchId ?? ""}
          onChange={(event) => onChange({ branchId: event.target.value ? Number(event.target.value) : null })}
          disabled={disabled}
        >
          <option value="">Todas</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>{branch.name}</option>
          ))}
        </select>
      </div>
      {categories.length > 0 && (
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Categoría</label>
          <select
            className={selectClass}
            value={filters.categoryId ?? ""}
            onChange={(event) => onChange({ categoryId: event.target.value ? Number(event.target.value) : null })}
            disabled={disabled}
          >
            <option value="">Todas</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </div>
      )}
      {products.length > 0 && (
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Producto</label>
          <select
            className={selectClass}
            value={filters.productId ?? ""}
            onChange={(event) => onChange({ productId: event.target.value ? Number(event.target.value) : null })}
            disabled={disabled}
          >
            <option value="">Todos</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>{product.name}</option>
            ))}
          </select>
        </div>
      )}
      {suppliers.length > 0 && (
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Proveedor</label>
          <select
            className={selectClass}
            value={filters.supplierId ?? ""}
            onChange={(event) => onChange({ supplierId: event.target.value ? Number(event.target.value) : null })}
            disabled={disabled}
          >
            <option value="">Todos</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
            ))}
          </select>
        </div>
      )}
      {users.length > 0 && (
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Usuario / Camarero</label>
          <select
            className={selectClass}
            value={filters.userId ?? ""}
            onChange={(event) => onChange({ userId: event.target.value ? Number(event.target.value) : null })}
            disabled={disabled}
          >
            <option value="">Todos</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>{user.name}</option>
            ))}
          </select>
        </div>
      )}
      {paymentMethods.length > 0 && (
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Medio de pago</label>
          <select
            className={selectClass}
            value={filters.paymentMethod ?? ""}
            onChange={(event) => onChange({ paymentMethod: event.target.value || null })}
            disabled={disabled}
          >
            <option value="">Todos</option>
            {paymentMethods.map((method) => (
              <option key={method} value={method}>{method}</option>
            ))}
          </select>
        </div>
      )}
      {channels.length > 0 && (
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Canal</label>
          <select
            className={selectClass}
            value={filters.channel ?? ""}
            onChange={(event) => onChange({ channel: event.target.value || null })}
            disabled={disabled}
          >
            <option value="">Todos</option>
            {channels.map((channel) => (
              <option key={channel} value={channel}>{channel}</option>
            ))}
          </select>
        </div>
      )}
      {sources.length > 0 && (
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Origen</label>
          <select
            className={selectClass}
            value={filters.source ?? ""}
            onChange={(event) => onChange({ source: event.target.value || null })}
            disabled={disabled}
          >
            <option value="">Todos</option>
            {sources.map((source) => (
              <option key={source} value={source}>{source}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
