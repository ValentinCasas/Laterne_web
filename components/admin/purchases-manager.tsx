"use client";

import { useCallback, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { PageHeader, SearchBox, Tabs, ActionMenu } from "@/components/admin/ui";
import { InvoiceDetailModal, NewInvoiceModal, NewOrderModal, OrderDetailModal, SupplierModal } from "@/components/admin/purchases-modals";
import { SupplierDetailModal, type Supplier } from "@/components/admin/supplier-detail-modal";
import {
  type BranchOption,
  type InvoiceRow,
  type OrderRow,
  type ProductOption,
  type PurchaseInvoiceDetail,
  type PurchaseOrderDetail,
  type ReceiptRow,
} from "@/lib/purchases-types";
import { api, showError } from "@/lib/client-helpers";
import { dateLabel, money } from "@/lib/helpers";
import { purchaseInvoiceStatusLabels, purchaseOrderStatusLabels } from "@/lib/purchases";
import { Icon } from "@/components/admin/ui/icons";

/**
 * Gestor de Compras de MenuClick.
 *
 * Separa Pedido → Recepción → Factura → Pago en pestañas operativas. El pedido
 * es intención (no toca stock); la recepción física es la única que aumenta
 * inventario, en la sucursal correspondiente. Las facturas se vinculan a una o
 * varias recepciones y los pagos parciales avanzan el estado del documento.
 */

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

type OrderDetail = PurchaseOrderDetail;
type InvoiceDetail = PurchaseInvoiceDetail;

const TAB_LABELS: Array<{ key: "pedidos" | "facturas" | "proveedores"; label: string }> = [
  { key: "pedidos", label: "Pedidos" },
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

/** @summary Gestor de compras con pestañas de pedidos, recepciones, facturas y proveedores. */
export function PurchasesManager({ initial }: { initial: PurchasesPayload }) {
  const [payload, setPayload] = useState<PurchasesPayload>(initial);
  const [tab, setTab] = useState<"pedidos" | "facturas" | "proveedores">("pedidos");
  const [orderQuery, setOrderQuery] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  const [orderSupplier, setOrderSupplier] = useState("");
  const [invoiceStatus, setInvoiceStatus] = useState("");
  const [openOrder, setOpenOrder] = useState<OrderDetail | null>(null);
  const [openInvoice, setOpenInvoice] = useState<InvoiceDetail | null>(null);
  const [openSupplier, setOpenSupplier] = useState<Supplier | null>(null);
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
    <div className="space-y-6">
      <PageHeader eyebrow="Costos" title="Compras" description="Pedido → Recepción → Factura → Pago" section="compras" actions={
        <div className="flex flex-wrap gap-2">
          {tab === "pedidos" && <button type="button" className="btn" onClick={() => setCreatingOrder(true)} disabled={busy}>+ Nueva compra</button>}
          {tab === "facturas" && <button type="button" className="btn" onClick={() => setCreatingInvoice(true)} disabled={busy}>+ Nueva factura</button>}
          {tab === "proveedores" && <button type="button" className="btn" onClick={() => setEditingSupplier("new")} disabled={busy}>+ Nuevo proveedor</button>}
        </div>
      } />

      <Tabs tabs={TAB_LABELS.map((item) => ({ key: item.key, label: item.label }))} defaultTab={tab} onChange={(key) => setTab(key as "pedidos" | "facturas" | "proveedores")} />

      {/* Toolbar de filtros */}
      {(tab === "pedidos" || tab === "facturas") && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-2.5">
          <SearchBox value={orderQuery} onChange={setOrderQuery} placeholder="Buscar por número, proveedor o comprobante…" className="min-w-[220px] flex-1" />
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
      {/* Recepciones tab removed */}
      {tab === "facturas" && (
        <InvoicesTable invoices={filteredInvoices} currency={currency} onOpen={openInvoiceDetail} onRefresh={refresh} setBusy={setBusy} />
      )}
      {tab === "proveedores" && (
        <SuppliersTable
          suppliers={payload.suppliers}
          currency={currency}
          onEdit={(supplier) => setOpenSupplier(supplier)}
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
          branches={payload.branches}
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
          branches={payload.branches}
          onClose={() => setEditingSupplier(null)}
          onSaved={async (saved) => {
            setEditingSupplier(null);
            await refresh();
            const savedSupplier = saved as { id: number } | undefined;
            if (savedSupplier && openSupplier?.id === savedSupplier.id) {
              setOpenSupplier(savedSupplier as Supplier);
            }
          }}
        />
      )}
      {openSupplier && (
        <SupplierDetailModal
          supplier={openSupplier}
          branches={payload.branches}
          onClose={() => setOpenSupplier(null)}
          onUpdated={async (updated) => {
            setOpenSupplier(updated);
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
        <Icon name="package" className="mx-auto text-4xl text-zinc-600" />
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
                <tr key={order.id} className="transition-colors hover:bg-white/[0.02] cursor-pointer" onClick={() => onOpen(order.id)}>
                  <td className="px-4 py-3">
                    <button type="button" className="font-black text-pink-300 hover:underline" onClick={(e) => { e.stopPropagation(); onOpen(order.id); }}>
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
                  <td className="px-4 py-3 text-right">
                    <ActionMenu
                      align="right"
                      items={[
                        { label: "Ver", onClick: () => onOpen(order.id) },
                        ...(order.status === "draft" ? [{ label: "Enviar", onClick: () => void changeStatus(order, "sent") }] : []),
                        ...(["received", "partially_received", "sent", "draft"].includes(order.status) ? [{ label: "Cerrar", onClick: () => void changeStatus(order, "closed") }] : []),
                        ...(order.status === "draft" ? [
                          { label: "Cancelar", tone: "danger" as const, onClick: () => void changeStatus(order, "cancelled") },
                          { label: "Eliminar", tone: "danger" as const, onClick: () => void remove(order) },
                        ] : []),
                      ]}
                    />
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
        <Icon name="receipt" className="mx-auto text-4xl text-zinc-600" />
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
                <tr key={invoice.id} className="transition-colors hover:bg-white/[0.02] cursor-pointer" onClick={() => onOpen(invoice.id)}>
                  <td className="px-4 py-3">
                    <button type="button" className="font-black text-pink-300 hover:underline" onClick={(e) => { e.stopPropagation(); onOpen(invoice.id); }}>
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
                  <td className="px-4 py-3 text-right">
                    <ActionMenu
                      align="right"
                      items={[
                        { label: "Ver / Pagar", onClick: () => onOpen(invoice.id) },
                        ...(!["paid", "cancelled"].includes(invoice.status) ? [{ label: "Anular", tone: "danger" as const, onClick: () => void annul(invoice) }] : []),
                      ]}
                    />
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
  currency,
  onEdit,
  onRefresh,
  setBusy,
}: {
  suppliers: Supplier[];
  currency: string;
  onEdit: (supplier: Supplier) => void;
  onRefresh: () => Promise<void>;
  setBusy: (value: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    suppliers.forEach((supplier) => { if (supplier.category) map.set(supplier.category, (map.get(supplier.category) ?? 0) + 1); });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [suppliers]);

  const visible = useMemo(() => {
    return suppliers.filter((supplier) => {
      if (query && !supplier.name.toLowerCase().includes(query.toLowerCase()) && !(supplier.taxId ?? "").toLowerCase().includes(query.toLowerCase())) return false;
      if (statusFilter && supplier.status !== statusFilter) return false;
      if (categoryFilter && supplier.category !== categoryFilter) return false;
      return true;
    });
  }, [suppliers, query, statusFilter, categoryFilter]);

  /** @summary Elimina un proveedor sin documentos. */
  async function remove(supplier: Supplier) {
    const result = await Swal.fire({
      title: "¿Eliminar proveedor?",
      text: `Vas a eliminar “${supplier.name}”. No es posible si tiene pedidos, recepciones, facturas, gastos o movimientos.`,
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
      const message = reason instanceof Error ? reason.message : "";
      const retry = await Swal.fire({
        title: "No se pudo eliminar",
        text: message || "El proveedor tiene historial asociado. ¿Querés bloquearlo en su lugar?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Bloquear",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#ef4444",
        background: "#18181b",
        color: "#fafafa",
      });
      if (retry.isConfirmed) {
        try {
          await api(`/api/admin/compras/proveedores/${supplier.id}`, { method: "PUT", body: JSON.stringify({ status: "blocked", blockedReason: "Bloqueado por tener historial asociado" }) });
          await Swal.fire({ title: "Proveedor bloqueado", icon: "success", timer: 1500, showConfirmButton: false, background: "#18181b", color: "#fafafa" });
          await onRefresh();
        } catch {
          await showError("No se pudo bloquear el proveedor", reason);
        }
      }
    } finally {
      setBusy(false);
    }
  }

  if (!suppliers.length) {
    return (
      <div className="rounded-3xl border border-dashed border-white/15 p-12 text-center">
        <Icon name="users" className="mx-auto text-4xl text-zinc-600" />
        <h3 className="mt-3 text-xl font-black">Todavía no tenés proveedores</h3>
        <p className="mt-2 text-sm text-[var(--admin-muted)]">Cargá a tus proveedores para crear pedidos y gastos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input className="input w-auto" placeholder="Buscar por nombre o CUIT…" value={query} onChange={(event) => setQuery(event.target.value)} />
        <select className="input w-auto" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="">Todos los estados</option>
          <option value="active">Activo</option>
          <option value="blocked">Bloqueado</option>
          <option value="suspended">Suspendido</option>
        </select>
        {categories.length > 0 && (
          <select className="input w-auto" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="">Todas las categorías</option>
            {categories.map(([name]) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        )}
      </div>
      <div className="overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl shadow-black/10">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--admin-border)] bg-white/[0.02] text-xs uppercase tracking-wider text-[var(--admin-muted)]">
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Proveedor</th>
                <th className="px-4 py-3">CUIT</th>
                <th className="px-4 py-3">Contacto</th>
                <th className="px-4 py-3">Condiciones</th>
                <th className="px-4 py-3 text-right">Saldo</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--admin-border)]/70">
              {visible.map((supplier) => (
                <tr key={supplier.id} className="transition-colors hover:bg-white/[0.02] cursor-pointer" onClick={() => onEdit(supplier)}>
                  <td className="px-4 py-3 text-xs text-[var(--admin-muted)]">{supplier.code ?? "—"}</td>
                  <td className="px-4 py-3">
                    <button type="button" className="font-black text-pink-300 hover:underline" onClick={(e) => { e.stopPropagation(); onEdit(supplier); }}>
                      {supplier.name}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--admin-muted)]">{supplier.taxId ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-[var(--admin-muted)]">
                    {supplier.contactName ?? supplier.phone ?? supplier.email ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--admin-muted)]">{supplier.paymentTerms || "—"}</td>
                  <td className="px-4 py-3 text-right text-sm font-bold tabular-nums">
                    {money(supplier.currentBalance ?? 0, currency)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${supplier.status === "active" ? "bg-emerald-500/15 text-emerald-300" : supplier.status === "blocked" ? "bg-rose-500/15 text-rose-300" : "bg-amber-500/15 text-amber-300"}`}>
                      {supplier.status === "active" ? "Activo" : supplier.status === "blocked" ? "Bloqueado" : "Suspendido"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ActionMenu
                      align="right"
                      items={[
                        { label: "Ver / Editar", onClick: () => onEdit(supplier) },
                        { label: "Eliminar", tone: "danger", onClick: () => void remove(supplier) },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
