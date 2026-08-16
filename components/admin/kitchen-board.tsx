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
  phone: string;
  notes: string | null;
  table: { name: string; code: string } | null;
  createdAt: string;
  items: KitchenOrderItem[];
  history: Array<{ id: number; toStatus: string; note: string | null; createdAt: string }>;
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

/**
 * @summary Formatea un valor para mostrarlo en el tablero de cocina.
 */
function hourLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

const modalityLabel: Record<string, string> = {
  takeaway: "Retiro",
  dine_in: "Mesa",
  delivery: "Delivery",
};

const modalityIcon: Record<string, string> = {
  takeaway: "🛍",
  dine_in: "🍽",
  delivery: "🛵",
};

const statusColors: Record<string, string> = {
  received: "bg-sky-500/15 text-sky-300",
  confirmed: "bg-sky-500/15 text-sky-300",
  preparing: "bg-amber-500/15 text-amber-300",
  ready: "bg-emerald-500/15 text-emerald-300",
};

/** @summary Monitor de cocina: tarjetas ricas con detalle y acciones grandes para tablet. */
export function KitchenBoard({ initialOrders }: { initialOrders: KitchenOrder[] }) {
  const [orders, setOrders] = useState(initialOrders);
  const [detail, setDetail] = useState<KitchenOrder | null>(null);

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
    const updated = { ...order, status };
    setOrders((current) => current.map((item) => (item.id === order.id ? updated : item)));
    setDetail((current) => (current?.id === order.id ? updated : current));
  }

  const waiting = orders.filter((order) => order.status === "received" || order.status === "confirmed");
  const cooking = orders.filter((order) => order.status === "preparing");

  return (
    <section>
      <AdminPageHeader
        eyebrow="Operación"
        title="Cocina"
        description="Trabajá lo que hay que preparar ahora. Tocá una tarjeta para ver el detalle completo."
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
            Los pedidos confirmados aparecerán acá cuando entren. Podés seguir atendiendo desde la vista de
            Pedidos.
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
                <KitchenCard
                  key={order.id}
                  order={order}
                  onOpen={() => setDetail(order)}
                  action={
                    <button
                      className="btn w-full py-4 text-lg font-black"
                      onClick={() => void advance(order, "preparing")}
                      type="button"
                    >
                      EMPEZAR
                    </button>
                  }
                />
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
                <KitchenCard
                  key={order.id}
                  order={order}
                  onOpen={() => setDetail(order)}
                  action={
                    <button
                      className="btn w-full py-4 text-lg font-black"
                      onClick={() => void advance(order, "ready")}
                      type="button"
                    >
                      LISTO
                    </button>
                  }
                />
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

      {detail && <OrderDetailModal order={detail} onClose={() => setDetail(null)} onAdvance={advance} />}
    </section>
  );
}

