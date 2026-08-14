"use client";

import { useState } from "react";
import Swal from "sweetalert2";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { orderStatusLabel, type OrderStatus } from "@/lib/orders";
import { scopedFetch } from "@/lib/client-routing";

export type KitchenOrderItem = {
  id: number;
  productName: string;
  quantity: number;
  variantName: string | null;
  extras: unknown;
  notes: string | null;
};

export type KitchenOrder = {
  id: number;
  reference: string;
  status: string;
  orderType: string;
  customerName: string;
  table: { name: string; code: string } | null;
  createdAt: string;
  items: KitchenOrderItem[];
};

/** @summary Convierte el JSON de agregados de una línea en texto legible. */
function extrasText(value: unknown) {
  if (!Array.isArray(value) || !value.length) return "";
  return value
    .map((extra) =>
      typeof extra === "object" && extra && typeof (extra as { name?: unknown }).name === "string"
        ? (extra as { name: string }).name
        : "",
    )
    .filter(Boolean)
    .join(", ");
}

/** @summary Muestra el tiempo transcurrido desde un momento en lenguaje operativo. */
function elapsedLabel(createdAt: string) {
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000));
  if (elapsedMinutes < 1) return "0 min";
  if (elapsedMinutes < 60) return `${elapsedMinutes} min`;
  const hours = Math.floor(elapsedMinutes / 60);
  return `${hours} h ${elapsedMinutes % 60} min`;
}

const modalityLabel: Record<string, string> = {
  takeaway: "Retiro",
  dine_in: "Mesa",
  delivery: "Delivery",
};

/** @summary Vista pensada para el monitor de cocina: tarjetas grandes y dos acciones. */
export function KitchenBoard({ initialOrders }: { initialOrders: KitchenOrder[] }) {
  const [orders, setOrders] = useState(initialOrders);

  /** @summary Avanza el estado de un plato desde cocina y sincroniza la pantalla. */
  async function advance(order: KitchenOrder, status: OrderStatus) {
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
  }

  const waiting = orders.filter((order) => order.status === "received" || order.status === "confirmed");
  const cooking = orders.filter((order) => order.status === "preparing");

  return (
    <section>
      <AdminPageHeader
        eyebrow="Operación"
        title="Cocina"
        description="Trabajá lo que hay que preparar ahora. Tocá para empezar y avisá cuando esté listo."
        section="cocina"
        actions={
          <span className="text-sm font-bold text-zinc-500">
            {waiting.length + cooking.length} pedidos en preparación
          </span>
        }
      />

      {orders.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/[.02] p-10 text-center">
          <p className="text-xl font-black">No hay pedidos para preparar</p>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-zinc-500">
            Los pedidos confirmados aparecerán acá cuando entren. Podés seguir atendiendo desde la
            vista de Pedidos.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="min-w-0">
            <header className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-black text-sky-300">Esperando empezar</h2>
              <span className="rounded-full bg-white/5 px-3 py-1 text-xs">{waiting.length}</span>
            </header>
            <div className="grid gap-4 sm:grid-cols-2">
              {waiting.map((order) => (
                <KitchenCard key={order.id} order={order}>
                  <button
                    className="btn w-full py-4 text-lg font-black"
                    onClick={() => void advance(order, "preparing")}
                    type="button"
                  >
                    EMPEZAR
                  </button>
                </KitchenCard>
              ))}
              {!waiting.length && (
                <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-zinc-600 sm:col-span-2">
                  Nada esperando en este momento.
                </p>
              )}
            </div>
          </section>

          <section className="min-w-0">
            <header className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-black text-amber-300">En preparación</h2>
              <span className="rounded-full bg-white/5 px-3 py-1 text-xs">{cooking.length}</span>
            </header>
            <div className="grid gap-4 sm:grid-cols-2">
              {cooking.map((order) => (
                <KitchenCard key={order.id} order={order}>
                  <button
                    className="btn w-full py-4 text-lg font-black"
                    onClick={() => void advance(order, "ready")}
                    type="button"
                  >
                    LISTO
                  </button>
                </KitchenCard>
              ))}
              {!cooking.length && (
                <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-zinc-600 sm:col-span-2">
                  Nada en preparación en este momento.
                </p>
              )}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

/** @summary Tarjeta grande y legible para la cocina con pedido, tiempo y productos. */
function KitchenCard({ order, children }: { order: KitchenOrder; children: React.ReactNode }) {
  const modalLabel = modalityLabel[order.orderType] ?? order.orderType;
  return (
    <article
      className={`rounded-3xl border p-5 shadow-2xl shadow-black/30 ${
        order.status === "preparing"
          ? "border-amber-500/30 bg-amber-500/[.04]"
          : "border-sky-500/30 bg-sky-500/[.04]"
      }`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-widest text-[var(--admin-primary)]">
            {order.reference}
          </p>
          <p className="mt-1 truncate text-sm font-bold">{order.customerName}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-sm font-black ${
            order.status === "preparing" ? "bg-amber-500/15 text-amber-300" : "bg-sky-500/15 text-sky-300"
          }`}
        >
          {elapsedLabel(order.createdAt)}
        </span>
      </header>
      <p className="mt-1 text-xs text-zinc-500">
        {modalLabel}
        {order.table ? ` · ${order.table.name}` : ""} · {orderStatusLabel(order.status)}
      </p>
      <div className="mt-4 space-y-3">
        {order.items.map((item) => {
          const extras = extrasText(item.extras);
          return (
            <div className="flex items-start gap-3" key={item.id}>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/10 text-sm font-black">
                {item.quantity}
              </span>
              <div className="min-w-0">
                <p className="text-base font-bold leading-tight">{item.productName}</p>
                {item.variantName && <p className="text-sm text-zinc-300">{item.variantName}</p>}
                {extras && <p className="text-sm text-zinc-400">+ {extras}</p>}
                {item.notes && <p className="text-sm italic text-amber-200/80">{item.notes}</p>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-5">{children}</div>
    </article>
  );
}
