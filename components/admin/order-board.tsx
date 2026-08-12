"use client";

import { useMemo, useState } from "react";
import Swal from "sweetalert2";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { allowedTransitions, asOrderType } from "@/lib/order-status";
import { orderStatuses, orderStatusLabel, type OrderStatus } from "@/lib/orders";
import { scopedFetch } from "@/lib/client-routing";

export type AdminOrderItem = {
  id: number;
  productName: string;
  quantity: number;
  variantName: string | null;
  extras: unknown;
  notes: string | null;
  lineTotal: string | number;
};

export type AdminOrder = {
  id: number;
  reference: string;
  status: string;
  orderType: string;
  customerName: string;
  phone: string;
  email: string | null;
  notes: string | null;
  total: string | number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  table: { name: string; code: string } | null;
  items: AdminOrderItem[];
};
const statusStyle: Record<string, string> = {
  received: "border-sky-500/30 bg-sky-500/5",
  confirmed: "border-indigo-500/30 bg-indigo-500/5",
  preparing: "border-amber-500/30 bg-amber-500/5",
  ready: "border-pink-500/30 bg-pink-500/5",
  on_the_way: "border-violet-500/30 bg-violet-500/5",
  delivered: "border-emerald-500/30 bg-emerald-500/5",
  cancelled: "border-red-500/30 bg-red-500/5",
};

/** @summary Formatea los importes del tablero según la moneda registrada en cada pedido. */
function formatPrice(value: string | number, currency: string) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency }).format(Number(value));
}

/** @summary Traduce la modalidad técnica del pedido a una descripción operativa. */
function orderTypeLabel(type: string) {
  return { takeaway: "Retiro", dine_in: "En mesa", delivery: "Delivery" }[type] ?? type;
}

