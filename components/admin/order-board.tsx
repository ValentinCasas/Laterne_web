"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Timeline,
  Drawer,
} from "@/components/admin/ui";
import { BoardCard, type BoardCardVariant } from "@/components/admin/ui/board-card";
import { BoardToolbar } from "@/components/admin/kanban/board-toolbar";
import { KanbanBoard } from "@/components/admin/kanban/kanban-board";
import type { BoardColumn, BoardItem, Density } from "@/components/admin/kanban/types";
import { allowedTransitions, asOrderType } from "@/lib/order-status";
import { orderStatuses, orderStatusLabel, type OrderStatus } from "@/lib/orders";
import { deliveryStatusMeta } from "@/lib/delivery-drivers";
import { scopedFetch } from "@/lib/client-routing";
import { adminHrefFromPathname, parseCanonicalPath, publicHrefForContext } from "@/lib/routes";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/admin/ui/icons";
import { CopyTrackingLink } from "@/components/orders/copy-tracking-link";
import { formatDateTime } from "@/lib/date-format";

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
function formatPrice(value: string | number, currency?: string | null) {
  const code = (currency || "ARS").trim().toUpperCase();
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: code }).format(Number(value));
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

function toBoardItem(order: AdminOrder): BoardItem & { order: AdminOrder } {
  return {
    id: String(order.id),
    columnId: order.status,
    order,
  };
}

