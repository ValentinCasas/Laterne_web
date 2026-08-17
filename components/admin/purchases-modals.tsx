"use client";

import { useMemo, useState } from "react";
import Swal from "sweetalert2";
import { scopedFetch } from "@/lib/client-routing";
import { purchaseInvoiceStatusLabels, purchaseOrderStatusLabels } from "@/lib/purchases";

/**
 * Modales del gestor de Compras.
 *
 * Cubren el flujo completo: alta de pedido (proveedor → líneas → revisar),
 * detalle de pedido con recepción física y pendiente en vivo, alta de factura
 * vinculada a recepciones, pagos parciales/totales y proveedores.
 */

type Supplier = { id: number; name: string; code?: string | null; taxId?: string | null; contactName?: string | null; phone?: string | null; email?: string | null; address?: string | null; paymentTerms?: string | null; currency?: string | null; category?: string | null; creditLimit?: number | null; status?: string; notes?: string | null; branches?: Array<{ branch: { id: number; name: string } }> };
type BranchOption = { id: number; name: string; slug: string; active: boolean };
type ProductOption = { id: number; name: string; cost?: number | string | null; costUnit?: string | null; imageUrl?: string | null };
type ReceiptRow = {
  id: number;
  number: string;
  receivedAt: string;
  supplier: { id: number; name: string };
  branch: { id: number; name: string };
  order?: { id: number; number: string } | null;
  items: Array<{ id: number; quantity: string | number; unit: string; unitCost: string | number; product?: { id: number; name: string } }>;
};
type OrderDetail = {
  id: number;
  number: string;
  status: string;
  orderDate: string;
  expectedDate?: string | null;
  externalReference?: string | null;
  notes?: string | null;
  supplier: { id: number; name: string; paymentTerms?: string | null };
  branch: { id: number; name: string };
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
type InvoiceDetail = {
  id: number;
  number: string;
  status: string;
  documentDate: string;
  dueDate?: string | null;
  externalNumber?: string | null;
  financialCategory?: string | null;
  notes?: string | null;
  supplier: { id: number; name: string; paymentTerms?: string | null };
  branch?: { id: number; name: string } | null;
  subtotal: string | number;
  taxAmount: string | number;
  total: string | number;
  paidAmount: string | number;
  items: Array<{ id: number; productId?: number | null; description: string; quantity: string | number; unit: string; unitCost: string | number; discountPercent?: string | number; taxPercent?: string | number }>;
  payments: Array<{ id: number; number: string; amount: string | number; method: string; paidAt: string; notes?: string | null; createdBy?: { id: number; name: string } | null }>;
  receipts: Array<{ receipt: ReceiptRow }>;
};

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

/** @summary Marco base de los modales del módulo. */
function ModalFrame({
  title,
  subtitle,
  onClose,
  children,
  wide,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/70 p-0 backdrop-blur-sm sm:p-4">
      <div
        className={`flex h-full w-full flex-col overflow-hidden rounded-none border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-2xl sm:rounded-[1.5rem] ${
          wide ? "max-w-4xl" : "max-w-2xl"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-border)] px-5 py-4">
          <div>
            <h2 className="text-xl font-black">{title}</h2>
            {subtitle && <p className="text-sm text-[var(--admin-muted)]">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="btn btn-secondary" type="button">
            ✕ Cerrar
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

/** @summary Alta de pedido de compra en pasos simples. */
export function NewOrderModal({
  branches,
  suppliers,
  products,
  currency,
  activeBranchId,
  onClose,
  onSaved,
}: {
  branches: BranchOption[];
  suppliers: Supplier[];
  products: ProductOption[];
  currency: string;
  activeBranchId: number | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const [supplierId, setSupplierId] = useState("");
  const [branchId, setBranchId] = useState(activeBranchId ? String(activeBranchId) : "");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<Array<{ key: string; productId: number; name: string; quantity: string; unit: string; unitCost: string }>>([]);
  const [saving, setSaving] = useState(false);

  const selectedSupplier = suppliers.find((supplier) => String(supplier.id) === supplierId);
  const results = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase("es");
    if (!normalized) return [];
    return products.filter((product) => product.name.toLocaleLowerCase("es").includes(normalized)).slice(0, 10);
  }, [products, search]);

  /** @summary Agrega una línea al pedido. */
  function addLine(product: ProductOption) {
    if (lines.some((line) => line.productId === product.id)) return;
    setLines((current) => [
      ...current,
      {
        key: `line-${Date.now()}-${product.id}`,
        productId: product.id,
        name: product.name,
        quantity: "1",
        unit: product.costUnit || "unidad",
        unitCost: product.cost !== null && product.cost !== undefined ? String(product.cost) : "",
      },
    ]);
    setSearch("");
  }

  const total = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unitCost) || 0), 0);

  /** @summary Guarda el pedido y notifica al tablero. */
  async function save() {
    if (!supplierId || !branchId) {
      await Swal.fire({ title: "Falta el proveedor o la sucursal", icon: "warning", background: "#18181b", color: "#fafafa" });
      return;
    }
    if (!lines.length) {
      await Swal.fire({ title: "Agregá al menos un producto", icon: "warning", background: "#18181b", color: "#fafafa" });
      return;
    }
    setSaving(true);
    try {
      await api("/api/admin/compras", {
        method: "POST",
        body: JSON.stringify({
          supplierId: Number(supplierId),
          branchId: Number(branchId),
          expectedDate: expectedDate || null,
          notes: notes || undefined,
          lines: lines.map((line) => ({
            productId: line.productId,
            quantity: Number(line.quantity),
            unit: line.unit || "unidad",
            unitCost: Number(line.unitCost) || 0,
          })),
        }),
      });
      await Swal.fire({ title: "Pedido creado", text: "El pedido no modifica stock: se recibe al confirmar la recepción.", icon: "success", timer: 1800, showConfirmButton: false, background: "#18181b", color: "#fafafa" });
      await onSaved();
    } catch (reason) {
      await showError("No se pudo crear el pedido", reason);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalFrame title="Nueva compra" subtitle={`Paso ${step + 1} de 3 · ${["Proveedor y sucursal", "Productos y cantidades", "Revisar y guardar"][step]}`} onClose={onClose} wide>
      {step === 0 && (
        <div className="space-y-4">
          <label className="block">
            <span className="block text-sm font-semibold text-[var(--admin-muted)]">Proveedor</span>
            <select className="input mt-1" value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
              <option value="">Elegí un proveedor…</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={String(supplier.id)}>{supplier.name}</option>
              ))}
            </select>
          </label>
          {selectedSupplier?.paymentTerms && (
            <p className="text-xs text-[var(--admin-muted)]">Condiciones: {selectedSupplier.paymentTerms}</p>
          )}
          <label className="block">
            <span className="block text-sm font-semibold text-[var(--admin-muted)]">Sucursal donde llega la mercadería</span>
            <select className="input mt-1" value={branchId} onChange={(event) => setBranchId(event.target.value)}>
              <option value="">Elegí una sucursal…</option>
              {branches.map((branch) => (
                <option key={branch.id} value={String(branch.id)}>{branch.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-sm font-semibold text-[var(--admin-muted)]">Fecha esperada (opcional)</span>
            <input className="input mt-1" type="date" value={expectedDate} onChange={(event) => setExpectedDate(event.target.value)} />
          </label>
          <label className="block">
            <span className="block text-sm font-semibold text-[var(--admin-muted)]">Notas (opcional)</span>
            <textarea className="input mt-1 min-h-20" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Referencia del pedido, condiciones acordadas…" />
          </label>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--admin-border)] bg-white/[0.02] p-3">
            <input
              className="input w-full"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar producto o ingrediente…"
              aria-label="Buscar producto para el pedido"
            />
            {results.length > 0 && (
              <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
                {results.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left hover:bg-white/5"
                    onClick={() => addLine(product)}
                  >
                    <span className="font-semibold">{product.name}</span>
                    <span className="text-xs text-[var(--admin-muted)]">
                      {product.cost ? money(product.cost, currency) : "sin costo"} / {product.costUnit || "unidad"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {lines.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-[var(--admin-muted)]">
              Buscá y tocá un producto para agregarlo al pedido.
            </p>
          ) : (
            <div className="space-y-2">
              {lines.map((line) => (
                <div key={line.key} className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-2 rounded-xl border border-[var(--admin-border)] bg-white/[0.02] px-3 py-2">
                  <span className="min-w-0 truncate font-semibold">{line.name}</span>
                  <input
                    className="input w-20 py-1 text-right"
                    type="number"
                    min={0}
                    step="0.001"
                    value={line.quantity}
                    onChange={(event) =>
                      setLines((current) => current.map((entry) => (entry.key === line.key ? { ...entry, quantity: event.target.value } : entry)))
                    }
                    aria-label={`Cantidad de ${line.name}`}
                  />
                  <span className="w-14 text-xs text-[var(--admin-muted)]">{line.unit}</span>
                  <input
                    className="input w-28 py-1 text-right"
                    type="number"
                    min={0}
                    step="0.01"
                    value={line.unitCost}
                    onChange={(event) =>
                      setLines((current) => current.map((entry) => (entry.key === line.key ? { ...entry, unitCost: event.target.value } : entry)))
                    }
                    aria-label={`Costo de ${line.name}`}
                  />
                  <button
                    type="button"
                    className="rounded-lg border border-red-500/20 px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/10"
                    onClick={() => setLines((current) => current.filter((entry) => entry.key !== line.key))}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <p className="text-right text-sm font-black tabular-nums">
                Total estimado: {money(total, currency)}
              </p>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--admin-border)] bg-white/[0.02] p-4">
            <p className="text-xs font-black uppercase tracking-widest text-[var(--admin-muted)]">Resumen</p>
            <div className="mt-3 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-[var(--admin-muted)]">Proveedor</span><span className="font-bold">{selectedSupplier?.name ?? "—"}</span></div>
              <div className="flex justify-between text-sm"><span className="text-[var(--admin-muted)]">Sucursal</span><span className="font-bold">{branches.find((branch) => String(branch.id) === branchId)?.name ?? "—"}</span></div>
              <div className="flex justify-between text-sm"><span className="text-[var(--admin-muted)]">Líneas</span><span className="font-bold">{lines.length}</span></div>
              {lines.map((line) => (
                <div key={line.key} className="flex justify-between text-xs text-[var(--admin-muted)]">
                  <span>{line.name} · {line.quantity} {line.unit}</span>
                  <span>{money(Number(line.quantity) * Number(line.unitCost), currency)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-white/10 pt-2 text-base font-black">
                <span>Total estimado</span><span>{money(total, currency)}</span>
              </div>
            </div>
            <p className="mt-3 text-xs text-[var(--admin-muted)]">
              Guardar el pedido no modifica inventario. El stock aumentará recién cuando confirmes la recepción.
            </p>
          </div>
        </div>
      )}

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-[var(--admin-border)] pt-4">
        <div className="flex gap-2">
          {step > 0 && (
            <button type="button" className="btn btn-secondary" onClick={() => setStep((value) => value - 1)} disabled={saving}>
              ← Anterior
            </button>
          )}
          {step < 2 && (
            <button type="button" className="btn" onClick={() => setStep((value) => value + 1)} disabled={saving}>
              Siguiente →
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          {step === 2 && (
            <button type="button" className="btn" onClick={() => void save()} disabled={saving}>
              {saving ? "Guardando…" : "Guardar pedido"}
            </button>
          )}
        </div>
      </div>
    </ModalFrame>
  );
}

/** @summary Detalle de pedido con recepción física e historial. */
export function OrderDetailModal({
  order,
  currency,
  onClose,
  onUpdated,
  setBusy,
  branches,
}: {
  order: OrderDetail;
  currency: string;
  onClose: () => void;
  onUpdated: (updated: OrderDetail) => Promise<void>;
  setBusy: (value: boolean) => void;
  branches: BranchOption[];
}) {
  const [receivingFor, setReceivingFor] = useState<number | null>(null);
  const [receiveQty, setReceiveQty] = useState("");
  const [receiveCost, setReceiveCost] = useState("");
  const [receiveNotes, setReceiveNotes] = useState("");
  const [receiptBranchId, setReceiptBranchId] = useState<string>(order.branch?.id ? String(order.branch.id) : "");
  const [saving, setSaving] = useState(false);

  const canReceive = !["cancelled", "closed"].includes(order.status);
  const hasBranch = order.branch && order.branch.id > 0;

  /** @summary Confirma una recepción física y refresca el detalle. */
  async function confirmReceipt() {
    if (receivingFor === null) return;
    const line = order.items.find((item) => item.id === receivingFor);
    if (!line) return;
    const quantity = Number(receiveQty);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      await Swal.fire({ title: "Indicá una cantidad válida", icon: "warning", background: "#18181b", color: "#fafafa" });
      return;
    }
    setSaving(true);
    try {
      const result = await api<{ item: ReceiptRow }>(`/api/admin/compras/${order.id}/recepciones`, {
        method: "POST",
        body: JSON.stringify({
          notes: receiveNotes || undefined,
          branchId: hasBranch ? undefined : Number(receiptBranchId),
          items: [{ orderItemId: receivingFor, quantity, unit: line.unit, unitCost: Number(receiveCost) || Number(line.unitCost) }],
        }),
      });
      setBusy(true);
      try {
        const updated = await api<OrderDetail>(`/api/admin/compras/${order.id}`);
        await onUpdated(updated);
      } finally {
        setBusy(false);
      }
      await Swal.fire({
        title: `Recepción ${result.item.number} confirmada`,
        text: "El stock de la sucursal aumentó con el costo informado.",
        icon: "success",
        timer: 1800,
        showConfirmButton: false,
        background: "#18181b",
        color: "#fafafa",
      });
      setReceivingFor(null);
      setReceiveQty("");
      setReceiveNotes("");
    } catch (reason) {
      await showError("No se pudo registrar la recepción", reason);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalFrame
      title={order.number}
      subtitle={`${order.supplier.name} · ${order.branch.name} · ${dateLabel(order.orderDate)}`}
      onClose={onClose}
      wide
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${ORDER_STATUS_COLORS[order.status] ?? ORDER_STATUS_COLORS.draft}`}>
            {purchaseOrderStatusLabels[order.status] ?? order.status}
          </span>
          {order.externalReference && <span className="text-sm text-[var(--admin-muted)]">Ref. {order.externalReference}</span>}
          <span className="ml-auto text-sm text-[var(--admin-muted)]">
            Esperada: {dateLabel(order.expectedDate)}
          </span>
        </div>

        {/* Líneas con pendiente y recepción */}
        <div className="overflow-hidden rounded-2xl border border-[var(--admin-border)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--admin-border)] bg-white/[0.02] text-xs uppercase tracking-wider text-[var(--admin-muted)]">
                  <th className="px-4 py-2.5">Producto</th>
                  <th className="px-4 py-2.5 text-right">Pedido</th>
                  <th className="px-4 py-2.5 text-right">Recibido</th>
                  <th className="px-4 py-2.5 text-right">Pendiente</th>
                  <th className="px-4 py-2.5 text-right">Costo esperado</th>
                  <th className="px-4 py-2.5 text-right">Recibir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--admin-border)]/70">
                {order.items.map((item) => {
                  const ordered = Number(item.quantity);
                  const received = Number(item.receivedQuantity);
                  const pending = ordered - received;
                  return (
                    <tr key={item.id}>
                      <td className="px-4 py-3 font-semibold">{item.product.name}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{ordered} {item.unit}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-emerald-300">{received}</td>
                      <td className={`px-4 py-3 text-right font-bold tabular-nums ${pending > 0 ? "text-amber-300" : "text-zinc-500"}`}>{pending}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{money(item.unitCost, currency)}/{item.unit}</td>
                      <td className="px-4 py-3 text-right">
                        {canReceive && pending > 0 ? (
                          <button type="button" className="btn btn-secondary px-2.5 py-1 text-xs" onClick={() => { setReceivingFor(item.id); setReceiveQty(String(pending)); setReceiveCost(String(item.unitCost)); }}>
                            Recibir
                          </button>
                        ) : pending <= 0 ? (
                          <span className="text-xs text-emerald-300">Completo</span>
                        ) : (
                          <span className="text-xs text-zinc-500">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Formulario de recepción */}
        {receivingFor !== null && (
          <div className="rounded-2xl border border-pink-500/25 bg-pink-500/[0.04] p-4">
            <p className="text-sm font-black text-pink-300">Confirmar recepción</p>
            <p className="mt-1 text-xs text-[var(--admin-muted)]">
              Sucursal de recepción: {order.branch?.name ?? "Sin sucursal asignada"}
            </p>
            {!hasBranch && (
              <label className="mt-2 block">
                <span className="block text-xs font-semibold text-[var(--admin-muted)]">Sucursal receptora *</span>
                <select className="input mt-1" value={receiptBranchId} onChange={(event) => setReceiptBranchId(event.target.value)} aria-label="Sucursal de recepción">
                  <option value="">Elegí una sucursal</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={String(branch.id)}>{branch.name}</option>
                  ))}
                </select>
              </label>
            )}
            {(() => {
              const line = order.items.find((item) => item.id === receivingFor);
              if (!line) return null;
              const pending = Number(line.quantity) - Number(line.receivedQuantity);
              return (
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <label className="block">
                    <span className="block text-xs font-semibold text-[var(--admin-muted)]">Cantidad recibida ahora ({line.unit})</span>
                    <input className="input mt-1" type="number" min={0} max={pending} step="0.001" value={receiveQty} onChange={(event) => setReceiveQty(event.target.value)} aria-label="Cantidad a recibir" />
                  </label>
                  <label className="block">
                    <span className="block text-xs font-semibold text-[var(--admin-muted)]">Costo informado (por {line.unit})</span>
                    <input className="input mt-1" type="number" min={0} step="0.01" value={receiveCost} onChange={(event) => setReceiveCost(event.target.value)} aria-label="Costo de recepción" />
                  </label>
                  <label className="block">
                    <span className="block text-xs font-semibold text-[var(--admin-muted)]">Notas (opcional)</span>
                    <input className="input mt-1" value={receiveNotes} onChange={(event) => setReceiveNotes(event.target.value)} placeholder="Remito, estado de la mercadería…" />
                  </label>
                  <div className="flex items-center gap-2 sm:col-span-3">
                    <span className="text-xs text-[var(--admin-muted)]">Quedarán pendientes {Math.max(0, pending - Number(receiveQty))} {line.unit}.</span>
                    <button type="button" className="btn ml-auto" onClick={() => void confirmReceipt()} disabled={saving}>
                      {saving ? "Confirmando…" : "Confirmar recepción"}
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => setReceivingFor(null)} disabled={saving}>Cancelar</button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Historial de recepciones */}
        <div>
          <h3 className="text-sm font-black uppercase tracking-widest text-[var(--admin-muted)]">Historial de recepciones</h3>
          {order.receipts.length === 0 ? (
            <p className="mt-2 rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-[var(--admin-muted)]">
              Todavía no se recibió mercadería de este pedido.
            </p>
          ) : (
            <div className="mt-2 space-y-2">
              {order.receipts.map((receipt) => (
                <div key={receipt.id} className="rounded-xl border border-[var(--admin-border)] bg-white/[0.02] px-4 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-black text-pink-300">{receipt.number}</span>
                    <span className="text-xs text-[var(--admin-muted)]">{dateLabel(receipt.receivedAt)}</span>
                    {receipt.createdBy && <span className="text-xs text-[var(--admin-muted)]">por {receipt.createdBy.name}</span>}
                  </div>
                  <p className="mt-1 text-xs text-[var(--admin-muted)]">
                    {receipt.items.map((item) => `${item.product?.name ?? item.product?.id ?? item.id} × ${item.quantity} ${item.unit} a ${money(item.unitCost, currency)}`).join(" · ")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Facturas vinculadas */}
        <div>
          <h3 className="text-sm font-black uppercase tracking-widest text-[var(--admin-muted)]">Facturas del proveedor sobre este pedido</h3>
          {order.invoices.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--admin-muted)]">Sin facturas vinculadas todavía.</p>
          ) : (
            <div className="mt-2 space-y-2">
              {order.invoices.map((invoice) => (
                <div key={invoice.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--admin-border)] bg-white/[0.02] px-4 py-2.5 text-sm">
                  <span className="font-black text-pink-300">{invoice.number}</span>
                  <span className="text-[var(--admin-muted)]">{dateLabel(invoice.documentDate)}</span>
                  <span className="font-bold tabular-nums">{money(invoice.total, currency)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${INVOICE_STATUS_COLORS[invoice.status] ?? INVOICE_STATUS_COLORS.draft}`}>
                    {purchaseInvoiceStatusLabels[invoice.status] ?? invoice.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {order.notes && (
          <p className="rounded-xl border border-[var(--admin-border)] bg-white/[0.02] p-3 text-sm text-[var(--admin-muted)]">
            {order.notes}
          </p>
        )}
      </div>
    </ModalFrame>
  );
}

/** @summary Alta de factura de compra vinculada a recepciones. */
export function NewInvoiceModal({
  suppliers,
  receipts,
  currency,
  activeBranchId,
  onClose,
  onSaved,
}: {
  suppliers: Supplier[];
  receipts: ReceiptRow[];
  currency: string;
  activeBranchId: number | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [supplierId, setSupplierId] = useState("");
  const [documentDate, setDocumentDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [externalNumber, setExternalNumber] = useState("");
  const [financialCategory, setFinancialCategory] = useState("insumos");
  const [notes, setNotes] = useState("");
  const [selectedReceipts, setSelectedReceipts] = useState<Set<number>>(new Set());
  const [lines, setLines] = useState<Array<{ key: string; productId: number | null; description: string; quantity: string; unit: string; unitCost: string }>>([]);
  const [saving, setSaving] = useState(false);

  const supplierReceipts = useMemo(
    () => receipts.filter((receipt) => supplierId && String(receipt.supplier.id) === supplierId),
    [receipts, supplierId],
  );

  /** @summary Vincula una recepción y precarga sus líneas. */
  function toggleReceipt(receiptId: number) {
    setSelectedReceipts((current) => {
      const next = new Set(current);
      if (next.has(receiptId)) {
        next.delete(receiptId);
        return next;
      }
      next.add(receiptId);
      const receipt = supplierReceipts.find((item) => item.id === receiptId);
      if (receipt) {
        setLines((existing) => [
          ...existing.filter((line) => !receipt.items.some((item) => (item.product?.id ?? item.id) === line.productId)),
          ...receipt.items.map((item) => ({
            key: `receipt-${receiptId}-${item.product?.id ?? item.id}`,
            productId: item.product?.id ?? null,
            description: item.product?.name ?? `Producto ${item.product?.id ?? item.id}`,
            quantity: String(item.quantity),
            unit: item.unit,
            unitCost: String(item.unitCost),
          })),
        ]);
      }
      return next;
    });
  }

  const subtotal = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unitCost) || 0), 0);
  const total = subtotal;

  /** @summary Guarda la factura. */
  async function save() {
    if (!supplierId) {
      await Swal.fire({ title: "Elegí el proveedor", icon: "warning", background: "#18181b", color: "#fafafa" });
      return;
    }
    if (!lines.length) {
      await Swal.fire({ title: "Agregá líneas o vinculá recepciones", icon: "warning", background: "#18181b", color: "#fafafa" });
      return;
    }
    setSaving(true);
    try {
      await api("/api/admin/compras/facturas", {
        method: "POST",
        body: JSON.stringify({
          supplierId: Number(supplierId),
          branchId: activeBranchId,
          receiptIds: [...selectedReceipts],
          documentDate,
          dueDate: dueDate || null,
          externalNumber: externalNumber || undefined,
          financialCategory,
          notes: notes || undefined,
          items: lines.map((line) => ({
            productId: line.productId,
            description: line.description,
            quantity: Number(line.quantity),
            unit: line.unit || "unidad",
            unitCost: Number(line.unitCost) || 0,
          })),
        }),
      });
      await Swal.fire({ title: "Factura creada", text: "Quedó pendiente de pago y disponible para Finanzas.", icon: "success", timer: 1800, showConfirmButton: false, background: "#18181b", color: "#fafafa" });
      await onSaved();
    } catch (reason) {
      await showError("No se pudo crear la factura", reason);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalFrame title="Nueva factura de proveedor" subtitle="Vinculá las recepciones que documenta y revisá el total" onClose={onClose} wide>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="block text-sm font-semibold text-[var(--admin-muted)]">Proveedor</span>
          <select className="input mt-1" value={supplierId} onChange={(event) => { setSupplierId(event.target.value); setSelectedReceipts(new Set()); setLines([]); }}>
            <option value="">Elegí un proveedor…</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={String(supplier.id)}>{supplier.name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-sm font-semibold text-[var(--admin-muted)]">Comprobante externo</span>
          <input className="input mt-1" value={externalNumber} onChange={(event) => setExternalNumber(event.target.value)} placeholder="N° de factura del proveedor" />
        </label>
        <label className="block">
          <span className="block text-sm font-semibold text-[var(--admin-muted)]">Fecha del documento</span>
          <input className="input mt-1" type="date" value={documentDate} onChange={(event) => setDocumentDate(event.target.value)} />
        </label>
        <label className="block">
          <span className="block text-sm font-semibold text-[var(--admin-muted)]">Vencimiento</span>
          <input className="input mt-1" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </label>
        <label className="block sm:col-span-2">
          <span className="block text-sm font-semibold text-[var(--admin-muted)]">Categoría financiera</span>
          <select className="input mt-1" value={financialCategory} onChange={(event) => setFinancialCategory(event.target.value)}>
            {["insumos", "alquiler", "servicios", "personal", "marketing", "administracion", "mantenimiento", "otros"].map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </label>
      </div>

      {supplierId && (
        <div className="mt-4">
          <p className="text-xs font-black uppercase tracking-widest text-[var(--admin-muted)]">Recepciones a vincular ({supplierReceipts.length})</p>
          {supplierReceipts.length === 0 ? (
            <p className="mt-2 rounded-xl border border-dashed border-white/15 p-4 text-center text-sm text-[var(--admin-muted)]">
              Este proveedor todavía no tiene recepciones. Podés cargar las líneas manualmente.
            </p>
          ) : (
            <div className="mt-2 max-h-44 space-y-1.5 overflow-y-auto">
              {supplierReceipts.map((receipt) => (
                <label key={receipt.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--admin-border)] bg-white/[0.02] px-3 py-2 text-sm hover:bg-white/5">
                  <input
                    type="checkbox"
                    checked={selectedReceipts.has(receipt.id)}
                    onChange={() => toggleReceipt(receipt.id)}
                    className="accent-pink-500"
                  />
                  <span className="font-bold text-pink-300">{receipt.number}</span>
                  <span className="text-xs text-[var(--admin-muted)]">{dateLabel(receipt.receivedAt)}</span>
                  <span className="ml-auto text-xs text-[var(--admin-muted)]">
                    {receipt.items.map((item) => `${item.product?.name ?? item.product?.id ?? item.id} × ${item.quantity}`).join(", ")}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-4 space-y-2">
        <p className="text-xs font-black uppercase tracking-widest text-[var(--admin-muted)]">Líneas de la factura</p>
        {lines.length === 0 && (
          <p className="rounded-xl border border-dashed border-white/15 p-4 text-center text-sm text-[var(--admin-muted)]">
            Vinculá recepciones arriba para precargar las líneas.
          </p>
        )}
        {lines.map((line) => (
          <div key={line.key} className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-2 rounded-xl border border-[var(--admin-border)] bg-white/[0.02] px-3 py-2">
            <span className="min-w-0 truncate font-semibold">{line.description}</span>
            <input
              className="input w-20 py-1 text-right"
              type="number"
              min={0}
              step="0.001"
              value={line.quantity}
              onChange={(event) => setLines((current) => current.map((entry) => (entry.key === line.key ? { ...entry, quantity: event.target.value } : entry)))}
              aria-label={`Cantidad de ${line.description}`}
            />
            <span className="w-14 text-xs text-[var(--admin-muted)]">{line.unit}</span>
            <input
              className="input w-28 py-1 text-right"
              type="number"
              min={0}
              step="0.01"
              value={line.unitCost}
              onChange={(event) => setLines((current) => current.map((entry) => (entry.key === line.key ? { ...entry, unitCost: event.target.value } : entry)))}
              aria-label={`Costo de ${line.description}`}
            />
            <button type="button" className="rounded-lg border border-red-500/20 px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/10" onClick={() => setLines((current) => current.filter((entry) => entry.key !== line.key))}>✕</button>
          </div>
        ))}
        <p className="text-right text-base font-black tabular-nums">Total: {money(total, currency)}</p>
      </div>

      <label className="mt-3 block">
        <span className="block text-sm font-semibold text-[var(--admin-muted)]">Notas</span>
        <textarea className="input mt-1 min-h-16" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Condiciones, observaciones…" />
      </label>

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-[var(--admin-border)] pt-4">
        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
        <button type="button" className="btn" onClick={() => void save()} disabled={saving}>
          {saving ? "Guardando…" : "Crear factura"}
        </button>
      </div>
    </ModalFrame>
  );
}

/** @summary Detalle de factura con pagos parciales y saldo. */
export function InvoiceDetailModal({
  invoice,
  currency,
  onClose,
  onUpdated,
  setBusy,
}: {
  invoice: InvoiceDetail;
  currency: string;
  onClose: () => void;
  onUpdated: (updated: InvoiceDetail) => Promise<void>;
  setBusy: (value: boolean) => void;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("transferencia");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [payNotes, setPayNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const balance = Number(invoice.total) - Number(invoice.paidAmount);
  const canPay = !["paid", "cancelled"].includes(invoice.status) && balance > 0;

  /** @summary Registra un pago y refresca el detalle. */
  async function registerPayment() {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      await Swal.fire({ title: "Indicá un monto válido", icon: "warning", background: "#18181b", color: "#fafafa" });
      return;
    }
    setSaving(true);
    try {
      await api(`/api/admin/compras/facturas/${invoice.id}/pagos`, {
        method: "POST",
        body: JSON.stringify({ amount: value, method, paidAt, notes: payNotes || undefined }),
      });
      setBusy(true);
      try {
        const updated = await api<InvoiceDetail>(`/api/admin/compras/facturas/${invoice.id}`);
        await onUpdated(updated);
      } finally {
        setBusy(false);
      }
      await Swal.fire({ title: "Pago registrado", icon: "success", timer: 1500, showConfirmButton: false, background: "#18181b", color: "#fafafa" });
      setAmount("");
      setPayNotes("");
    } catch (reason) {
      await showError("No se pudo registrar el pago", reason);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalFrame
      title={invoice.number}
      subtitle={`${invoice.supplier.name} · ${dateLabel(invoice.documentDate)}${invoice.externalNumber ? ` · Comp. ${invoice.externalNumber}` : ""}`}
      onClose={onClose}
      wide
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${INVOICE_STATUS_COLORS[invoice.status] ?? INVOICE_STATUS_COLORS.draft}`}>
            {purchaseInvoiceStatusLabels[invoice.status] ?? invoice.status}
          </span>
          <span className="text-sm font-black tabular-nums">Total {money(invoice.total, currency)}</span>
          <span className={`text-sm font-black tabular-nums ${balance > 0 ? "text-amber-300" : "text-emerald-300"}`}>Saldo {money(balance, currency)}</span>
          <span className="ml-auto text-sm text-[var(--admin-muted)]">Vence {dateLabel(invoice.dueDate)}</span>
        </div>

        {/* Líneas */}
        <div className="overflow-hidden rounded-2xl border border-[var(--admin-border)]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--admin-border)] bg-white/[0.02] text-xs uppercase tracking-wider text-[var(--admin-muted)]">
                <th className="px-4 py-2.5">Concepto</th>
                <th className="px-4 py-2.5 text-right">Cantidad</th>
                <th className="px-4 py-2.5 text-right">Costo</th>
                <th className="px-4 py-2.5 text-right">Importe</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--admin-border)]/70">
              {invoice.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-2.5 font-semibold">{item.description}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{item.quantity} {item.unit}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{money(item.unitCost, currency)}</td>
                  <td className="px-4 py-2.5 text-right font-bold tabular-nums">{money(Number(item.quantity) * Number(item.unitCost), currency)}</td>
                </tr>
              ))}
              <tr className="bg-white/[0.02]">
                <td className="px-4 py-2.5" colSpan={3}>Subtotal</td>
                <td className="px-4 py-2.5 text-right font-bold tabular-nums">{money(invoice.subtotal, currency)}</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5" colSpan={3}>Impuestos</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{money(invoice.taxAmount, currency)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Recepciones vinculadas */}
        {invoice.receipts.length > 0 && (
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-[var(--admin-muted)]">Recepciones que documenta</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {invoice.receipts.map(({ receipt }) => (
                <span key={receipt.id} className="rounded-full border border-[var(--admin-border)] bg-white/5 px-3 py-1 text-xs font-bold">
                  {receipt.number} · {dateLabel(receipt.receivedAt)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Pagos */}
        <div>
          <h3 className="text-sm font-black uppercase tracking-widest text-[var(--admin-muted)]">Pagos ({invoice.payments.length})</h3>
          {invoice.payments.length === 0 ? (
            <p className="mt-2 rounded-xl border border-dashed border-white/15 p-4 text-center text-sm text-[var(--admin-muted)]">
              Sin pagos registrados.
            </p>
          ) : (
            <div className="mt-2 space-y-2">
              {invoice.payments.map((payment) => (
                <div key={payment.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--admin-border)] bg-white/[0.02] px-4 py-2.5 text-sm">
                  <span className="font-black text-pink-300">{payment.number}</span>
                  <span className="font-bold tabular-nums">{money(payment.amount, currency)}</span>
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-black uppercase">{payment.method}</span>
                  <span className="text-xs text-[var(--admin-muted)]">{dateLabel(payment.paidAt)}</span>
                  {payment.createdBy && <span className="text-xs text-[var(--admin-muted)]">por {payment.createdBy.name}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Registrar pago */}
        {canPay && (
          <div className="rounded-2xl border border-pink-500/25 bg-pink-500/[0.04] p-4">
            <p className="text-sm font-black text-pink-300">Registrar pago</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-4">
              <label className="block">
                <span className="block text-xs font-semibold text-[var(--admin-muted)]">Monto</span>
                <input className="input mt-1" type="number" min={0} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder={String(balance)} aria-label="Monto del pago" />
              </label>
              <label className="block">
                <span className="block text-xs font-semibold text-[var(--admin-muted)]">Medio</span>
                <select className="input mt-1" value={method} onChange={(event) => setMethod(event.target.value)}>
                  {["transferencia", "efectivo", "tarjeta", "otro"].map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-xs font-semibold text-[var(--admin-muted)]">Fecha</span>
                <input className="input mt-1" type="date" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} />
              </label>
              <div className="flex items-end">
                <button type="button" className="btn w-full" onClick={() => void registerPayment()} disabled={saving}>
                  {saving ? "Guardando…" : "Pagar"}
                </button>
              </div>
            </div>
            <input className="input mt-3" value={payNotes} onChange={(event) => setPayNotes(event.target.value)} placeholder="Nota del pago (opcional)" />
          </div>
        )}

        {invoice.notes && (
          <p className="rounded-xl border border-[var(--admin-border)] bg-white/[0.02] p-3 text-sm text-[var(--admin-muted)]">{invoice.notes}</p>
        )}
      </div>
    </ModalFrame>
  );
}

/** @summary Formulario de proveedor (alta y edición). */
export function SupplierModal({
  supplier,
  branches = [],
  onClose,
  onSaved,
}: {
  supplier: Supplier | null;
  branches: Array<{ id: number; name: string }>;
  onClose: () => void;
  onSaved: (saved?: unknown) => Promise<void>;
}) {
  const [draft, setDraft] = useState({
    name: supplier?.name ?? "",
    code: supplier?.code ?? "",
    taxId: supplier?.taxId ?? "",
    contactName: supplier?.contactName ?? "",
    phone: supplier?.phone ?? "",
    email: supplier?.email ?? "",
    address: supplier?.address ?? "",
    paymentTerms: supplier?.paymentTerms ?? "",
    currency: supplier?.currency ?? "ARS",
    category: supplier?.category ?? "",
    creditLimit: supplier?.creditLimit ?? "",
    status: supplier?.status ?? "active",
    notes: supplier?.notes ?? "",
    branchIds: supplier?.branches?.map((b) => b.branch.id) ?? [],
  });
  const [saving, setSaving] = useState(false);

  /** @summary Guarda el proveedor (alta o edición). */
  async function save() {
    if (!draft.name.trim()) {
      await Swal.fire({ title: "Indicá el nombre del proveedor", icon: "warning", background: "#18181b", color: "#fafafa" });
      return;
    }
    setSaving(true);
    try {
      let saved: Supplier | undefined;
      if (supplier) {
        const updated = await api<{ item: Supplier }>(`/api/admin/compras/proveedores/${supplier.id}`, { method: "PUT", body: JSON.stringify(draft) });
        saved = updated.item;
        await Swal.fire({ title: "Proveedor actualizado", icon: "success", timer: 1500, showConfirmButton: false, background: "#18181b", color: "#fafafa" });
      } else {
        const created = await api<{ item: Supplier }>("/api/admin/compras/proveedores", { method: "POST", body: JSON.stringify(draft) });
        saved = created.item;
        await Swal.fire({ title: "Proveedor creado", icon: "success", timer: 1500, showConfirmButton: false, background: "#18181b", color: "#fafafa" });
      }
      await onSaved(saved);
    } catch (reason) {
      await showError("No se pudo guardar el proveedor", reason);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalFrame title={supplier ? `Editar proveedor` : "Nuevo proveedor"} onClose={onClose}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="block text-sm font-semibold text-[var(--admin-muted)]">Nombre</span>
          <input className="input mt-1" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Ej. Distribuidora Alimentos S.A." />
        </label>
        <label className="block">
          <span className="block text-sm font-semibold text-[var(--admin-muted)]">Código</span>
          <input className="input mt-1" value={draft.code} onChange={(event) => setDraft((current) => ({ ...current, code: event.target.value }))} placeholder="Ej. PRV-000001" />
        </label>
        <label className="block">
          <span className="block text-sm font-semibold text-[var(--admin-muted)]">CUIT / documento</span>
          <input className="input mt-1" value={draft.taxId} onChange={(event) => setDraft((current) => ({ ...current, taxId: event.target.value }))} />
        </label>
        <label className="block">
          <span className="block text-sm font-semibold text-[var(--admin-muted)]">Contacto</span>
          <input className="input mt-1" value={draft.contactName} onChange={(event) => setDraft((current) => ({ ...current, contactName: event.target.value }))} placeholder="Nombre del contacto" />
        </label>
        <label className="block">
          <span className="block text-sm font-semibold text-[var(--admin-muted)]">Teléfono</span>
          <input className="input mt-1" value={draft.phone} onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))} />
        </label>
        <label className="block">
          <span className="block text-sm font-semibold text-[var(--admin-muted)]">Email</span>
          <input className="input mt-1" type="email" value={draft.email} onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))} />
        </label>
        <label className="block sm:col-span-2">
          <span className="block text-sm font-semibold text-[var(--admin-muted)]">Dirección</span>
          <input className="input mt-1" value={draft.address} onChange={(event) => setDraft((current) => ({ ...current, address: event.target.value }))} placeholder="Domicilio fiscal o comercial" />
        </label>
        <label className="block">
          <span className="block text-sm font-semibold text-[var(--admin-muted)]">Condiciones de pago</span>
          <input className="input mt-1" value={draft.paymentTerms} onChange={(event) => setDraft((current) => ({ ...current, paymentTerms: event.target.value }))} placeholder="Ej. 30 días" />
        </label>
        <label className="block">
          <span className="block text-sm font-semibold text-[var(--admin-muted)]">Moneda</span>
          <input className="input mt-1" value={draft.currency} onChange={(event) => setDraft((current) => ({ ...current, currency: event.target.value }))} placeholder="ARS" />
        </label>
        <label className="block">
          <span className="block text-sm font-semibold text-[var(--admin-muted)]">Límite de crédito</span>
          <input className="input mt-1" type="number" value={draft.creditLimit} onChange={(event) => setDraft((current) => ({ ...current, creditLimit: event.target.value }))} placeholder="0.00" />
        </label>
        <label className="block">
          <span className="block text-sm font-semibold text-[var(--admin-muted)]">Categoría</span>
          <input className="input mt-1" value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} placeholder="Ej. Distribuidora" />
        </label>
        <label className="block">
          <span className="block text-sm font-semibold text-[var(--admin-muted)]">Estado</span>
          <select className="input mt-1" value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))}>
            <option value="active">Activo</option>
            <option value="blocked">Bloqueado</option>
            <option value="suspended">Suspendido</option>
          </select>
        </label>
        {branches.length > 0 && (
          <label className="block sm:col-span-2">
            <span className="block text-sm font-semibold text-[var(--admin-muted)]">Sucursales habilitadas</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {branches.map((branch) => {
                const checked = draft.branchIds.includes(branch.id);
                return (
                  <button
                    key={branch.id}
                    type="button"
                    onClick={() => {
                      setDraft((current) => ({
                        ...current,
                        branchIds: checked ? current.branchIds.filter((id) => id !== branch.id) : [...current.branchIds, branch.id],
                      }));
                    }}
                    className={`rounded-xl border px-3 py-2 text-sm font-bold transition-colors ${
                      checked ? "border-pink-500/40 bg-pink-500/10 text-pink-300" : "border-[var(--admin-border)] text-[var(--admin-muted)] hover:bg-white/5"
                    }`}
                  >
                    {branch.name}
                  </button>
                );
              })}
            </div>
          </label>
        )}
        <label className="block sm:col-span-2">
          <span className="block text-sm font-semibold text-[var(--admin-muted)]">Notas</span>
          <textarea className="input mt-1 min-h-16" value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} />
        </label>
      </div>
      <div className="mt-5 flex items-center justify-between gap-3 border-t border-[var(--admin-border)] pt-4">
        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
        <button type="button" className="btn" onClick={() => void save()} disabled={saving}>
          {saving ? "Guardando…" : supplier ? "Guardar cambios" : "Crear proveedor"}
        </button>
      </div>
    </ModalFrame>
  );
}
