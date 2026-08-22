"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import {
  PageHeader,
  SectionHeader,
  StatusBadge,
  EmptyState,
  FormSection,
  DocumentLines,
  RelatedDocuments,
  NumberFlow,
} from "@/components/admin/ui";
import { allowedTransitions, asOrderType } from "@/lib/order-status";
import { orderStatuses, orderStatusLabel, type OrderStatus } from "@/lib/orders";
import { deliveryStatusMeta } from "@/lib/delivery-drivers";
import { scopedFetch } from "@/lib/client-routing";
import { adminHrefFromPathname, parseCanonicalPath, publicHrefForContext } from "@/lib/routes";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/admin/ui/icons";
import { CopyTrackingLink } from "@/components/orders/copy-tracking-link";

export type AdminOrderItem = {
  id: number;
  productName: string;
  quantity: number;
  deliveredQuantity: number;
  pendingQuantity: number | null;
  unitPrice: string | number;
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
  deliveryAddress: string | null;
  requestedAt: string | null;
  subtotal: string | number;
  discount: string | number;
  deliveryFee: string | number;
  tip: string | number;
  total: string | number;
  currency: string;
  paymentMethod: string;
  paymentStatus: string;
  source: string;
  trackingToken: string | null;
  createdAt: string;
  updatedAt: string;
  table: { name: string; code: string } | null;
  branch: { name: string; slug: string } | null;
  invoice: { id: number; number: string | null; status: string } | null;
  items: AdminOrderItem[];
  history: Array<{
    id: number;
    fromStatus: string | null;
    toStatus: string;
    note: string | null;
    createdAt: string;
  }>;
  delivery?: {
    id: number;
    number: string;
    status: string;
    driverProfile?: { name: string } | null;
  } | null;
  _count: { deliveries: number; payments: number };
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

const modalityStyle: Record<string, string> = {
  takeaway: "bg-cyan-500/15 text-cyan-300",
  dine_in: "bg-orange-500/15 text-orange-300",
  delivery: "bg-violet-500/15 text-violet-300",
};

const modalityLabel: Record<string, string> = {
  takeaway: "Retiro",
  dine_in: "Mesa",
  delivery: "Delivery",
};

type OrderTypeFilter = "all" | "dine_in" | "takeaway" | "delivery";

/** @summary Formatea los importes del tablero según la moneda registrada en cada pedido. */
function formatPrice(value: string | number, currency: string) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency }).format(Number(value));
}

/** @summary Traduce la modalidad técnica del pedido a una etiqueta operativa. */
function orderTypeLabel(type: string) {
  return modalityLabel[type] ?? type;
}

/** @summary Muestra el tiempo transcurrido desde un momento en lenguaje operativo. */
function elapsedLabel(createdAt: string) {
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000));
  if (elapsedMinutes < 1) return "recién recibido";
  if (elapsedMinutes < 60) return `hace ${elapsedMinutes} min`;
  const hours = Math.floor(elapsedMinutes / 60);
  const minutes = elapsedMinutes % 60;
  return minutes ? `hace ${hours} h ${minutes} min` : `hace ${hours} h`;
}

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
    .join(" · ");
}

