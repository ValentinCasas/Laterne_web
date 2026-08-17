"use client";

import { useCallback, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { AdminPageHelp } from "@/components/admin/admin-page-help";
import { InvoiceDetailModal, NewInvoiceModal, NewOrderModal, OrderDetailModal, SupplierModal } from "@/components/admin/purchases-modals";
import { scopedFetch } from "@/lib/client-routing";
import { purchaseInvoiceStatusLabels, purchaseOrderStatusLabels } from "@/lib/purchases";

/**
 * Gestor de Compras de MenuClick.
 *
 * Separa Pedido → Recepción → Factura → Pago en pestañas operativas. El pedido
 * es intención (no toca stock); la recepción física es la única que aumenta
 * inventario, en la sucursal correspondiente. Las facturas se vinculan a una o
 * varias recepciones y los pagos parciales avanzan el estado del documento.
 */

type Supplier = { id: number; name: string; taxId?: string | null; phone?: string | null; email?: string | null; paymentTerms?: string | null; notes?: string | null; active?: boolean };
type BranchOption = { id: number; name: string; slug: string; active: boolean };
type ProductOption = { id: number; name: string; cost?: number | string | null; costUnit?: string | null; imageUrl?: string | null };
type OrderRow = {
  id: number;
  number: string;
  status: string;
  orderDate: string;
  expectedDate?: string | null;
  externalReference?: string | null;
  supplier: { id: number; name: string };
  branch: { id: number; name: string };
  items: Array<{ quantity: string | number; receivedQuantity: string | number }>;
  createdBy?: { id: number; name: string } | null;
};
type ReceiptRow = {
  id: number;
  number: string;
  receivedAt: string;
  notes?: string | null;
  supplier: { id: number; name: string };
  branch: { id: number; name: string };
  order?: { id: number; number: string } | null;
  items: Array<{ id: number; quantity: string | number; unit: string; unitCost: string | number; product?: { id: number; name: string } }>;
  createdBy?: { id: number; name: string } | null;
};
type InvoiceRow = {
  id: number;
  number: string;
  status: string;
  documentDate: string;
  dueDate?: string | null;
  externalNumber?: string | null;
  supplier: { id: number; name: string };
  branch?: { id: number; name: string } | null;
  subtotal: string | number;
  taxAmount: string | number;
  total: string | number;
  paidAmount: string | number;
  receipts?: Array<{ receipt: { id: number; number: string } }>;
};
type OrderDetail = OrderRow & {
  notes?: string | null;
  items: Array<{
    id: number;
    quantity: string | number;
    receivedQuantity: string | number;
    unit: string;
    unitCost: string | number;
    discountPercent?: string | number;
    taxPercent?: string | number;
    product: ProductOption;
  }>;
  receipts: Array<{
    id: number;
    number: string;
    receivedAt: string;
    createdBy?: { id: number; name: string } | null;
    items: Array<{ id: number; quantity: string | number; unit: string; unitCost: string | number; product?: { id: number; name: string } }>;
  }>;
  invoices: Array<{ id: number; number: string; status: string; total: string | number; documentDate: string; externalNumber?: string | null }>;
};
type InvoiceDetail = InvoiceRow & {
  notes?: string | null;
  items: Array<{ id: number; productId?: number | null; description: string; quantity: string | number; unit: string; unitCost: string | number; discountPercent?: string | number; taxPercent?: string | number }>;
  payments: Array<{ id: number; number: string; amount: string | number; method: string; paidAt: string; notes?: string | null; createdBy?: { id: number; name: string } | null }>;
  receipts: Array<{ receipt: ReceiptRow }>;
};

type PurchasesPayload = {
  tenantId: number;
  currency: string;
  activeBranchId: number | null;
  branches: BranchOption[];
  suppliers: Supplier[];
  products: ProductOption[];
  orders: OrderRow[];
  receipts: ReceiptRow[];
  invoices: InvoiceRow[];
};

const TAB_LABELS: Array<{ key: "pedidos" | "recepciones" | "facturas" | "proveedores"; label: string }> = [
  { key: "pedidos", label: "Pedidos" },
  { key: "recepciones", label: "Recepciones" },
  { key: "facturas", label: "Facturas" },
  { key: "proveedores", label: "Proveedores" },
];

const ORDER_STATUS_COLORS: Record<string, string> = {
  draft: "bg-zinc-500/15 text-zinc-300",
  sent: "bg-sky-500/15 text-sky-300",
  partially_received: "bg-amber-500/15 text-amber-300",
  received: "bg-emerald-500/15 text-emerald-300",
  closed: "bg-zinc-500/15 text-zinc-300",
  cancelled: "bg-rose-500/15 text-rose-300",
};

const INVOICE_STATUS_COLORS: Record<string, string> = {
  draft: "bg-zinc-500/15 text-zinc-300",
  pending: "bg-amber-500/15 text-amber-300",
  partially_paid: "bg-sky-500/15 text-sky-300",
  paid: "bg-emerald-500/15 text-emerald-300",
  cancelled: "bg-rose-500/15 text-rose-300",
};

/** @summary Formatea un importe con la moneda del negocio. */
function money(value: string | number | null | undefined, currency: string) {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 2 }).format(number);
}