/** @summary Gestiona pedidos en columnas, permite filtrarlos y avanzar su estado sin recargar. */
export function OrderBoard({ initialOrders }: { initialOrders: AdminOrder[] }) {
  const pathname = usePathname();
  const [orders, setOrders] = useState(initialOrders);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<OrderTypeFilter>("all");
  const [selected, setSelected] = useState<AdminOrder | null>(null);
  const [updatingOrderIds, setUpdatingOrderIds] = useState<Set<number>>(() => new Set());
  const [conflictNotice, setConflictNotice] = useState<{ orderId: number; message: string } | null>(null);
  const [view, setView] = useState<"board" | "list">("board");
  const [density, setDensity] = useState<Density>(() => {
    if (typeof window === "undefined") return "comfortable";
    try {
      const raw = window.localStorage.getItem("kanban:density:pedidos");
      if (raw === "compact" || raw === "comfortable") return raw;
    } catch { /* noop */ }
    return "comfortable";
  });
  const inFlightOrderIds = useRef<Set<number>>(new Set());
  const didDragRef = useRef(false);

  const handleBoardDragEnd = useCallback(() => {
    didDragRef.current = true;
    window.setTimeout(() => {
      didDragRef.current = false;
    }, 0);
  }, []);

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

  const columns: BoardColumn[] = useMemo(
    () =>
      orderStatuses.map((status) => ({
        id: status,
        title: orderStatusLabel(status),
      })),
    [],
  );

  const boardItems = useMemo(
    () => visibleOrders.map(toBoardItem),
    [visibleOrders],
  );

  /** @summary Solicita un cambio de estado y sincroniza el resultado con todas las vistas del tablero. */
  async function updateStatus(order: AdminOrder, status: OrderStatus) {
    if (order.status === status || inFlightOrderIds.current.has(order.id)) return false;
    inFlightOrderIds.current.add(order.id);
    setUpdatingOrderIds((current) => new Set(current).add(order.id));
    try {
      const response = await scopedFetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, expectedStatus: order.status }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        code?: string;
        error?: string;
        order?: AdminOrder;
      };
      if (!response.ok) {
        if (response.status === 409 && result.code === "ORDER_STATE_CONFLICT") {
          if (result.order) replaceOrder(result.order);
          setConflictNotice({
            orderId: order.id,
            message: result.error ?? "El pedido cambió desde otra pantalla.",
          });
          return false;
        }
        await Swal.fire({
          title: "No se pudo actualizar",
          text: result.error ?? "Intentá nuevamente.",
          icon: "error",
          background: "#18181b",
          color: "#fafafa",
        });
        return false;
      }
      if (result.order) replaceOrder(result.order);
      setConflictNotice((current) => (current?.orderId === order.id ? null : current));
      return true;
    } finally {
      inFlightOrderIds.current.delete(order.id);
      setUpdatingOrderIds((current) => {
        const next = new Set(current);
        next.delete(order.id);
        return next;
      });
    }
  }

  /** @summary Reemplaza únicamente el pedido sincronizado en el tablero y su detalle. */
  function replaceOrder(order: AdminOrder) {
    setOrders((current) => current.map((item) => (item.id === order.id ? order : item)));
    setSelected((current) => (current?.id === order.id ? order : current));
  }

  /** @summary Refresca un pedido puntual después de detectar concurrencia real. */
  async function refreshOrder(orderId: number) {
    const response = await scopedFetch(`/api/admin/orders/${orderId}`, { method: "GET" });
    const body = (await response.json().catch(() => ({}))) as { order?: AdminOrder };
    if (response.ok && body.order) {
      replaceOrder(body.order);
      setConflictNotice(null);
    }
  }

  /** @summary Mueve un pedido a una columna y persiste el cambio en el servidor. */
  async function handleMove(itemId: string, fromColumnId: string, toColumnId: string) {
    const order = orders.find((o) => String(o.id) === itemId);
    if (!order) return;
    const valid = allowedTransitions(order.status as OrderStatus, asOrderType(order.orderType)).includes(toColumnId as OrderStatus);
    if (!valid) {
      await Swal.fire({
        title: "Transición no permitida",
        text: `No podés mover ${order.reference} a ${orderStatusLabel(toColumnId)}.`,
        icon: "warning",
        background: "#18181b",
        color: "#fafafa",
      });
      return;
    }
    await updateStatus(order, toColumnId as OrderStatus);
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

  const typeFilterCounts = useMemo(() => {
    const counts: Record<string, number> = { all: orders.length };
    for (const type of ["dine_in", "takeaway", "delivery"] as const) {
      counts[type] = orders.filter((o) => o.orderType === type).length;
    }
    return counts;
  }, [orders]);

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
          </div>
        }
      />

      {conflictNotice && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100" role="status">
          <p><strong>El pedido cambió en otra pantalla.</strong> {conflictNotice.message}</p>
          <button type="button" className="text-xs font-bold text-amber-200 underline underline-offset-4 hover:text-white" onClick={() => void refreshOrder(conflictNotice.orderId)}>
            Actualizar pedido
          </button>
        </div>
      )}

      <BoardToolbar
        title="Pedidos"
        subtitle={`${visibleOrders.length} pedido${visibleOrders.length === 1 ? "" : "s"} visibles`}
        searchPlaceholder="Buscar por referencia, cliente o teléfono…"
        searchValue={query}
        onSearchChange={setQuery}
        density={density}
        onDensityChange={setDensity}
        view={view}
        onViewChange={setView}
        filters={
          typeFilter !== "all"
            ? [
                {
                  key: "type",
                  label: modalityLabel[typeFilter] ?? typeFilter,
                  onRemove: () => setTypeFilter("all"),
                },
              ]
            : []
        }
        onClearFilters={() => setTypeFilter("all")}
        actions={
          <div className="flex rounded-lg bg-white/5 p-0.5" role="group" aria-label="Modalidad">
            {(["all", "dine_in", "takeaway", "delivery"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setTypeFilter(option)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-bold transition ${
                  typeFilter === option
                    ? "bg-[var(--admin-primary-strong)] text-white"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
                title={option === "all" ? "Todos" : modalityLabel[option]}
              >
                {option === "all" ? "Todos" : modalityLabel[option]}
                <span className="ml-1 text-[10px] opacity-70">
                  <NumberFlow value={typeFilterCounts[option] ?? 0} />
                </span>
              </button>
            ))}
          </div>
        }
      />

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
      ) : view === "board" ? (
        <KanbanBoard
          columns={columns}
          initialItems={boardItems}
          storageKey="pedidos"
          emptyState={
            <div className="text-center">
              <p className="text-xs text-zinc-500">Todavía no hay pedidos en esta etapa.</p>
            </div>
          }
          renderItem={(item, itemDensity, isDragging) => {
            const order = (item as BoardItem & { order: AdminOrder }).order;
            const variant: BoardCardVariant = order.status === "cancelled" ? "error" : "default";
            const modality = orderTypeLabel(order.orderType);
            const totalItems = (order.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0);

            return (
              <BoardCard
                variant={variant}
                density={itemDensity}
                onClick={() => {
                  if (didDragRef.current) return;
                  setSelected(order);
                }}
                header={
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
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
                }
                content={
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${modalityStyle[order.orderType]}`}>
                      {modality}
                      {order.table ? ` · ${order.table.name}` : ""}
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      {totalItems} {totalItems === 1 ? "ítem" : "ítems"}
                    </span>
                  </div>
                }
                metadata={
                  <>
                    <span className="flex items-center gap-1">
                      <Icon name="clock" className="h-3 w-3" />
                      {elapsedLabel(order.createdAt)}
                    </span>
                    {order.branch && (
                      <span className="flex items-center gap-1">
                        <Icon name="map-pin" className="h-3 w-3" />
                        {order.branch.name}
                      </span>
                    )}
                    {order.delivery && (
                      <span className="flex items-center gap-1">
                        <Icon name="truck" className="h-3 w-3" />
                        {deliveryStatusMeta(order.delivery.status).label}
                        {order.delivery.driverProfile?.name ? ` · ${order.delivery.driverProfile.name}` : ""}
                      </span>
                    )}
                  </>
                }
                actions={
                  nextStatus(order) && (
                    <button
                      className="w-full rounded-lg bg-[var(--admin-primary-strong)]/15 px-3 py-1.5 text-xs font-bold text-[var(--admin-primary-strong)] transition-colors hover:bg-[var(--admin-primary-strong)]/25 disabled:opacity-50"
                      disabled={updatingOrderIds.has(order.id)}
                      onClick={(e) => {
                        e.stopPropagation();
                        void updateStatus(order, nextStatus(order)!);
                      }}
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
                  )
                }
                badges={
                  <>
                    <StatusBadge status={orderStatusLabel(order.status)} />
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${modalityStyle[order.orderType]}`}>
                      {modality}
                    </span>
                  </>
                }
                className={isDragging ? "ring-2 ring-[var(--admin-primary)]/40" : ""}
              />
            );
          }}
          renderOverlay={(item) => {
            const order = (item as BoardItem & { order: AdminOrder }).order;
            return (
              <BoardCard
                variant="default"
                density={density}
                header={
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--admin-primary-strong)]">
                        {order.reference}
                      </p>
                      <h3 className="mt-0.5 truncate text-sm font-bold text-white">
                        {order.customerName}
                      </h3>
                    </div>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-white">
                      {formatPrice(order.total, order.currency)}
                    </span>
                  </div>
                }
                content={
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${modalityStyle[order.orderType]}`}>
                      {orderTypeLabel(order.orderType)}
                    </span>
                  </div>
                }
              />
            );
          }}
          onMove={handleMove}
          onDragEnd={handleBoardDragEnd}
          boardTitle={
            <div>
              <h2 className="text-lg font-black text-white">Pedidos</h2>
              <p className="text-xs text-[var(--admin-muted)]">Arrastrá los pedidos entre columnas para cambiar su estado.</p>
            </div>
          }
        />
      ) : (
        <div className="space-y-2">
          {visibleOrders.map((order) => (
            <BoardCard
              key={order.id}
              variant={order.status === "cancelled" ? "error" : "default"}
              density="compact"
              onClick={() => setSelected(order)}
              header={
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--admin-primary-strong)]">
                      {order.reference}
                    </p>
                    <span className="text-[10px] text-zinc-500">{elapsedLabel(order.createdAt)}</span>
                  </div>
                  <span className="text-sm font-bold tabular-nums text-white">{formatPrice(order.total, order.currency)}</span>
                </div>
              }
              content={
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-zinc-100">{order.customerName}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${modalityStyle[order.orderType]}`}>
                    {orderTypeLabel(order.orderType)}
                    {order.table ? ` · ${order.table.name}` : ""}
                  </span>
                  <StatusBadge status={orderStatusLabel(order.status)} />
                </div>
              }
              metadata={
                <>
                  <span className="flex items-center gap-1">
                    <Icon name="phone" className="h-3 w-3" />
                    {order.phone}
                  </span>
                  {order.branch && (
                    <span className="flex items-center gap-1">
                      <Icon name="map-pin" className="h-3 w-3" />
                      {order.branch.name}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Icon name="package" className="h-3 w-3" />
                    {(order.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0)} ítems
                  </span>
                </>
              }
            />
          ))}
          {visibleOrders.length === 0 && (
            <EmptyState
              title="Sin resultados"
              description="No hay pedidos que coincidan con los filtros actuales."
            />
          )}
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
  onStatusChange: (order: AdminOrder, status: OrderStatus) => Promise<boolean>;
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
    { id: "received", date: order.createdAt, title: "Recibido", note: null as string | null },
    ...[...order.history]
      .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())
      .map((entry) => ({ id: entry.id, date: entry.createdAt, title: orderStatusLabel(entry.toStatus), note: entry.note })),
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
    <Drawer open onClose={onClose} title={`Pedido ${order.reference}`} width="min(84vw, 1280px)">
      <div>
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--admin-border)] pb-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-black uppercase tracking-wider text-pink-300">{order.reference}</p>
              <StatusBadge status={orderStatusLabel(order.status)} />
              <StatusBadge status={orderTypeLabel(order.orderType)} tone="info" />
            </div>
            <h2 className="mt-2 text-3xl font-black">{order.customerName}</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Recibido {elapsedLabel(order.createdAt)} · {formatDateTime(order.createdAt)}
            </p>
          </div>
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
                      <strong>{formatDateTime(order.requestedAt)}</strong>
                    </div>
                  )}
                </div>
              </FormSection>

              <section>
                <SectionHeader
                  title="Productos"
                  description={`${(order.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0)} productos en el pedido.`}
                />
                <div className="mt-3">
                  <DocumentLines headers={["Producto", "Pedido", "Entregado", "Pendiente", "Importe"]}>
                    {(order.items || []).map((item) => {
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
                <Timeline
                  className="mt-4"
                  items={timeline.map((entry, index) => ({
                    id: entry.id,
                    date: entry.date,
                    title: entry.title,
                    description: entry.note,
                    tone: index === timeline.length - 1 ? "success" : "info",
                  }))}
                />
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
      </div>
    </Drawer>
  );
}