/** @summary Gestiona pedidos en columnas, permite filtrarlos y avanzar su estado sin recargar. */
export function OrderBoard({ initialOrders }: { initialOrders: AdminOrder[] }) {
  const pathname = usePathname();
  const [orders, setOrders] = useState(initialOrders);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<OrderTypeFilter>("all");
  const [selected, setSelected] = useState<AdminOrder | null>(null);
  const [draggedOrderId, setDraggedOrderId] = useState<number | null>(null);
  const [dragTarget, setDragTarget] = useState<OrderStatus | null>(null);

  /** @summary Abre el detalle del pedido indicado por `?id=` al cargar la página. */
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("id");
    if (!raw) return;
    const id = Number(raw);
    if (!Number.isInteger(id)) return;
    const found = orders.find((order) => order.id === id);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (found) setSelected(found);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleOrders = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");
    return orders.filter((order) => {
      if (typeFilter !== "all" && order.orderType !== typeFilter) return false;
      if (!normalized) return true;
      return `${order.reference} ${order.customerName} ${order.phone} ${order.table?.name ?? ""} ${order.email ?? ""}`
        .toLocaleLowerCase("es")
        .includes(normalized);
    });
  }, [orders, query, typeFilter]);

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
    const now = new Date().toISOString();
    setOrders((current) =>
      current.map((item) =>
        item.id === order.id
          ? {
              ...item,
              status,
              history: [
                ...item.history,
                { id: Date.now(), fromStatus: item.status, toStatus: status, note: null, createdAt: now },
              ],
            }
          : item,
      ),
    );
    setSelected((current) =>
      current?.id === order.id
        ? {
            ...current,
            status,
            history: [
              ...current.history,
              { id: Date.now(), fromStatus: current.status, toStatus: status, note: null, createdAt: now },
            ],
          }
        : current,
    );
  }

  /** @summary Valida y aplica un cambio de columna iniciado por drag and drop. */
  async function dropOrder(target: OrderStatus) {
    const order = orders.find((item) => item.id === draggedOrderId);
    setDragTarget(null);
    setDraggedOrderId(null);
    if (!order || order.status === target) return;
    const valid = allowedTransitions(order.status as OrderStatus, asOrderType(order.orderType)).includes(
      target,
    );
    if (!valid) return;
    await updateStatus(order, target);
  }

  /** @summary Crea un comprobante para el pedido y habilita la vista de impresión. */
  async function createInvoice(order: AdminOrder) {
    const response = await scopedFetch("/api/admin/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: order.id }),
    });
    const body = (await response.json().catch(() => ({}))) as {
      invoice?: { id: number; number: string | null; status: string };
      error?: string;
    };
    if (!response.ok || !body.invoice) {
      await Swal.fire({
        title: "No se pudo crear el comprobante",
        text: body.error ?? "Intentá nuevamente.",
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
      return;
    }
    setOrders((current) =>
      current.map((item) => (item.id === order.id ? { ...item, invoice: body.invoice! } : item)),
    );
    setSelected((current) => (current?.id === order.id ? { ...current, invoice: body.invoice! } : current));
    await Swal.fire({
      title: "Comprobante creado",
      text: `${body.invoice.number ?? "Comprobante"} listo para ver o imprimir.`,
      icon: "success",
      confirmButtonText: "Ver",
      cancelButtonText: "Después",
      showCancelButton: true,
      confirmButtonColor: "#ec4899",
      background: "#18181b",
      color: "#fafafa",
    }).then((result) => {
      if (result.isConfirmed) {
        window.location.href = adminHrefFromPathname(pathname, `/admin/facturacion/${body.invoice!.id}`);
      }
    });
  }

  /** @summary Anula el comprobante del pedido después de una confirmación explícita. */
  async function cancelInvoice(order: AdminOrder) {
    const confirmation = await Swal.fire({
      title: "¿Anular el comprobante?",
      text: "El comprobante quedará anulado y sin validez operativa.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Anular",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ef4444",
      background: "#18181b",
      color: "#fafafa",
    });
    if (!confirmation.isConfirmed || !order.invoice) return;
    const response = await scopedFetch(`/api/admin/invoices/${order.invoice.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    const body = (await response.json().catch(() => ({}))) as {
      invoice?: { id: number; number: string | null; status: string };
      error?: string;
    };
    if (!response.ok || !body.invoice) {
      await Swal.fire({
        title: "No se pudo anular",
        text: body.error ?? "Intentá nuevamente.",
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
      return;
    }
    const update = (item: AdminOrder) =>
      item.id === order.id ? { ...item, invoice: { ...item.invoice!, ...body.invoice! } } : item;
    setOrders((current) => current.map(update));
    setSelected((current) => (current?.id === order.id ? update(current) : current));
  }

  const nextStatus = (order: AdminOrder) =>
    allowedTransitions(order.status as OrderStatus, asOrderType(order.orderType)).find(
      (status) => status !== "cancelled",
    );

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Operación"
        title="Pedidos"
        description="Un pedido es una compra de tus clientes. Mesa, retiro y delivery son solo la forma en que lo reciben."
        section="pedidos"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link className="btn btn-secondary" href={adminHrefFromPathname(pathname, "/admin/cocina")}>
              Cocina
            </Link>
            <div className="relative">
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar…"
                className="w-48 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 pl-8 text-xs text-zinc-300 outline-none transition-colors placeholder:text-zinc-500 focus:border-white/20 focus:bg-white/[.07]"
              />
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-zinc-500">
                <Icon name="search" className="h-3.5 w-3.5" />
              </span>
            </div>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-1.5">
        {(
          [
            { value: "all", label: "Todos" },
            { value: "dine_in", label: "Mesa" },
            { value: "takeaway", label: "Retiro" },
            { value: "delivery", label: "Delivery" },
          ] as Array<{ value: OrderTypeFilter; label: string }>
        ).map((option) => (
          <button
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
              typeFilter === option.value
                ? "bg-[var(--admin-primary-strong)]/15 text-[var(--admin-primary-strong)] ring-1 ring-[var(--admin-primary-strong)]/30"
                : "bg-white/5 text-zinc-400 hover:text-zinc-200"
            }`}
            key={option.value}
            onClick={() => setTypeFilter(option.value)}
            type="button"
          >
            {option.label}
            <span className="ml-1.5 text-[10px] opacity-60">
              <NumberFlow
                value={
                  orders.filter((order) => option.value === "all" || order.orderType === option.value).length
                }
              />
            </span>
          </button>
        ))}
      </div>

      {orders.length === 0 ? (
        <EmptyState
          title="Todavía no recibiste pedidos"
          description="Los pedidos que hagan tus clientes desde la carta aparecerán acá. También podés probar con una orden de prueba usando el enlace público de tu carta."
          action={
            <Link className="btn mt-6" href={adminHrefFromPathname(pathname, "/admin")}>
              Ir al resumen
            </Link>
          }
        />
      ) : (
        <div className="flex snap-x gap-5 overflow-x-auto pb-5 [scrollbar-color:var(--admin-primary)_transparent]">
          {" "}
          {orderStatuses.map((status) => {
            const statusOrders = visibleOrders.filter((order) => order.status === status);
            return (
              <section
                className={`flex max-h-[calc(100dvh-17rem)] w-[min(86vw,320px)] shrink-0 snap-start flex-col overflow-hidden rounded-xl border shadow-[var(--admin-shadow-sm)] transition-[border-color,background-color,box-shadow] duration-150 ${statusStyle[status]} ${
                  dragTarget === status
                    ? "border-[var(--admin-primary)]/70 bg-[var(--admin-primary-soft)] shadow-[0_0_0_3px_var(--admin-primary-soft)]"
                    : ""
                }`}
                key={status}
                onDragOver={(event) => {
                  const order = orders.find((item) => item.id === draggedOrderId);
                  if (!order) return;
                  const valid = allowedTransitions(
                    order.status as OrderStatus,
                    asOrderType(order.orderType),
                  ).includes(status);
                  if (!valid) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setDragTarget(status);
                }}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragTarget(null);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  void dropOrder(status);
                }}
              >
                <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[.06] bg-[var(--admin-surface)] px-3 py-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                    {orderStatusLabel(status)}
                  </h3>
                  <span className="rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-elevated)] px-2 py-0.5 text-[10px] font-bold text-zinc-400">
                    <NumberFlow value={statusOrders.length} />
                  </span>
                </header>
                <div className="admin-custom-scroll min-h-28 flex-1 space-y-2 overflow-y-auto overscroll-contain p-2.5">
                  {dragTarget === status && draggedOrderId !== null && (
                    <div className="rounded-lg border border-dashed border-[var(--admin-primary)]/60 bg-[var(--admin-primary-soft)] p-3 text-center text-[11px] font-semibold text-[var(--admin-primary)]">
                      Soltar para mover a {orderStatusLabel(status).toLocaleLowerCase("es")}
                    </div>
                  )}
                  {statusOrders.map((order) => (
                    <article
                      className={`admin-row-enter rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3 shadow-[var(--admin-shadow-sm)] transition-[transform,opacity,border-color,box-shadow] duration-150 hover:-translate-y-0.5 hover:border-[var(--admin-border-strong)] hover:shadow-[var(--admin-shadow-md)] ${
                        draggedOrderId === order.id
                          ? "scale-[1.02] border-[var(--admin-primary)]/60 opacity-55 shadow-xl"
                          : ""
                      }`}
                      key={order.id}
                      draggable={
                        allowedTransitions(order.status as OrderStatus, asOrderType(order.orderType)).length >
                        0
                      }
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", String(order.id));
                        setDraggedOrderId(order.id);
                      }}
                      onDragEnd={() => {
                        setDraggedOrderId(null);
                        setDragTarget(null);
                      }}
                      aria-grabbed={draggedOrderId === order.id}
                    >
                      <button
                        className="block w-full text-left"
                        onClick={() => setSelected(order)}
                        type="button"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--admin-primary-strong)]">
                                {order.reference}
                              </p>
                              <span className="text-[10px] text-zinc-500">
                                {elapsedLabel(order.createdAt)}
                              </span>
                            </div>
                            <h3 className="mt-0.5 truncate text-sm font-bold text-white">
                              {order.customerName}
                            </h3>
                          </div>
                          <span className="shrink-0 text-sm font-bold tabular-nums text-white">
                            {formatPrice(order.total, order.currency)}
                          </span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${modalityStyle[order.orderType]}`}
                          >
                            {orderTypeLabel(order.orderType)}
                            {order.table ? ` ${order.table.name}` : ""}
                          </span>
                          <span className="text-[10px] text-zinc-500">
                            {order.items.reduce((sum, item) => sum + item.quantity, 0)} items
                          </span>
                        </div>
                      </button>
                      {nextStatus(order) && (
                        <div className="mt-2.5">
                          <button
                            className="w-full rounded-lg bg-[var(--admin-primary-strong)]/15 px-3 py-1.5 text-xs font-bold text-[var(--admin-primary-strong)] transition-colors hover:bg-[var(--admin-primary-strong)]/25"
                            onClick={() => void updateStatus(order, nextStatus(order)!)}
                            type="button"
                          >
                            {nextStatus(order) === "confirmed"
                              ? "Confirmar"
                              : nextStatus(order) === "preparing"
                                ? "Empezar"
                                : nextStatus(order) === "ready"
                                  ? "Listo"
                                  : nextStatus(order) === "on_the_way"
                                    ? "Enviar"
                                    : "Entregar"}
                          </button>
                        </div>
                      )}
                    </article>
                  ))}
                  {!statusOrders.length && (
                    <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-xs text-zinc-600">
                      No hay pedidos {orderStatusLabel(status).toLocaleLowerCase("es")}.
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {selected && (
        <OrderDetail
          order={selected}
          onClose={() => setSelected(null)}
          onStatusChange={updateStatus}
          onCreateInvoice={createInvoice}
          onCancelInvoice={cancelInvoice}
        />
      )}
    </section>
  );
}

/** @summary Presenta el detalle completo de un pedido con cliente, entrega, productos, importes y avance. */
function OrderDetail({
  order,
  onClose,
  onStatusChange,
  onCreateInvoice,
  onCancelInvoice,
}: {
  order: AdminOrder;
  onClose: () => void;
  onStatusChange: (order: AdminOrder, status: OrderStatus) => Promise<void>;
  onCreateInvoice: (order: AdminOrder) => Promise<void>;
  onCancelInvoice: (order: AdminOrder) => Promise<void>;
}) {
  const pathname = usePathname();
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setOrigin(window.location.origin), 0);
    return () => window.clearTimeout(timer);
  }, []);
  const timeline = [
    { time: order.createdAt, label: "Recibido", note: null as string | null },
    ...[...order.history]
      .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())
      .map((entry) => ({ time: entry.createdAt, label: orderStatusLabel(entry.toStatus), note: entry.note })),
  ];
  const next = allowedTransitions(order.status as OrderStatus, asOrderType(order.orderType)).find(
    (status) => status !== "cancelled",
  );
  const route = parseCanonicalPath(pathname);
  const trackingHref =
    route.tenantSlug && order.trackingToken
      ? `${publicHrefForContext(route.tenantSlug, `/pedido/${order.reference}`, order.branch?.slug ?? route.branchSlug)}?token=${encodeURIComponent(order.trackingToken)}`
      : "";
  const trackingUrl = trackingHref && origin ? new URL(trackingHref, origin).toString() : trackingHref;

  return (
    <div
      className="fixed inset-0 z-[120] grid place-items-center bg-black/80 p-4 backdrop-blur"
      onClick={onClose}
    >
      <article
        className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Pedido ${order.reference}`}
      >
        <header className="sticky top-0 z-10 flex flex-wrap items-start justify-between gap-4 border-b border-white/10 bg-zinc-950/90 p-6 backdrop-blur">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-black uppercase tracking-wider text-pink-300">{order.reference}</p>
              <StatusBadge status={orderStatusLabel(order.status)} />
              <StatusBadge status={orderTypeLabel(order.orderType)} tone="info" />
            </div>
            <h2 className="mt-2 text-3xl font-black">{order.customerName}</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Recibido {elapsedLabel(order.createdAt)} · {new Date(order.createdAt).toLocaleString("es-AR")}
            </p>
          </div>
          <button
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/5 text-xl text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </button>
        </header>

        <div className="p-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <FormSection title="Cliente" description="Datos del cliente y sucursal.">
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Nombre</span>
                    <strong>{order.customerName}</strong>
                  </div>
                  {order.phone && (
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Teléfono</span>
                      <strong>{order.phone}</strong>
                    </div>
                  )}
                  {order.email && (
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Email</span>
                      <strong className="text-right">{order.email}</strong>
                    </div>
                  )}
                  {order.branch && (
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Sucursal</span>
                      <strong>{order.branch.name}</strong>
                    </div>
                  )}
                </div>
              </FormSection>

              <FormSection title="Entrega" description="Modalidad y estado logístico.">
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Modalidad</span>
                    <strong>
                      {orderTypeLabel(order.orderType)}
                      {order.table ? ` · ${order.table.name}` : ""}
                    </strong>
                  </div>
                  {order.deliveryAddress && (
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Dirección</span>
                      <strong className="text-right max-w-xs">{order.deliveryAddress}</strong>
                    </div>
                  )}
                  {order.delivery && (
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Reparto</span>
                      <strong>
                        {deliveryStatusMeta(order.delivery.status).label}
                        {order.delivery.driverProfile?.name ? ` · ${order.delivery.driverProfile.name}` : ""}
                        {order.delivery.number ? ` · ${order.delivery.number}` : ""}
                      </strong>
                    </div>
                  )}
                  {order.requestedAt && (
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Para</span>
                      <strong>{new Date(order.requestedAt).toLocaleString("es-AR")}</strong>
                    </div>
                  )}
                </div>
              </FormSection>

              <section>
                <SectionHeader
                  title="Productos"
                  description={`${order.items.reduce((sum, item) => sum + item.quantity, 0)} productos en el pedido.`}
                />
                <div className="mt-3">
                  <DocumentLines headers={["Producto", "Pedido", "Entregado", "Pendiente", "Importe"]}>
                    {order.items.map((item) => {
                      const extras = extrasText(item.extras);
                      const pending =
                        item.pendingQuantity ?? Math.max(0, item.quantity - item.deliveredQuantity);
                      return (
                        <tr key={item.id}>
                          <td className="px-4 py-2 text-sm text-zinc-200">
                            {item.productName}
                            {item.variantName && (
                              <span className="ml-1 text-xs text-zinc-500">· {item.variantName}</span>
                            )}
                            {extras && <span className="ml-1 text-xs text-zinc-500">+ {extras}</span>}
                            {item.notes && (
                              <span className="ml-1 text-xs italic text-zinc-600">{item.notes}</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right text-sm tabular-nums text-zinc-200">
                            x{item.quantity}
                          </td>
                          <td className="px-4 py-2 text-right text-sm tabular-nums text-emerald-300">
                            x{item.deliveredQuantity}
                          </td>
                          <td className="px-4 py-2 text-right text-sm tabular-nums text-zinc-400">
                            {pending > 0 ? `x${pending}` : "—"}
                          </td>
                          <td className="px-4 py-2 text-right text-sm font-semibold tabular-nums text-zinc-200">
                            {formatPrice(item.lineTotal, order.currency)}
                          </td>
                        </tr>
                      );
                    })}
                  </DocumentLines>
                </div>
              </section>

              {order.notes && (
                <div className="rounded-2xl border border-white/10 bg-white/[.02] p-4 text-sm text-zinc-300">
                  <strong className="mr-2">Nota del cliente:</strong>
                  {order.notes}
                </div>
              )}

              <section>
                <SectionHeader title="Historial" description="Seguimiento de estados." />
                <ol className="mt-4 space-y-0">
                  {timeline.map((entry, index) => (
                    <li className="relative flex gap-3 pb-4 pl-5 last:pb-0" key={`${entry.time}-${index}`}>
                      <span className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-[var(--admin-primary-strong)]" />
                      {index < timeline.length - 1 && (
                        <span className="absolute left-[4px] top-4 h-full w-px bg-white/10" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-bold">{entry.label}</p>
                        <p className="text-xs text-zinc-500">
                          {new Date(entry.time).toLocaleTimeString("es-AR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {entry.note ? ` · ${entry.note}` : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            </div>

            <div className="space-y-6">
              <section className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
                <SectionHeader title="Resumen" description="Totales del pedido." />
                <div className="mt-4 space-y-3 text-sm">
                  <p className="flex justify-between">
                    <span className="text-zinc-500">Subtotal</span>
                    <strong className="tabular-nums">{formatPrice(order.subtotal, order.currency)}</strong>
                  </p>
                  {Number(order.discount) > 0 && (
                    <p className="flex justify-between">
                      <span className="text-zinc-500">Descuento</span>
                      <strong className="tabular-nums text-emerald-300">
                        -{formatPrice(order.discount, order.currency)}
                      </strong>
                    </p>
                  )}
                  {Number(order.deliveryFee) > 0 && (
                    <p className="flex justify-between">
                      <span className="text-zinc-500">Envío</span>
                      <strong className="tabular-nums">
                        {formatPrice(order.deliveryFee, order.currency)}
                      </strong>
                    </p>
                  )}
                  {Number(order.tip) > 0 && (
                    <p className="flex justify-between">
                      <span className="text-zinc-500">Propina</span>
                      <strong className="tabular-nums">{formatPrice(order.tip, order.currency)}</strong>
                    </p>
                  )}
                  <p className="flex justify-between border-t border-white/10 pt-3 text-lg">
                    <span className="text-zinc-400">Total</span>
                    <strong className="tabular-nums">{formatPrice(order.total, order.currency)}</strong>
                  </p>
                  <p className="flex justify-between border-t border-white/10 pt-3 text-sm">
                    <span className="text-zinc-500">Pago</span>
                    <strong>{order.paymentStatus}</strong>
                  </p>
                </div>
              </section>

              <RelatedDocuments
                title="Documentos relacionados"
                items={[
                  {
                    href: adminHrefFromPathname(pathname, `/admin/entregas?orderId=${order.id}`),
                    label: "Remitos y entregas",
                    count: order._count.deliveries,
                  },
                  ...(order.invoice
                    ? [
                        {
                          href: adminHrefFromPathname(pathname, `/admin/facturacion/${order.invoice.id}`),
                          label: `Comprobante ${order.invoice.number ?? `#${order.invoice.id}`}`,
                          count: 1,
                          tone: (order.invoice.status === "cancelled" ? "danger" : "success") as
                            "danger" | "success",
                        },
                      ]
                    : []),
                  {
                    href: adminHrefFromPathname(pathname, "/admin/cobros"),
                    label: "Pagos y cuenta corriente",
                    count: order._count.payments,
                  },
                ]}
              />

              <section className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
                <SectionHeader title="Acciones" description="Cambios de estado y comprobantes." />
                <div className="mt-4 flex flex-col gap-2">
                  {next && (
                    <button
                      className="btn w-full"
                      onClick={() => void onStatusChange(order, next)}
                      type="button"
                    >
                      {next === "confirmed"
                        ? "Confirmar pedido"
                        : next === "preparing"
                          ? "Empezar preparación"
                          : next === "ready"
                            ? "Marcar listo"
                            : next === "on_the_way"
                              ? "Enviar a delivery"
                              : "Marcar entregado"}
                    </button>
                  )}
                  {order.status !== "cancelled" && (
                    <button
                      className="btn btn-secondary w-full"
                      onClick={() => void onStatusChange(order, "cancelled")}
                      type="button"
                    >
                      Cancelar
                    </button>
                  )}
                  <div className="flex flex-col gap-2 pt-2">
                    {order.phone && (
                      <a
                        className="btn btn-secondary w-full"
                        href={`https://wa.me/${order.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Hola ${order.customerName}!\nPodés seguir el estado de tu pedido ${order.reference} acá:\n${trackingUrl}`)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        WhatsApp
                      </a>
                    )}
                    {trackingHref && <CopyTrackingLink href={trackingHref} compact />}
                    {order.invoice ? (
                      <>
                        <Link
                          className="btn w-full"
                          href={adminHrefFromPathname(pathname, `/admin/facturacion/${order.invoice.id}`)}
                        >
                          Ver comprobante
                        </Link>
                        {order.invoice.status !== "cancelled" && (
                          <button
                            className="btn btn-secondary w-full"
                            onClick={() => void onCancelInvoice(order)}
                            type="button"
                          >
                            Anular
                          </button>
                        )}
                      </>
                    ) : (
                      <button
                        className="btn w-full"
                        onClick={() => void onCreateInvoice(order)}
                        type="button"
                      >
                        Crear comprobante
                      </button>
                    )}
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}