/** @summary Formatea una fecha ISO para mostrar. */
function dateLabel(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

/** @summary Ejecuta una petición de API y devuelve el cuerpo parseado o lanza el error del servidor. */
async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await scopedFetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body?.error ?? "No se pudo completar la operación");
  return body;
}

/** @summary Muestra un error de operación en el panel sin romper la pantalla. */
async function showError(title: string, reason: unknown) {
  await Swal.fire({
    title,
    text: reason instanceof Error ? reason.message : "Intentá nuevamente.",
    icon: "error",
    background: "#18181b",
    color: "#fafafa",
  });
}

/** @summary Gestor de compras con pestañas de pedidos, recepciones, facturas y proveedores. */
export function PurchasesManager({ initial }: { initial: PurchasesPayload }) {
  const [payload, setPayload] = useState<PurchasesPayload>(initial);
  const [tab, setTab] = useState<"pedidos" | "recepciones" | "facturas" | "proveedores">("pedidos");
  const [orderQuery, setOrderQuery] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  const [orderSupplier, setOrderSupplier] = useState("");
  const [invoiceStatus, setInvoiceStatus] = useState("");
  const [openOrder, setOpenOrder] = useState<OrderDetail | null>(null);
  const [openInvoice, setOpenInvoice] = useState<InvoiceDetail | null>(null);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | "new" | null>(null);
  const [busy, setBusy] = useState(false);

  const currency = payload.currency ?? "ARS";

  /** @summary Recarga los listados completos del módulo. */
  const refresh = useCallback(async () => {
    try {
      const [orders, receipts, invoices, suppliers] = await Promise.all([
        api<{ items: OrderRow[] }>("/api/admin/compras?limit=60"),
        api<{ items: ReceiptRow[] }>("/api/admin/compras/recepciones?limit=40"),
        api<{ items: InvoiceRow[] }>("/api/admin/compras/facturas?limit=60"),
        api<Supplier[]>("/api/admin/compras/proveedores"),
      ]);
      setPayload((current) => ({ ...current, orders: orders.items, receipts: receipts.items, invoices: invoices.items, suppliers }));
    } catch (reason) {
      await showError("No se pudieron actualizar los listados", reason);
    }
  }, []);

  const filteredOrders = useMemo(() => {
    const normalized = orderQuery.trim().toLocaleLowerCase("es");
    return payload.orders.filter((order) => {
      if (orderStatus && order.status !== orderStatus) return false;
      if (orderSupplier && order.supplier.id !== Number(orderSupplier)) return false;
      if (
        normalized &&
        !order.number.toLocaleLowerCase("es").includes(normalized) &&
        !order.supplier.name.toLocaleLowerCase("es").includes(normalized) &&
        !(order.externalReference ?? "").toLocaleLowerCase("es").includes(normalized)
      ) {
        return false;
      }
      return true;
    });
  }, [payload.orders, orderQuery, orderStatus, orderSupplier]);

  const filteredInvoices = useMemo(() => {
    const normalized = orderQuery.trim().toLocaleLowerCase("es");
    return payload.invoices.filter((invoice) => {
      if (invoiceStatus && invoice.status !== invoiceStatus) return false;
      if (
        normalized &&
        !invoice.number.toLocaleLowerCase("es").includes(normalized) &&
        !invoice.supplier.name.toLocaleLowerCase("es").includes(normalized) &&
        !(invoice.externalNumber ?? "").toLocaleLowerCase("es").includes(normalized)
      ) {
        return false;
      }
      return true;
    });
  }, [payload.invoices, orderQuery, invoiceStatus]);

  /** @summary Abre el detalle de un pedido con su historial de recepciones. */
  async function openOrderDetail(orderId: number) {
    setBusy(true);
    try {
      const detail = await api<OrderDetail>(`/api/admin/compras/${orderId}`);
      setOpenOrder(detail);
    } catch (reason) {
      await showError("No se pudo abrir el pedido", reason);
    } finally {
      setBusy(false);
    }
  }

  /** @summary Abre el detalle de una factura con sus pagos. */
  async function openInvoiceDetail(invoiceId: number) {
    setBusy(true);
    try {
      const detail = await api<InvoiceDetail>(`/api/admin/compras/facturas/${invoiceId}`);
      setOpenInvoice(detail);
    } catch (reason) {
      await showError("No se pudo abrir la factura", reason);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {/* Cabecera compacta */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0">
            <p className="section-eyebrow">Costos</p>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight">Compras</h1>
              <AdminPageHelp section="compras" />
            </div>
          </div>
          <p className="hidden max-w-md truncate text-sm text-[var(--admin-muted)] xl:block">
            Pedido → Recepción → Factura → Pago
          </p>
        </div>
        <div className="flex gap-2">
          {tab === "pedidos" && (
            <button type="button" className="btn" onClick={() => setCreatingOrder(true)} disabled={busy}>
              + Nueva compra
            </button>
          )}
          {tab === "facturas" && (
            <button type="button" className="btn" onClick={() => setCreatingInvoice(true)} disabled={busy}>
              + Nueva factura
            </button>
          )}
          {tab === "proveedores" && (
            <button type="button" className="btn" onClick={() => setEditingSupplier("new")} disabled={busy}>
              + Nuevo proveedor
            </button>
          )}
        </div>
      </div>

      {/* Pestañas */}
      <div className="mb-4 flex flex-wrap gap-1 rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-1">
        {TAB_LABELS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
              tab === item.key ? "bg-pink-500 text-white" : "text-[var(--admin-muted)] hover:bg-white/5"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Toolbar de filtros */}
      {(tab === "pedidos" || tab === "facturas") && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-2.5">
          <input
            className="input min-w-48 flex-1"
            value={orderQuery}
            onChange={(event) => setOrderQuery(event.target.value)}
            placeholder="Buscar por número, proveedor o comprobante…"
            aria-label="Buscar en compras"
          />
          {tab === "pedidos" ? (
            <>
              <select className="input w-auto" value={orderStatus} onChange={(event) => setOrderStatus(event.target.value)} aria-label="Filtrar por estado">
                <option value="">Todos los estados</option>
                {Object.entries(purchaseOrderStatusLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <select className="input w-auto" value={orderSupplier} onChange={(event) => setOrderSupplier(event.target.value)} aria-label="Filtrar por proveedor">
                <option value="">Todos los proveedores</option>
                {payload.suppliers.map((supplier) => (
                  <option key={supplier.id} value={String(supplier.id)}>{supplier.name}</option>
                ))}
              </select>
            </>
          ) : (
            <select className="input w-auto" value={invoiceStatus} onChange={(event) => setInvoiceStatus(event.target.value)} aria-label="Filtrar por estado de factura">
              <option value="">Todos los estados</option>
              {Object.entries(purchaseInvoiceStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          )}
          <span className="ml-auto text-sm text-[var(--admin-muted)]">
            {tab === "pedidos" ? filteredOrders.length : filteredInvoices.length} resultados
          </span>
        </div>
      )}

      {tab === "pedidos" && (
        <OrdersTable
          orders={filteredOrders}
          onOpen={openOrderDetail}
          onRefresh={refresh}
          setBusy={setBusy}
        />
      )}
      {tab === "recepciones" && <ReceiptsTable receipts={payload.receipts} currency={currency} onOpenOrder={openOrderDetail} />}
      {tab === "facturas" && (
        <InvoicesTable invoices={filteredInvoices} currency={currency} onOpen={openInvoiceDetail} onRefresh={refresh} setBusy={setBusy} />
      )}
      {tab === "proveedores" && (
        <SuppliersTable
          suppliers={payload.suppliers}
          onEdit={(supplier) => setEditingSupplier(supplier)}
          onRefresh={refresh}
          setBusy={setBusy}
        />
      )}

      {creatingOrder && (
        <NewOrderModal
          branches={payload.branches}
          suppliers={payload.suppliers}
          products={payload.products}
          currency={currency}
          activeBranchId={payload.activeBranchId}
          onClose={() => setCreatingOrder(false)}
          onSaved={async () => {
            setCreatingOrder(false);
            await refresh();
          }}
        />
      )}
      {creatingInvoice && (
        <NewInvoiceModal
          suppliers={payload.suppliers}
          receipts={payload.receipts}
          currency={currency}
          activeBranchId={payload.activeBranchId}
          onClose={() => setCreatingInvoice(false)}
          onSaved={async () => {
            setCreatingInvoice(false);
            await refresh();
          }}
        />
      )}
      {openOrder && (
        <OrderDetailModal
          order={openOrder}
          currency={currency}
          onClose={() => setOpenOrder(null)}
          onUpdated={async (updated) => {
            setOpenOrder(updated);
            await refresh();
          }}
          setBusy={setBusy}
        />
      )}
      {openInvoice && (
        <InvoiceDetailModal
          invoice={openInvoice}
          currency={currency}
          onClose={() => setOpenInvoice(null)}
          onUpdated={async (updated) => {
            setOpenInvoice(updated);
            await refresh();
          }}
          setBusy={setBusy}
        />
      )}
      {editingSupplier && (
        <SupplierModal
          supplier={editingSupplier === "new" ? null : editingSupplier}
          onClose={() => setEditingSupplier(null)}
          onSaved={async () => {
            setEditingSupplier(null);
            await refresh();
          }}
        />
      )}
    </div>
  );
}

/** @summary Tabla operativa de pedidos de compra. */
function OrdersTable({
  orders,
  onOpen,
  onRefresh,
  setBusy,
}: {
  orders: OrderRow[];
  onOpen: (id: number) => void;
  onRefresh: () => Promise<void>;
  setBusy: (value: boolean) => void;
}) {
  /** @summary Cambia el estado del pedido (enviar/cancelar/cerrar) con confirmación. */
  async function changeStatus(order: OrderRow, nextStatus: string) {
    const confirmations: Record<string, { title: string; text: string }> = {
      sent: { title: "Enviar pedido", text: `Marcar ${order.number} como enviado al proveedor.` },
      closed: { title: "Cerrar pedido", text: `Cerrar ${order.number} para futuras recepciones.` },
      cancelled: { title: "Cancelar pedido", text: `Cancelar ${order.number}. No se puede revertir.` },
    };
    const confirmation = confirmations[nextStatus];
    if (!confirmation) return;
    const result = await Swal.fire({
      title: confirmation.title,
      text: confirmation.text,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Confirmar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: nextStatus === "cancelled" ? "#ef4444" : "#ec4899",
      background: "#18181b",
      color: "#fafafa",
      reverseButtons: true,
    });
    if (!result.isConfirmed) return;
    setBusy(true);
    try {
      await api(`/api/admin/compras/${order.id}`, { method: "PATCH", body: JSON.stringify({ status: nextStatus }) });
      await onRefresh();
    } catch (reason) {
      await showError("No se pudo cambiar el estado", reason);
    } finally {
      setBusy(false);
    }
  }

  /** @summary Elimina un pedido en Borrador. */
  async function remove(order: OrderRow) {
    const result = await Swal.fire({
      title: "¿Eliminar pedido?",
      text: `Vas a eliminar ${order.number}. Solo es posible si está en Borrador.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ef4444",
      background: "#18181b",
      color: "#fafafa",
      reverseButtons: true,
    });
    if (!result.isConfirmed) return;
    setBusy(true);
    try {
      await api(`/api/admin/compras/${order.id}`, { method: "DELETE" });
      await onRefresh();
    } catch (reason) {
      await showError("No se pudo eliminar el pedido", reason);
    } finally {
      setBusy(false);
    }
  }

  if (!orders.length) {
    return (
      <div className="rounded-3xl border border-dashed border-white/15 p-12 text-center">
        <span className="text-4xl">📦</span>
        <h3 className="mt-3 text-xl font-black">Todavía no tenés pedidos de compra</h3>
        <p className="mt-2 text-sm text-[var(--admin-muted)]">Creá el primero para pedir mercadería a un proveedor.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl shadow-black/10">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--admin-border)] bg-white/[0.02] text-xs uppercase tracking-wider text-[var(--admin-muted)]">
              <th className="px-4 py-3">Pedido</th>
              <th className="px-4 py-3">Proveedor</th>
              <th className="px-4 py-3">Sucursal</th>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3 text-right">Pendiente</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--admin-border)]/70">
            {orders.map((order) => {
              const pendingLines = order.items.filter((item) => Number(item.quantity) - Number(item.receivedQuantity) > 0).length;
              return (
                <tr key={order.id} className="transition-colors hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <button type="button" className="font-black text-pink-300 hover:underline" onClick={() => onOpen(order.id)}>
                      {order.number}
                    </button>
                    {order.externalReference && <p className="text-xs text-[var(--admin-muted)]">{order.externalReference}</p>}
                  </td>
                  <td className="px-4 py-3 font-semibold">{order.supplier.name}</td>
                  <td className="px-4 py-3 text-[var(--admin-muted)]">{order.branch.name}</td>
                  <td className="px-4 py-3 text-[var(--admin-muted)]">{dateLabel(order.orderDate)}</td>
                  <td className="px-4 py-3 text-right">
                    {pendingLines > 0 ? (
                      <span className="font-bold text-amber-300">{pendingLines} línea{pendingLines === 1 ? "" : "s"}</span>
                    ) : (
                      <span className="font-bold text-emerald-300">Completo</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${ORDER_STATUS_COLORS[order.status] ?? ORDER_STATUS_COLORS.draft}`}>
                      {purchaseOrderStatusLabels[order.status] ?? order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button type="button" className="btn btn-secondary px-2.5 py-1.5 text-xs" onClick={() => onOpen(order.id)}>
                        Ver
                      </button>
                      {order.status === "draft" && (
                        <button type="button" className="btn px-2.5 py-1.5 text-xs" onClick={() => void changeStatus(order, "sent")}>
                          Enviar
                        </button>
                      )}
                      {["received", "partially_received", "sent", "draft"].includes(order.status) && (
                        <button type="button" className="btn btn-secondary px-2.5 py-1.5 text-xs" onClick={() => void changeStatus(order, "closed")}>
                          Cerrar
                        </button>
                      )}
                      {order.status === "draft" && (
                        <button
                          type="button"
                          className="rounded-lg border border-red-500/20 px-2.5 py-1.5 text-xs font-bold text-rose-300 hover:bg-rose-500/10"
                          onClick={() => void changeStatus(order, "cancelled")}
                        >
                          Cancelar
                        </button>
                      )}
                      {order.status === "draft" && (
                        <button
                          type="button"
                          className="rounded-lg border border-[var(--admin-border)] px-2 py-1 text-xs text-[var(--admin-muted)] hover:text-rose-300"
                          onClick={() => void remove(order)}
                          title="Eliminar"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** @summary Tabla de recepciones físicas. */
function ReceiptsTable({
  receipts,
  currency,
  onOpenOrder,
}: {
  receipts: ReceiptRow[];
  currency: string;
  onOpenOrder: (id: number) => void;
}) {
  if (!receipts.length) {
    return (
      <div className="rounded-3xl border border-dashed border-white/15 p-12 text-center">
        <span className="text-4xl">🚚</span>
        <h3 className="mt-3 text-xl font-black">Todavía no hay recepciones</h3>
        <p className="mt-2 text-sm text-[var(--admin-muted)]">Abrí un pedido y usá el botón «Recibir» cuando llegue la mercadería.</p>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl shadow-black/10">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--admin-border)] bg-white/[0.02] text-xs uppercase tracking-wider text-[var(--admin-muted)]">
              <th className="px-4 py-3">Recepción</th>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Pedido</th>
              <th className="px-4 py-3">Proveedor</th>
              <th className="px-4 py-3">Sucursal</th>
              <th className="px-4 py-3">Productos</th>
              <th className="px-4 py-3 text-right">Importe estimado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--admin-border)]/70">
            {receipts.map((receipt) => {
              const total = receipt.items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitCost), 0);
              return (
                <tr key={receipt.id} className="transition-colors hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-black text-pink-300">{receipt.number}</td>
                  <td className="px-4 py-3 text-[var(--admin-muted)]">{dateLabel(receipt.receivedAt)}</td>
                  <td className="px-4 py-3">
                    {receipt.order ? (
                      <button type="button" className="font-semibold text-zinc-200 hover:underline" onClick={() => onOpenOrder(receipt.order!.id)}>
                        {receipt.order.number}
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">{receipt.supplier.name}</td>
                  <td className="px-4 py-3 text-[var(--admin-muted)]">{receipt.branch.name}</td>
                  <td className="px-4 py-3 text-xs text-[var(--admin-muted)]">
                    {receipt.items.map((item) => `${item.product?.name ?? item.product?.id ?? item.id} × ${item.quantity} ${item.unit}`).join(", ")}
                  </td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums">{money(total, currency)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** @summary Tabla de facturas de compra. */
function InvoicesTable({
  invoices,
  currency,
  onOpen,
  onRefresh,
  setBusy,
}: {
  invoices: InvoiceRow[];
  currency: string;
  onOpen: (id: number) => void;
  onRefresh: () => Promise<void>;
  setBusy: (value: boolean) => void;
}) {
  /** @summary Anula una factura sin pagos. */
  async function annul(invoice: InvoiceRow) {
    const result = await Swal.fire({
      title: "¿Anular factura?",
      text: `Vas a anular ${invoice.number}. Solo es posible si no tiene pagos.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Anular",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ef4444",
      background: "#18181b",
      color: "#fafafa",
      reverseButtons: true,
    });
    if (!result.isConfirmed) return;
    setBusy(true);
    try {
      await api(`/api/admin/compras/facturas/${invoice.id}`, { method: "PATCH", body: JSON.stringify({ status: "cancelled" }) });
      await onRefresh();
    } catch (reason) {
      await showError("No se pudo anular la factura", reason);
    } finally {
      setBusy(false);
    }
  }

  if (!invoices.length) {
    return (
      <div className="rounded-3xl border border-dashed border-white/15 p-12 text-center">
        <span className="text-4xl">🧾</span>
        <h3 className="mt-3 text-xl font-black">Todavía no hay facturas de proveedor</h3>
        <p className="mt-2 text-sm text-[var(--admin-muted)]">Creá una factura y vincúlala a las recepciones del proveedor.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl shadow-black/10">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--admin-border)] bg-white/[0.02] text-xs uppercase tracking-wider text-[var(--admin-muted)]">
              <th className="px-4 py-3">Factura</th>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Vencimiento</th>
              <th className="px-4 py-3">Proveedor</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Saldo</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--admin-border)]/70">
            {invoices.map((invoice) => {
              const balance = Number(invoice.total) - Number(invoice.paidAmount);
              return (
                <tr key={invoice.id} className="transition-colors hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <button type="button" className="font-black text-pink-300 hover:underline" onClick={() => onOpen(invoice.id)}>
                      {invoice.number}
                    </button>
                    {invoice.externalNumber && <p className="text-xs text-[var(--admin-muted)]">Comp. {invoice.externalNumber}</p>}
                  </td>
                  <td className="px-4 py-3 text-[var(--admin-muted)]">{dateLabel(invoice.documentDate)}</td>
                  <td className="px-4 py-3 text-[var(--admin-muted)]">{dateLabel(invoice.dueDate)}</td>
                  <td className="px-4 py-3 font-semibold">{invoice.supplier.name}</td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums">{money(invoice.total, currency)}</td>
                  <td className={`px-4 py-3 text-right font-bold tabular-nums ${balance > 0 ? "text-amber-300" : "text-emerald-300"}`}>
                    {money(balance, currency)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${INVOICE_STATUS_COLORS[invoice.status] ?? INVOICE_STATUS_COLORS.draft}`}>
                      {purchaseInvoiceStatusLabels[invoice.status] ?? invoice.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button type="button" className="btn btn-secondary px-2.5 py-1.5 text-xs" onClick={() => onOpen(invoice.id)}>
                        Ver / Pagar
                      </button>
                      {!["paid", "cancelled"].includes(invoice.status) && (
                        <button
                          type="button"
                          className="rounded-lg border border-red-500/20 px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/10"
                          onClick={() => void annul(invoice)}
                        >
                          Anular
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** @summary Tabla de proveedores. */
function SuppliersTable({
  suppliers,
  onEdit,
  onRefresh,
  setBusy,
}: {
  suppliers: Supplier[];
  onEdit: (supplier: Supplier) => void;
  onRefresh: () => Promise<void>;
  setBusy: (value: boolean) => void;
}) {
  /** @summary Elimina un proveedor sin documentos. */
  async function remove(supplier: Supplier) {
    const result = await Swal.fire({
      title: "¿Eliminar proveedor?",
      text: `Vas a eliminar “${supplier.name}”. No es posible si tiene pedidos o gastos.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ef4444",
      background: "#18181b",
      color: "#fafafa",
      reverseButtons: true,
    });
    if (!result.isConfirmed) return;
    setBusy(true);
    try {
      await api(`/api/admin/compras/proveedores/${supplier.id}`, { method: "DELETE" });
      await onRefresh();
    } catch (reason) {
      await showError("No se pudo eliminar el proveedor", reason);
    } finally {
      setBusy(false);
    }
  }

  if (!suppliers.length) {
    return (
      <div className="rounded-3xl border border-dashed border-white/15 p-12 text-center">
        <span className="text-4xl">🤝</span>
        <h3 className="mt-3 text-xl font-black">Todavía no tenés proveedores</h3>
        <p className="mt-2 text-sm text-[var(--admin-muted)]">Cargá a tus proveedores para crear pedidos y gastos.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl shadow-black/10">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--admin-border)] bg-white/[0.02] text-xs uppercase tracking-wider text-[var(--admin-muted)]">
              <th className="px-4 py-3">Proveedor</th>
              <th className="px-4 py-3">Contacto</th>
              <th className="px-4 py-3">Condiciones</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--admin-border)]/70">
            {suppliers.map((supplier) => (
              <tr key={supplier.id} className="transition-colors hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <p className="font-black">{supplier.name}</p>
                  {supplier.taxId && <p className="text-xs text-[var(--admin-muted)]">{supplier.taxId}</p>}
                </td>
                <td className="px-4 py-3 text-xs text-[var(--admin-muted)]">
                  {supplier.phone || supplier.email || "—"}
                </td>
                <td className="px-4 py-3 text-xs text-[var(--admin-muted)]">{supplier.paymentTerms || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${supplier.active === false ? "bg-zinc-500/15 text-zinc-400" : "bg-emerald-500/15 text-emerald-300"}`}>
                    {supplier.active === false ? "Inactivo" : "Activo"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1.5">
                    <button type="button" className="btn btn-secondary px-2.5 py-1.5 text-xs" onClick={() => onEdit(supplier)}>
                      Editar
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-red-500/20 px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/10"
                      onClick={() => void remove(supplier)}
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
