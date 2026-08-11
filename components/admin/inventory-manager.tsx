"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import Swal from "sweetalert2";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { stockMovementTypeLabels } from "@/lib/order-stock";

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
}: {
  branches: Branch[];
  products: Product[];
  initialStocks: Stock[];
  movements: Movement[];
}) {
  const [branchId, setBranchId] = useState(branches[0]?.id ?? 0);
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
    const response = await fetch("/api/admin/inventory", {
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
      <div className="card mt-6 grid gap-3 p-4 sm:grid-cols-[220px_1fr_auto]">
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
      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        {visible.map((product) => {
          const stock = stocks.find((item) => item.branchId === branchId && item.productId === product.id);
          const low = stock?.tracked && Number(stock.current) <= Number(stock.minimum);
          return (
            <form
              key={`${branchId}-${product.id}`}
              className={`card grid gap-4 p-4 sm:grid-cols-[72px_1fr] ${low ? "border-amber-500/40" : ""}`}
              onSubmit={(event) => {
                event.preventDefault();
                void save(product, event.currentTarget);
              }}
            >
              <div className="relative h-18 overflow-hidden rounded-xl bg-white/5">
                <Image
                  src={`/images/images_product/${product.imageUrl}`}
                  alt=""
                  fill
                  sizes="72px"
                  className="object-contain p-2"
                />
              </div>
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong>{product.name}</strong>
                  {low && (
                    <span className="rounded-full bg-amber-500/15 px-2 py-1 text-xs font-black text-amber-300">
                      Bajo mínimo
                    </span>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <label className="text-xs text-zinc-500">
                    Actual
                    <input
                      className="input mt-1 py-2"
                      name="current"
                      type="number"
                      min="0"
                      step="0.001"
                      defaultValue={Number(stock?.current ?? 0)}
                    />
                  </label>
                  <label className="text-xs text-zinc-500">
                    Mínimo
                    <input
                      className="input mt-1 py-2"
                      name="minimum"
                      type="number"
                      min="0"
                      step="0.001"
                      defaultValue={Number(stock?.minimum ?? 0)}
                    />
                  </label>
                  <label className="text-xs text-zinc-500">
                    Unidad
                    <input className="input mt-1 py-2" name="unit" defaultValue={stock?.unit ?? "unidad"} />
                  </label>
                  <button className="btn self-end py-2">Guardar</button>
                </div>
                <label className="mt-3 flex items-center gap-2 text-sm">
                  <input name="tracked" type="checkbox" defaultChecked={stock?.tracked ?? false} /> Descontar
                  automáticamente al pedir
                </label>
              </div>
            </form>
          );
        })}
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
