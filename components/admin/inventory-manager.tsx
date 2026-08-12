"use client";

import { useMemo, useState } from "react";
import Swal from "sweetalert2";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { stockMovementTypeLabels } from "@/lib/order-stock";
import { scopedFetch } from "@/lib/client-routing";

type Branch = { id: number; name: string; active: boolean };
type Product = { id: number; name: string; imageUrl: string; availability: string | null };
type Stock = {
  id: number;
  branchId: number;
  productId: number;
  tracked: boolean;
  current: string | number;
  minimum: string | number;
  unit: string;
};
type Movement = {
  id: string;
  type: string;
  quantity: string | number;
  balanceAfter: string | number;
  reason: string;
  createdAt: string;
  stock: { product: { name: string }; branch: { name: string } };
};

/** @summary Presenta existencias por sucursal, alertas de mínimo y un historial de ajustes auditables. */
export function InventoryManager({
  branches,
  products,
  initialStocks,
  movements,
  initialBranchId,
}: {
  branches: Branch[];
  products: Product[];
  initialStocks: Stock[];
  movements: Movement[];
  initialBranchId: number;
}) {
  const [branchId, setBranchId] = useState(initialBranchId || branches[0]?.id || 0);
  const [stocks, setStocks] = useState(initialStocks);
  const [query, setQuery] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);
  const visible = useMemo(
    () =>
      products.filter((product) => {
        const stock = stocks.find((item) => item.branchId === branchId && item.productId === product.id);
        const matches = product.name.toLocaleLowerCase("es").includes(query.trim().toLocaleLowerCase("es"));
        const low = stock?.tracked && Number(stock.current) <= Number(stock.minimum);
        return matches && (!onlyLow || low);
      }),
    [branchId, onlyLow, products, query, stocks],
  );

  /** @summary Guarda el nivel indicado y solicita un motivo para conservar trazabilidad del ajuste. */
  async function save(product: Product, form: HTMLFormElement) {
    const data = new FormData(form);
    const reason = await Swal.fire({
      title: "Motivo del ajuste",
      input: "text",
      inputPlaceholder: "Ej. Recuento de cierre",
      inputValidator: (value) => (value.trim().length < 3 ? "Explicá brevemente el ajuste" : undefined),
      showCancelButton: true,
      confirmButtonText: "Guardar stock",
      cancelButtonText: "Cancelar",
      background: "#18181b",
      color: "#fafafa",
    });
    if (!reason.isConfirmed) return;
    const response = await scopedFetch("/api/admin/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        branchId,
        productId: product.id,
        tracked: data.get("tracked") === "on",
        current: data.get("current"),
        minimum: data.get("minimum"),
        unit: data.get("unit"),
        reason: reason.value,
      }),
    });
    const body = (await response.json().catch(() => ({}))) as { stock?: Stock; error?: string };
    if (!response.ok || !body.stock) {
      await Swal.fire({
        title: "No se pudo guardar",
        text: body.error,
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
      return;
    }
    setStocks((current) => [...current.filter((item) => item.id !== body.stock!.id), body.stock!]);
    await Swal.fire({
      title: "Inventario actualizado",
      icon: "success",
      timer: 1200,
      showConfirmButton: false,
      background: "#18181b",
      color: "#fafafa",
    });
  }

  return (
    <section>
      <AdminPageHeader
        eyebrow="Operación"
        title="Stock por sucursal"
        description="Activá el control solo en los productos que realmente quieras descontar con cada pedido."
        section="inventario"
      />
      <div className="card mt-6 grid gap-3 p-4 lg:grid-cols-[240px_minmax(260px,1fr)_auto]">
        <select
          className="input"
          value={branchId}
          onChange={(event) => setBranchId(Number(event.target.value))}
          aria-label="Sucursal"
        >
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
              {branch.active ? "" : " · inactiva"}
            </option>
          ))}
        </select>
        <input
          className="input"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar producto…"
        />
        <label className="flex items-center gap-2 rounded-xl border border-white/10 px-4 text-sm font-bold">
          <input type="checkbox" checked={onlyLow} onChange={(event) => setOnlyLow(event.target.checked)} />{" "}
          Solo bajo mínimo
        </label>
      </div>
      <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="hidden grid-cols-[minmax(220px,1.6fr)_120px_120px_130px_130px_120px_100px] gap-4 border-b border-[var(--admin-border)] px-5 py-3 text-xs font-black uppercase tracking-wider text-[var(--admin-muted)] lg:grid">
          <span>Producto</span><span>Actual</span><span>Mínimo</span><span>Unidad</span><span>Control</span><span>Estado</span><span />
        </div>
        <div className="divide-y divide-white/10">
          {visible.map((product) => {
            const stock = stocks.find((item) => item.branchId === branchId && item.productId === product.id);
            const low = Boolean(stock?.tracked && Number(stock.current) <= Number(stock.minimum));
            const status = !stock?.tracked ? "Control desactivado" : Number(stock?.current ?? 0) <= 0 ? "Sin stock" : low ? "Bajo stock" : "Normal";
            return (
              <form
                key={`${branchId}-${product.id}`}
                className={`grid gap-3 px-5 py-4 lg:grid-cols-[minmax(220px,1.6fr)_120px_120px_130px_130px_120px_100px] lg:items-center ${low ? "bg-amber-500/[.06]" : ""}`}
                onSubmit={(event) => {
                  event.preventDefault();
                  void save(product, event.currentTarget);
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <strong>{product.name}</strong>
                  <span className={`rounded-full px-2 py-1 text-xs font-black lg:hidden ${status === "Normal" ? "bg-emerald-500/15 text-emerald-300" : status === "Bajo stock" ? "bg-amber-500/15 text-amber-300" : "bg-white/10 text-[var(--admin-muted)]"}`}>{status}</span>
                </div>
                <label className="text-xs text-zinc-500"><span className="lg:hidden">Actual</span><input className="input mt-1 py-2" name="current" type="number" min="0" step="0.001" defaultValue={Number(stock?.current ?? 0)} /></label>
                <label className="text-xs text-zinc-500"><span className="lg:hidden">Mínimo</span><input className="input mt-1 py-2" name="minimum" type="number" min="0" step="0.001" defaultValue={Number(stock?.minimum ?? 0)} /></label>
                <label className="text-xs text-zinc-500"><span className="lg:hidden">Unidad</span><input className="input mt-1 py-2" name="unit" defaultValue={stock?.unit ?? "unidad"} /></label>
                <label className="flex items-center gap-2 text-sm lg:justify-center"><input name="tracked" type="checkbox" defaultChecked={stock?.tracked ?? false} /><span>Automático</span></label>
                <span className={`hidden rounded-full px-2 py-1 text-center text-xs font-black lg:block ${status === "Normal" ? "bg-emerald-500/15 text-emerald-300" : status === "Bajo stock" ? "bg-amber-500/15 text-amber-300" : "bg-white/10 text-[var(--admin-muted)]"}`}>{status}</span>
                <button className="btn py-2 text-sm">Guardar</button>
              </form>
            );
          })}
        </div>
      </div>
      <section className="card mt-8 p-5">
        <h2 className="text-xl font-black">Últimos movimientos</h2>
        <div className="mt-4 max-h-96 space-y-2 overflow-y-auto">
          {movements.map((movement) => (
            <article
              key={movement.id}
              className="grid gap-1 rounded-xl bg-white/[.03] p-3 sm:grid-cols-[1fr_auto]"
            >
              <div>
                <strong>{movement.stock.product.name}</strong>
                <p className="text-sm text-zinc-500">
                  {stockMovementTypeLabels[movement.type] ?? "Movimiento"} · {movement.stock.branch.name}
                </p>
                <p className="text-xs text-zinc-600">{movement.reason}</p>
              </div>
              <p className="text-sm font-bold">
                {Number(movement.quantity) > 0 ? "+" : ""}
                {Number(movement.quantity)} → {Number(movement.balanceAfter)}
              </p>
            </article>
          ))}
          {!movements.length && <p className="text-sm text-zinc-500">Todavía no hay ajustes registrados.</p>}
        </div>
      </section>
    </section>
  );
}