/** @summary Tarjeta compacta con los datos operativos esenciales y la acción principal. */
function KitchenCard({
  order,
  onOpen,
  action,
}: {
  order: KitchenOrder;
  onOpen: () => void;
  action: React.ReactNode;
}) {
  const modalLabel = modalityLabel[order.orderType] ?? order.orderType;
  const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const importantNote = order.notes?.trim();
  return (
    <article
      className={`relative rounded-3xl border p-5 shadow-2xl shadow-black/30 ${
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
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
        <span className="font-bold text-zinc-300">
          {modalityIcon[order.orderType] ?? ""} {modalLabel}
          {order.table ? ` · ${order.table.name}` : ""}
        </span>
        <span>· {hourLabel(order.createdAt)}</span>
        <span className="rounded-full bg-white/5 px-2 py-0.5 font-bold text-zinc-300">
          {totalItems} {totalItems === 1 ? "ítem" : "ítems"}
        </span>
        <span className={`rounded-full px-2 py-0.5 font-bold ${statusColors[order.status]}`}>
          {orderStatusLabel(order.status)}
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {order.items.slice(0, 3).map((item) => {
          const extras = extrasText(item.extras);
          return (
            <div className="flex items-start gap-2.5" key={item.id}>
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/10 text-xs font-black">
                {item.quantity}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold leading-tight">{item.productName}</p>
                {item.variantName && <p className="text-xs text-zinc-300">{item.variantName}</p>}
                {extras && <p className="text-xs text-zinc-400">+ {extras}</p>}
              </div>
            </div>
          );
        })}
        {order.items.length > 3 && (
          <p className="text-xs font-bold text-zinc-500">+{order.items.length - 3} productos más</p>
        )}
        {importantNote && (
          <p className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-2.5 py-1.5 text-xs font-bold text-amber-200">
            ⚠ {importantNote.slice(0, 90)}
            {importantNote.length > 90 ? "…" : ""}
          </p>
        )}
      </div>
      <div className="mt-4 flex gap-2">
        <button className="btn btn-secondary flex-1" onClick={onOpen} type="button">
          Ver detalle
        </button>
      </div>
      <div className="mt-2">{action}</div>
    </article>
  );
}

/** @summary Modal de detalle con todos los productos, modalidad, cliente y línea de tiempo. */
function OrderDetailModal({
  order,
  onClose,
  onAdvance,
}: {
  order: KitchenOrder;
  onClose: () => void;
  onAdvance: (order: KitchenOrder, status: OrderStatus) => Promise<void>;
}) {
  const modalLabel = modalityLabel[order.orderType] ?? order.orderType;
  const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);
  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/85 p-4"
      onClick={onClose}
    >
      <article
        className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-zinc-950 p-6 sm:p-8"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="section-eyebrow">{order.reference}</p>
            <h2 className="mt-1 text-3xl font-black">{order.customerName}</h2>
            <p className="mt-1 text-sm text-zinc-400">
              {modalLabel}
              {order.table ? ` · Mesa ${order.table.name}` : ""} · {hourLabel(order.createdAt)}
            </p>
          </div>
          <div className="text-right">
            <span className={`rounded-full px-3 py-1 text-xs font-black ${statusColors[order.status]}`}>
              {orderStatusLabel(order.status)}
            </span>
            <p className="mt-2 text-sm font-bold text-zinc-300">{elapsedLabel(order.createdAt)}</p>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500">
            Productos · {totalItems} {totalItems === 1 ? "ítem" : "ítems"}
          </h3>
          <div className="mt-3 space-y-3">
            {order.items.map((item) => {
              const extras = extrasText(item.extras);
              return (
                <div className="rounded-xl bg-white/[.03] p-3" key={item.id}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-bold">{item.productName}</p>
                    <span className="shrink-0 rounded-lg bg-white/10 px-2 py-1 text-sm font-black">
                      ×{item.quantity}
                    </span>
                  </div>
                  {item.variantName && <p className="mt-1 text-sm text-zinc-300">{item.variantName}</p>}
                  {extras && <p className="mt-1 text-sm text-zinc-400">+ {extras}</p>}
                  {item.notes && <p className="mt-1 text-sm italic text-amber-200/80">{item.notes}</p>}
                </div>
              );
            })}
          </div>
        </div>

        {order.notes && (
          <div className="mt-5 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3">
            <p className="text-xs font-black uppercase tracking-widest text-amber-300">
              Observación del pedido
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-amber-100">{order.notes}</p>
          </div>
        )}

        {order.history.length > 0 && (
          <div className="mt-5">
            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500">Línea de tiempo</h3>
            <ol className="mt-3 space-y-2">
              {order.history.map((entry) => (
                <li className="flex items-center gap-3 text-sm" key={entry.id}>
                  <span className="grid h-2 w-2 shrink-0 rounded-full bg-pink-500" />
                  <span className="font-bold">{orderStatusLabel(entry.toStatus)}</span>
                  <span className="text-zinc-500">{hourLabel(entry.createdAt)}</span>
                  {entry.note && <span className="text-zinc-400">· {entry.note}</span>}
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          {order.status !== "preparing" && (
            <button
              className="btn py-4 text-lg font-black"
              onClick={() => void onAdvance(order, "preparing")}
              type="button"
            >
              EMPEZAR PREPARACIÓN
            </button>
          )}
          {order.status !== "ready" && (
            <button
              className="btn py-4 text-lg font-black"
              onClick={() => void onAdvance(order, "ready")}
              type="button"
            >
              MARCAR LISTO
            </button>
          )}
        </div>
        <button className="btn btn-secondary mt-4 w-full" onClick={onClose} type="button">
          Cerrar
        </button>
      </article>
    </div>
  );
}