/** @summary Gestiona pedidos en columnas, permite filtrarlos y avanzar su estado sin recargar. */
export function OrderBoard({ initialOrders }: { initialOrders: AdminOrder[] }) {
  const [orders, setOrders] = useState(initialOrders);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<AdminOrder | null>(null);
  const visibleOrders = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");
    if (!normalized) return orders;
    return orders.filter((order) =>
      `${order.reference} ${order.customerName} ${order.phone} ${order.table?.name ?? ""}`
        .toLocaleLowerCase("es")
        .includes(normalized),
    );
  }, [orders, query]);

  /** @summary Solicita un cambio de estado y sincroniza el resultado con todas las vistas del tablero. */
  async function updateStatus(order: AdminOrder, status: OrderStatus) {
    if (order.status === status) return;
    const response = await scopedFetch(`/api/admin/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      await Swal.fire({
        title: "No se pudo actualizar",
        text: result.error ?? "Intentá nuevamente.",
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
      return;
    }
    setOrders((current) => current.map((item) => (item.id === order.id ? { ...item, status } : item)));
    setSelected((current) => (current?.id === order.id ? { ...current, status } : current));
  }

  return (
    <section>
      <AdminPageHeader
        eyebrow="Operación"
        title="Pedidos"
        description="Cada pedido queda almacenado con precios verificados e historial de estados."
        section="pedidos"
        actions={
          <label className="block w-full min-w-[240px]">
            <span className="sr-only">Buscar pedidos</span>
            <input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar referencia, cliente o mesa" type="search" />
          </label>
        }
      />

      <div className="flex snap-x gap-5 overflow-x-auto pb-5 [scrollbar-color:var(--admin-primary)_transparent]">
        {orderStatuses.map((status) => {
          const statusOrders = visibleOrders.filter((order) => order.status === status);
          return (
            <section
              className={`w-[min(86vw,360px)] shrink-0 snap-start rounded-3xl border p-4 ${statusStyle[status]}`}
              key={status}
            >
              <header className="mb-3 flex items-center justify-between px-2 py-1">
                <h2 className="font-black">{orderStatusLabel(status)}</h2>
                <span className="rounded-full bg-black/30 px-2.5 py-1 text-xs">{statusOrders.length}</span>
              </header>
              <div className="max-h-[64vh] space-y-3 overflow-y-auto pr-1">
                {statusOrders.map((order) => (
                  <article
                    className="rounded-2xl border border-white/10 bg-zinc-950 p-4 shadow-xl"
                    key={order.id}
                  >
                    <button
                      className="block w-full text-left"
                      onClick={() => setSelected(order)}
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-black uppercase tracking-wider text-pink-300">
                            {order.reference}
                          </p>
                          <h3 className="mt-1 font-black">{order.customerName}</h3>
                        </div>
                        <strong>{formatPrice(order.total, order.currency)}</strong>
                      </div>
                      <p className="mt-2 text-xs text-zinc-500">
                        {orderTypeLabel(order.orderType)}
                        {order.table ? ` · ${order.table.name}` : ""} ·{" "}
                        {order.items.reduce((sum, item) => sum + item.quantity, 0)} ítems
                      </p>
                      <time className="mt-2 block text-xs text-zinc-600">
                        {new Date(order.createdAt).toLocaleString("es-AR")}
                      </time>
                    </button>
                    <select
                      className="input mt-3 py-2 text-sm"
                      value={order.status}
                      onChange={(event) => updateStatus(order, event.target.value as OrderStatus)}
                      aria-label={`Estado de ${order.reference}`}
                    >
                      <option value={order.status}>{orderStatusLabel(order.status)}</option>
                      {allowedTransitions(order.status as OrderStatus, asOrderType(order.orderType)).map(
                        (candidate) => (
                          <option key={candidate} value={candidate}>
                            {orderStatusLabel(candidate)}
                          </option>
                        ),
                      )}
                    </select>
                  </article>
                ))}
                {!statusOrders.length && (
                  <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-xs text-zinc-600">
                     No hay pedidos en {orderStatusLabel(status).toLocaleLowerCase("es")}.
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-[120] grid place-items-center bg-black/80 p-4 backdrop-blur"
          onClick={() => setSelected(null)}
        >
          <article
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Pedido ${selected.reference}`}
          >
            <header className="flex items-start justify-between gap-4">
              <div>
                <p className="section-eyebrow">{selected.reference}</p>
                <h2 className="mt-2 text-3xl font-black">{selected.customerName}</h2>
                <p className="text-zinc-400">
                  {selected.phone} · {orderTypeLabel(selected.orderType)}
                </p>
              </div>
              <button
                className="grid h-10 w-10 place-items-center rounded-full bg-white/5 text-xl"
                onClick={() => setSelected(null)}
                aria-label="Cerrar"
              >
                ×
              </button>
            </header>
            <div className="mt-6 space-y-3">
              {selected.items.map((item) => (
                <div className="flex justify-between gap-4 rounded-2xl bg-white/5 p-4" key={item.id}>
                  <div>
                    <strong>
                      {item.quantity} × {item.productName}
                    </strong>
                    {item.variantName && <p className="text-sm text-zinc-400">{item.variantName}</p>}
                    {item.notes && <p className="text-sm text-zinc-500">{item.notes}</p>}
                  </div>
                  <strong>{formatPrice(item.lineTotal, selected.currency)}</strong>
                </div>
              ))}
            </div>
            {selected.notes && (
              <div className="mt-5 rounded-2xl border border-white/10 p-4 whitespace-pre-line text-sm text-zinc-300">
                {selected.notes}
              </div>
            )}
            <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]">
              <select
                className="input"
                value={selected.status}
                onChange={(event) => updateStatus(selected, event.target.value as OrderStatus)}
              >
                <option value={selected.status}>{orderStatusLabel(selected.status)}</option>
                {allowedTransitions(selected.status as OrderStatus, asOrderType(selected.orderType)).map(
                  (candidate) => (
                    <option key={candidate} value={candidate}>
                      {orderStatusLabel(candidate)}
                    </option>
                  ),
                )}
              </select>
              <a
                className="btn"
                href={`https://wa.me/${selected.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Hola ${selected.customerName}, te contactamos por tu pedido ${selected.reference}.`)}`}
                target="_blank"
                rel="noreferrer"
              >
                WhatsApp
              </a>
            </div>
          </article>
        </div>
      )}
    </section>
  );
}
