"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useCallback, useEffect } from "react";
import Swal from "sweetalert2";
import { Icon } from "@/components/admin/ui/icons";
import { dateLabel, money } from "@/lib/helpers";
import { api, showError } from "@/lib/client-helpers";
import { StatusBadge, ORDER_STATUS_LABELS } from "@/components/admin/compras/document-header";
import { adminHrefFromPathname } from "@/lib/routes";

/* ────────────────────────── Types ────────────────────────── */

type OrderItem = {
  id: number;
  quantity: string | number;
  receivedQuantity: string | number;
  invoicedQuantity: string | number;
  unit: string;
  unitCost: string | number;
  discountPercent?: string | number;
  taxPercent?: string | number;
  product: { id: number; name: string; cost?: number | string | null; costUnit?: string | null };
  sortOrder: number;
};

type OrderReceipt = {
  id: number;
  number: string;
  receivedAt: string;
  createdBy?: { id: number; name: string } | null;
  items: Array<{
    id: number;
    quantity: string | number;
    unit: string;
    unitCost: string | number;
    product?: { id: number; name: string };
  }>;
};

type OrderInvoice = {
  id: number;
  number: string;
  status: string;
  total: string | number;
  documentDate: string;
  externalNumber?: string | null;
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
  createdBy?: { id: number; name: string } | null;
  items: OrderItem[];
  receipts: OrderReceipt[];
  invoices: OrderInvoice[];
};

/* ────────────────────────── Main Component ────────────────────────── */

/**
 * @summary Ficha de pedido de compra estilo Business Central.
 * Incluye barra de acciones, FastTabs, líneas editables (qty to receive/invoice),
 * modales contextuales para albaranes/facturas, y FactBox lateral.
 */
export function ComprasPedidoDetailClient({ order, currency }: { order: OrderDetail; currency: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const href = useCallback((path: string) => adminHrefFromPathname(pathname, path), [pathname]);
  const router = useRouter();

  // ── Editable line data (draft only) ──
  const [lineDrafts, setLineDrafts] = useState<Record<number, {
    quantity: string;
    unitCost: string;
    discountPercent: string;
    qtyToReceive: string;
    qtyToInvoice: string;
  }>>({});

  const [dirty, setDirty] = useState(false);
  const [receivingFor, setReceivingFor] = useState<number | null>(null);
  const [receiveQty, setReceiveQty] = useState("");
  const [receiveCost, setReceiveCost] = useState("");
  const [receiveNotes, setReceiveNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showReceiptsModal, setShowReceiptsModal] = useState(false);
  const [showInvoicesModal, setShowInvoicesModal] = useState(false);

  // Edit mode for header
  const [editingHeader, setEditingHeader] = useState(false);
  const [headerDraft, setHeaderDraft] = useState({
    expectedDate: order.expectedDate ?? "",
    externalReference: order.externalReference ?? "",
    notes: order.notes ?? "",
  });

  const canReceive = !["cancelled", "closed"].includes(order.status);
  const canEdit = order.status === "draft";
  const canCancel = !["cancelled", "closed"].includes(order.status);
  const canClose = ["received", "partially_received", "sent", "draft"].includes(order.status);
  const readOnly = !canEdit;

  // ── Initialize line drafts ──
  useEffect(() => {
    const drafts: typeof lineDrafts = {};
    for (const item of order.items) {
      const ordered = Number(item.quantity) || 0;
      const received = Number(item.receivedQuantity) || 0;
      const invoiced = Number(item.invoicedQuantity) || 0;
      drafts[item.id] = {
        quantity: String(ordered),
        unitCost: String(Number(item.unitCost) || 0),
        discountPercent: String(Number(item.discountPercent) || 0),
        qtyToReceive: String(Math.max(0, ordered - received)),
        qtyToInvoice: String(Math.max(0, ordered - invoiced)),
      };
    }
    setLineDrafts(drafts);
  }, [order.items]);

  // ── Highlight line from query param ──
  const highlightLineId = searchParams.get("line");

  // ── Derived stats ──
  const totalLines = order.items.length;
  const totalReceipts = order.receipts.length;
  const totalInvoices = order.invoices.length;
  const totalOrdered = order.items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitCost) || 0), 0);

  const linesFullyReceived = order.items.filter((item) => (Number(item.receivedQuantity) || 0) >= (Number(item.quantity) || 0)).length;
  const linesFullyInvoiced = order.items.filter((item) => (Number(item.invoicedQuantity) || 0) >= (Number(item.quantity) || 0)).length;
  const receiptStatus = linesFullyReceived === totalLines ? "complete" : linesFullyReceived > 0 ? "partial" : "none";
  const invoiceStatus = totalLines > 0 ? (linesFullyInvoiced === totalLines ? "complete" : linesFullyInvoiced > 0 ? "partial" : "none") : "none";
  const receiptStatusLabel = receiptStatus === "complete" ? "Completa" : receiptStatus === "partial" ? "Parcial" : "Sin recibir";
  const invoiceStatusLabel = invoiceStatus === "complete" ? "Completa" : invoiceStatus === "partial" ? "Parcial" : "Sin facturar";

  const hasPendingReceipt = order.items.some((item) => (Number(item.quantity) || 0) - (Number(item.receivedQuantity) || 0) > 0);
  const hasPendingInvoice = order.items.some((item) => (Number(item.quantity) || 0) - (Number(item.invoicedQuantity) || 0) > 0);

  /* ── Save header edits ── */
  async function saveHeader() {
    setSaving(true);
    try {
      await api(`/api/admin/compras/${order.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          expectedDate: headerDraft.expectedDate || null,
          externalReference: headerDraft.externalReference || null,
          notes: headerDraft.notes || null,
        }),
      });
      setEditingHeader(false);
      router.refresh();
    } catch (reason) {
      await showError("No se pudo guardar", reason);
    } finally {
      setSaving(false);
    }
  }

  /* ── Save line edits (draft only) ── */
  async function saveLines() {
    setSaving(true);
    try {
      const lines = order.items.map((item) => {
        const d = lineDrafts[item.id];
        return {
          productId: item.product.id,
          quantity: Number(d?.quantity || item.quantity),
          unit: item.unit,
          unitCost: Number(d?.unitCost || item.unitCost),
          discountPercent: Number(d?.discountPercent || 0),
          taxPercent: Number(item.taxPercent || 0),
        };
      });
      await api(`/api/admin/compras/${order.id}`, {
        method: "PATCH",
        body: JSON.stringify({ lines }),
      });
      setDirty(false);
      await Swal.fire({ title: "Cambios guardados", icon: "success", timer: 1500, showConfirmButton: false, background: "#18181b", color: "#fafafa" });
      router.refresh();
    } catch (reason) {
      await showError("No se pudieron guardar los cambios", reason);
    } finally {
      setSaving(false);
    }
  }

  /* ── Change order status ── */
  async function changeStatus(nextStatus: string) {
    const confirmations: Record<string, { title: string; text: string; icon: "warning" | "info" }> = {
      sent: { title: "Enviar pedido", text: `¿Marcar ${order.number} como enviado al proveedor?`, icon: "info" },
      closed: {
        title: "Cerrar pedido",
        text: `¿Cerrar ${order.number}? No se recibirán más cantidades ni se podrán crear recepciones nuevas.`,
        icon: "warning",
      },
      cancelled: {
        title: "Cancelar pedido",
        text: `¿Cancelar ${order.number}? Esta acción no se puede revertir. Los albaranes y facturas ya registrados no se eliminan.`,
        icon: "warning",
      },
    };
    const c = confirmations[nextStatus];
    if (!c) return;
    const result = await Swal.fire({
      title: c.title, text: c.text, icon: c.icon,
      showCancelButton: true, confirmButtonText: "Confirmar", cancelButtonText: "Cancelar",
      confirmButtonColor: nextStatus === "cancelled" ? "#ef4444" : "#ec4899",
      background: "#18181b", color: "#fafafa", reverseButtons: true,
    });
    if (!result.isConfirmed) return;
    setBusy(true);
    try {
      await api(`/api/admin/compras/${order.id}`, { method: "PATCH", body: JSON.stringify({ status: nextStatus }) });
      router.refresh();
    } catch (reason) {
      await showError("No se pudo cambiar el estado", reason);
    } finally {
      setBusy(false);
    }
  }

  /* ── Delete order (draft only) ── */
  async function remove() {
    const result = await Swal.fire({
      title: "¿Eliminar pedido?",
      text: `Vas a eliminar ${order.number}. Solo es posible si está en Borrador.`,
      icon: "warning", showCancelButton: true, confirmButtonText: "Eliminar", cancelButtonText: "Cancelar",
      confirmButtonColor: "#ef4444", background: "#18181b", color: "#fafafa", reverseButtons: true,
    });
    if (!result.isConfirmed) return;
    setBusy(true);
    try {
      await api(`/api/admin/compras/${order.id}`, { method: "DELETE" });
      router.push(href("/admin/compras/pedidos"));
    } catch (reason) {
      await showError("No se pudo eliminar el pedido", reason);
    } finally {
      setBusy(false);
    }
  }

  /* ── Confirm receipt (bulk from all lines with qtyToReceive > 0) ── */
  async function confirmReceipt() {
    const items = order.items
      .filter((item) => {
        const pending = (Number(item.quantity) || 0) - (Number(item.receivedQuantity) || 0);
        return pending > 0;
      })
      .map((item) => {
        const d = lineDrafts[item.id];
        const qty = Number(d?.qtyToReceive || 0);
        return { orderItemId: item.id, quantity: qty, unit: item.unit, unitCost: Number(d?.unitCost || item.unitCost) };
      })
      .filter((item) => item.quantity > 0);

    if (!items.length) {
      await Swal.fire({ title: "No hay cantidades a recibir", text: "Indicá las cantidades en la columna 'A recibir' de cada línea.", icon: "info", background: "#18181b", color: "#fafafa" });
      return;
    }

    // Calculate total lines and units for confirmation
    const lineCount = items.length;
    const unitCount = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalCost = items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);

    const result = await Swal.fire({
      title: "Registrar recepción",
      html: `<div style="text-align:left;font-size:14px;"><p>Se registrarán las cantidades indicadas en \"A recibir\":</p><p style="margin-top:8px;"><strong>${lineCount}</strong> línea${lineCount > 1 ? "s" : ""}</p><p><strong>${unitCount}</strong> unidad${unitCount > 1 ? "es" : ""}</p><p style="margin-top:4px;color:#a1a1aa;">Costo total: ${money(totalCost, currency)}</p></div>`,
      icon: "question",
      showCancelButton: true, confirmButtonText: "Registrar recepción", cancelButtonText: "Cancelar",
      confirmButtonColor: "#ec4899", background: "#18181b", color: "#fafafa", reverseButtons: true,
    });
    if (!result.isConfirmed) return;

    setSaving(true);
    try {
      const resp = await api<{ receipt: { number: string } }>(`/api/admin/compras/${order.id}/recepciones`, {
        method: "POST",
        body: JSON.stringify({ notes: receiveNotes || undefined, items }),
      });
      await Swal.fire({
        title: "Recepción registrada",
        html: `<p>Albarán <strong>${resp.receipt.number}</strong> creado correctamente.</p>`,
        icon: "success", timer: 2500, showConfirmButton: false, background: "#18181b", color: "#fafafa",
      });
      router.refresh();
      setReceivingFor(null);
    } catch (reason) {
      await showError("No se pudo registrar la recepción", reason);
    } finally {
      setSaving(false);
    }
  }

  function updateLineDraft(itemId: number, field: string, value: string) {
    setLineDrafts((prev) => ({ ...prev, [itemId]: { ...prev[itemId], [field]: value } }));
    setDirty(true);
  }

  /* ── Render ── */
  return (
    <div className="min-h-screen bg-[var(--admin-bg)]">
      {/* ── Document Header ── */}
      <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="mx-auto max-w-[1600px] px-6 pt-4 pb-3">
          <nav className="mb-4 flex items-center gap-1.5 text-xs text-[var(--admin-muted)]">
            <Link href={href("/admin/compras")} className="transition-colors hover:text-white/80">Compras</Link>
            <span className="text-zinc-600">/</span>
            <Link href={href("/admin/compras/pedidos")} className="transition-colors hover:text-white/80">Pedidos</Link>
            <span className="text-zinc-600">/</span>
            <span className="text-white font-medium">{order.number}</span>
          </nav>

          <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
            <div>
              <h1 className="text-3xl font-black tracking-tight leading-none">{order.number}</h1>
              <p className="mt-1.5 text-sm text-[var(--admin-muted)]">
                {order.supplier.name} · {order.branch.name}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 pb-0.5">
              <StatusBadge status={order.status} labels={ORDER_STATUS_LABELS} />
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${receiptStatus === "complete" ? "bg-emerald-500/15 text-emerald-300" : receiptStatus === "partial" ? "bg-amber-500/15 text-amber-300" : "bg-zinc-500/15 text-zinc-400"}`}>
                Recepción: {receiptStatusLabel}
              </span>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${invoiceStatus === "complete" ? "bg-emerald-500/15 text-emerald-300" : invoiceStatus === "partial" ? "bg-amber-500/15 text-amber-300" : "bg-zinc-500/15 text-zinc-400"}`}>
                Facturación: {invoiceStatusLabel}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Dirty indicator + Save bar ── */}
      {dirty && (
        <div className="border-b border-amber-500/30 bg-amber-500/[0.06] px-6 py-2">
          <div className="mx-auto max-w-[1600px] flex items-center justify-between">
            <span className="text-xs font-bold text-amber-300">Cambios sin guardar</span>
            <div className="flex gap-2">
              <button type="button" className="btn btn-secondary text-xs" onClick={() => { setDirty(false); router.refresh(); }} disabled={saving}>Descartar</button>
              <button type="button" className="btn text-xs" onClick={() => void saveLines()} disabled={saving}>{saving ? "Guardando…" : "Guardar cambios"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Action Bar (BC ribbon) ── */}
      <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface)]/50">
        <div className="mx-auto max-w-[1600px] flex flex-wrap items-center gap-0 px-6 py-1.5 text-xs">
          {canEdit && (
            <ActionGroup label="Pedido">
              <ActionItem label={editingHeader ? "Guardando…" : "Editar"} icon="edit" onClick={() => editingHeader ? void saveHeader() : setEditingHeader(true)} disabled={busy || saving} />
              {dirty && <ActionItem label="Guardar" icon="save" onClick={() => void saveLines()} disabled={saving} />}
              <ActionItem label="Enviar" icon="external-link" onClick={() => void changeStatus("sent")} disabled={busy} />
            </ActionGroup>
          )}
          {canReceive && hasPendingReceipt && (
            <ActionGroup label="Registrar">
              <ActionItem label="Recibir" icon="package" onClick={() => void confirmReceipt()} disabled={busy || saving} />
            </ActionGroup>
          )}
          <ActionGroup label="Navegar">
            <ActionItem
              label={`Albaranes (${totalReceipts})`} icon="document"
              onClick={() => totalReceipts > 0 ? setShowReceiptsModal(true) : undefined}
              disabled={totalReceipts === 0}
            />
            <ActionItem
              label={`Facturas (${totalInvoices})`} icon="receipt"
              onClick={() => totalInvoices > 0 ? setShowInvoicesModal(true) : undefined}
              disabled={totalInvoices === 0}
            />
            <ActionItem
              label="Proveedor" icon="users" disabled
            />
          </ActionGroup>
          {canClose && (
            <ActionGroup label="Estado">
              <ActionItem label="Cerrar pedido" icon="check" onClick={() => void changeStatus("closed")} disabled={busy} />
              {canCancel && <ActionItem label="Cancelar" icon="x" onClick={() => void changeStatus("cancelled")} disabled={busy} tone="danger" />}
            </ActionGroup>
          )}
          {canEdit && (
            <ActionGroup label="Documento">
              <ActionItem label="Eliminar" icon="trash" onClick={() => void remove()} disabled={busy} tone="danger" />
            </ActionGroup>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="mx-auto max-w-[1600px] flex flex-col lg:flex-row gap-0">
        <div className="flex-1 min-w-0">
          {/* ── GENERAL ── */}
          <Section title="General" icon="document">
            <div className="grid gap-x-10 gap-y-4 sm:grid-cols-2 lg:grid-cols-3 px-6 py-5">
              <FieldRow label="Proveedor" value={order.supplier.name} />
              <FieldRow label="Nº documento" value={order.number} />
              <FieldRow label="Estado" value={purchaseStatusLabel(order.status)} />
              {editingHeader ? (
                <>
                  <FieldInput label="Fecha recepción prevista" type="date" value={headerDraft.expectedDate} onChange={(v) => setHeaderDraft((d) => ({ ...d, expectedDate: v }))} />
                  <FieldInput label="Referencia proveedor" value={headerDraft.externalReference} onChange={(v) => setHeaderDraft((d) => ({ ...d, externalReference: v }))} placeholder="Nº remito, OC proveedor…" />
                </>
              ) : (
                <>
                  {order.expectedDate && <FieldRow label="Recepción prevista" value={dateLabel(order.expectedDate)} />}
                  {order.externalReference && <FieldRow label="Referencia proveedor" value={order.externalReference} />}
                </>
              )}
              <FieldRow label="Fecha pedido" value={dateLabel(order.orderDate)} />
              {order.supplier.paymentTerms && <FieldRow label="Condiciones de pago" value={order.supplier.paymentTerms} />}
              <FieldRow label="Sucursal" value={order.branch.name} />
              <FieldRow label="Moneda" value="ARS" />
              <FieldRow label="Comprador" value={order.createdBy?.name ?? "—"} />
            </div>
            {editingHeader && (
              <div className="flex justify-end gap-2 px-6 pb-4">
                <button type="button" className="btn btn-secondary text-xs" onClick={() => setEditingHeader(false)} disabled={saving}>Cancelar</button>
                <button type="button" className="btn text-xs" onClick={() => void saveHeader()} disabled={saving}>{saving ? "Guardando…" : "Guardar cabecera"}</button>
              </div>
            )}
          </Section>

          {/* ── LINES TABLE ── */}
          <div className="border-b border-[var(--admin-border)]">
            <div className="px-6 py-3 border-b border-[var(--admin-border)] bg-white/[0.01]">
              <h3 className="text-xs font-black uppercase tracking-widest text-[var(--admin-muted)]">
                Líneas ({totalLines})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--admin-border)] bg-white/[0.02] text-[10px] uppercase tracking-wider text-[var(--admin-muted)] sticky top-0">
                    <th className="px-4 py-2.5 w-14">#</th>
                    <th className="px-4 py-2.5">Artículo</th>
                    <th className="px-4 py-2.5">UdM</th>
                    <th className="px-4 py-2.5 text-right">Cant.</th>
                    <th className="px-4 py-2.5 text-right">Recibida</th>
                    <th className="px-4 py-2.5 text-right">A recibir</th>
                    <th className="px-4 py-2.5 text-right">Facturada</th>
                    <th className="px-4 py-2.5 text-right">A facturar</th>
                    <th className="px-4 py-2.5 text-right">Costo</th>
                    <th className="px-4 py-2.5 text-right">Dto %</th>
                    <th className="px-4 py-2.5 text-right">Importe</th>
                    <th className="px-4 py-2.5 text-right w-16">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--admin-border)]/50">
                  {order.items.map((item, idx) => {
                    const ordered = Number(item.quantity) || 0;
                    const received = Number(item.receivedQuantity) || 0;
                    const invoiced = Number(item.invoicedQuantity) || 0;
                    const pendingRec = Math.max(0, ordered - received);
                    const pendingInv = Math.max(0, ordered - invoiced);
                    const draft = lineDrafts[item.id] ?? { quantity: String(ordered), unitCost: String(Number(item.unitCost)), discountPercent: "0", qtyToReceive: String(pendingRec), qtyToInvoice: String(pendingInv) };
                    const discount = Number(draft.discountPercent) || 0;
                    const unitCost = Number(draft.unitCost) || 0;
                    const qty = Number(draft.quantity) || 0;
                    const lineNet = qty * unitCost * (1 - discount / 100);
                    const isHighlighted = highlightLineId === String(item.id);
                    const isComplete = pendingRec === 0 && pendingInv === 0;

                    return (
                      <tr key={item.id} className={`transition-colors ${isHighlighted ? "bg-pink-500/[0.08] ring-1 ring-inset ring-pink-500/30" : "hover:bg-white/[0.02]"}`}>
                        <td className="px-4 py-2 text-[var(--admin-muted)] tabular-nums">{String((idx + 1) * 10000).padStart(5, "0")}</td>
                        <td className="px-4 py-2 font-semibold">{item.product.name}</td>
                        <td className="px-4 py-2 text-[var(--admin-muted)]">{item.unit}</td>
                        <td className="px-4 py-2 text-right">
                          {readOnly ? (
                            <span className="tabular-nums font-bold">{qty}</span>
                          ) : (
                            <input type="number" min={0} step="0.001" value={draft.quantity}
                              onChange={(e) => updateLineDraft(item.id, "quantity", e.target.value)}
                              className="input w-16 py-0.5 px-1.5 text-right text-xs tabular-nums"
                            />
                          )}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-emerald-300 font-semibold">{received}</td>
                        <td className="px-4 py-2 text-right">
                          {readOnly || pendingRec === 0 ? (
                            <span className={`tabular-nums font-bold ${pendingRec === 0 ? "text-zinc-500" : "text-amber-300"}`}>{pendingRec}</span>
                          ) : (
                            <input type="number" min={0} max={pendingRec} step="0.001"
                              value={draft.qtyToReceive}
                              onChange={(e) => updateLineDraft(item.id, "qtyToReceive", e.target.value)}
                              className="input w-16 py-0.5 px-1.5 text-right text-xs tabular-nums border-amber-500/30 bg-amber-500/[0.06]"
                            />
                          )}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-sky-300 font-semibold">{invoiced}</td>
                        <td className="px-4 py-2 text-right">
                          {readOnly || pendingInv === 0 ? (
                            <span className={`tabular-nums font-bold ${pendingInv === 0 ? "text-zinc-500" : "text-amber-300"}`}>{pendingInv}</span>
                          ) : (
                            <input type="number" min={0} max={pendingInv} step="0.001"
                              value={draft.qtyToInvoice}
                              onChange={(e) => updateLineDraft(item.id, "qtyToInvoice", e.target.value)}
                              className="input w-16 py-0.5 px-1.5 text-right text-xs tabular-nums border-amber-500/30 bg-amber-500/[0.06]"
                            />
                          )}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {readOnly ? (
                            <span className="tabular-nums">{money(unitCost, currency)}</span>
                          ) : (
                            <input type="number" min={0} step="0.01"
                              value={draft.unitCost}
                              onChange={(e) => updateLineDraft(item.id, "unitCost", e.target.value)}
                              className="input w-20 py-0.5 px-1.5 text-right text-xs tabular-nums"
                            />
                          )}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {readOnly ? (
                            <span className="tabular-nums">{discount > 0 ? `${discount}%` : "—"}</span>
                          ) : (
                            <input type="number" min={0} max={100} step="0.01"
                              value={draft.discountPercent}
                              onChange={(e) => updateLineDraft(item.id, "discountPercent", e.target.value)}
                              className="input w-14 py-0.5 px-1.5 text-right text-xs tabular-nums"
                            />
                          )}
                        </td>
                        <td className="px-4 py-2 text-right font-bold tabular-nums">{money(lineNet, currency)}</td>
                        <td className="px-4 py-2 text-center">
                          {isComplete ? (
                            <span className="text-[10px] text-emerald-400 font-bold">✓ Completa</span>
                          ) : pendingRec > 0 ? (
                            <span className="text-[10px] text-amber-300 font-semibold">Pendiente</span>
                          ) : (
                            <span className="text-[10px] text-zinc-500">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-white/[0.02] font-bold text-xs border-t border-[var(--admin-border)]">
                    <td className="px-4 py-3" colSpan={11}>Total pedido</td>
                    <td className="px-4 py-3 text-right tabular-nums">{money(totalOrdered, currency)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* ── RECEPCIÓN (inline) ── */}
          {receivingFor !== null && (
            <div className="border-b border-[var(--admin-border)] bg-pink-500/[0.03] px-6 py-4">
              <p className="text-sm font-black text-pink-300">Registrar recepción</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-4">
                <label className="block">
                  <span className="block text-[10px] font-semibold uppercase text-[var(--admin-muted)]">Cantidad a recibir</span>
                  <input className="input mt-1" type="number" min={0} step="0.001" value={receiveQty} onChange={(e) => setReceiveQty(e.target.value)} />
                </label>
                <label className="block">
                  <span className="block text-[10px] font-semibold uppercase text-[var(--admin-muted)]">Costo unitario</span>
                  <input className="input mt-1" type="number" min={0} step="0.01" value={receiveCost} onChange={(e) => setReceiveCost(e.target.value)} />
                </label>
                <label className="block">
                  <span className="block text-[10px] font-semibold uppercase text-[var(--admin-muted)]">Notas</span>
                  <input className="input mt-1" value={receiveNotes} onChange={(e) => setReceiveNotes(e.target.value)} placeholder="Remito, observaciones…" />
                </label>
                <div className="flex items-end gap-2">
                  <button type="button" className="btn text-xs" onClick={() => void confirmReceipt()} disabled={saving}>{saving ? "Confirmando…" : "Confirmar"}</button>
                  <button type="button" className="btn btn-secondary text-xs" onClick={() => setReceivingFor(null)} disabled={saving}>Cancelar</button>
                </div>
              </div>
            </div>
          )}

          {/* ── FACTURACIÓN ── */}
          <Section title="Facturación" icon="receipt" badge={totalInvoices > 0 ? String(totalInvoices) : undefined}>
            <div className="px-6 py-5 space-y-3">
              <div className="grid gap-x-10 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                <FieldRow label="Moneda" value="ARS" />
                <FieldRow label="Subtotal estimado" value={money(totalOrdered, currency)} />
                {order.supplier.paymentTerms && <FieldRow label="Condiciones de pago" value={order.supplier.paymentTerms} />}
              </div>
              <p className="text-xs text-[var(--admin-muted)]">
                Las facturas de compra se registran desde Navegar → Facturas o desde el módulo de Facturas.
              </p>
            </div>
          </Section>

          {/* ── ENVÍO Y RECEPCIÓN ── */}
          <Section title="Envío y recepción" icon="truck" badge={totalReceipts > 0 ? String(totalReceipts) : undefined}>
            <div className="px-6 py-5 space-y-3">
              <div className="grid gap-x-10 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                <FieldRow label="Sucursal destino" value={order.branch.name} />
                {order.expectedDate && <FieldRow label="Fecha recepción prevista" value={dateLabel(order.expectedDate)} />}
                <FieldRow label="Recepciones registradas" value={String(totalReceipts)} />
              </div>
            </div>
          </Section>

          {/* ── NOTAS ── */}
          {(order.notes || editingHeader) && (
            <Section title="Notas" icon="edit">
              <div className="px-6 py-5">
                {editingHeader ? (
                  <textarea className="input min-h-20" value={headerDraft.notes} onChange={(e) => setHeaderDraft((d) => ({ ...d, notes: e.target.value }))} placeholder="Notas del pedido…" />
                ) : (
                  <p className="text-sm text-[var(--admin-muted)] whitespace-pre-wrap">{order.notes}</p>
                )}
              </div>
            </Section>
          )}
        </div>

        {/* ── FactBox ── */}
        <div className="w-full lg:w-64 shrink-0 border-l border-[var(--admin-border)] bg-[var(--admin-surface)]/30">
          <div className="p-5 space-y-5">
            <FactBoxSection title="Resumen">
              <FactBoxRow label="Líneas" value={String(totalLines)} />
              <FactBoxRow label="Total" value={money(totalOrdered, currency)} bold />
              <FactBoxRow label="Albaranes" value={String(totalReceipts)} />
              <FactBoxRow label="Facturas" value={String(totalInvoices)} />
            </FactBoxSection>
            <FactBoxSection title="Recepción">
              <FactBoxRow label="Estado" value={receiptStatusLabel} color={receiptStatus === "complete" ? "text-emerald-300" : receiptStatus === "partial" ? "text-amber-300" : "text-zinc-400"} />
              <FactBoxRow label="Líneas" value={`${linesFullyReceived}/${totalLines}`} />
            </FactBoxSection>
            <FactBoxSection title="Facturación">
              <FactBoxRow label="Estado" value={invoiceStatusLabel} color={invoiceStatus === "complete" ? "text-emerald-300" : invoiceStatus === "partial" ? "text-amber-300" : "text-zinc-400"} />
              <FactBoxRow label="Líneas" value={`${linesFullyInvoiced}/${totalLines}`} />
            </FactBoxSection>
            <FactBoxSection title="Proveedor">
              <FactBoxRow label={order.supplier.name} value="" />
              {order.supplier.paymentTerms && <FactBoxRow label="Pago" value={order.supplier.paymentTerms} />}
            </FactBoxSection>
          </div>
        </div>
      </div>

      {/* ── MODAL: Albaranes registrados ── */}
      {showReceiptsModal && (
        <Modal onClose={() => setShowReceiptsModal(false)} title="Albaranes registrados" subtitle={`Pedido ${order.number}`}>
          <div className="space-y-2">
            {order.receipts.map((receipt) => {
              const totalReceipt = receipt.items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitCost) || 0), 0);
              return (
                <Link
                  key={receipt.id}
                  href={href(`/admin/compras/albaranes/${receipt.id}`) as never}
                  className="flex items-center justify-between rounded-xl border border-[var(--admin-border)] bg-white/[0.02] px-4 py-3 hover:bg-white/[0.04] transition-colors"
                  onClick={() => setShowReceiptsModal(false)}
                >
                  <div>
                    <p className="font-bold text-sm">{receipt.number}</p>
                    <p className="text-xs text-[var(--admin-muted)]">{dateLabel(receipt.receivedAt)} · {receipt.items.length} línea{receipt.items.length > 1 ? "s" : ""}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold tabular-nums">{money(totalReceipt, currency)}</p>
                    <Icon name="arrow-right" className="text-xs text-[var(--admin-muted)] ml-auto mt-0.5" />
                  </div>
                </Link>
              );
            })}
          </div>
        </Modal>
      )}

      {/* ── MODAL: Facturas registradas ── */}
      {showInvoicesModal && (
        <Modal onClose={() => setShowInvoicesModal(false)} title="Facturas registradas" subtitle={`Pedido ${order.number}`}>
          <div className="space-y-2">
            {order.invoices.map((inv) => (
              <Link
                key={inv.id}
                href={href(`/admin/compras/facturas/${inv.id}`) as never}
                className="flex items-center justify-between rounded-xl border border-[var(--admin-border)] bg-white/[0.02] px-4 py-3 hover:bg-white/[0.04] transition-colors"
                onClick={() => setShowInvoicesModal(false)}
              >
                <div>
                  <p className="font-bold text-sm">{inv.number}</p>
                  <p className="text-xs text-[var(--admin-muted)]">{dateLabel(inv.documentDate)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold tabular-nums">{money(inv.total, currency)}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                    inv.status === "paid" ? "bg-emerald-500/15 text-emerald-300" :
                    inv.status === "cancelled" ? "bg-rose-500/15 text-rose-300" :
                    "bg-amber-500/15 text-amber-300"
                  }`}>
                    {inv.status === "paid" ? "Pagado" : inv.status === "cancelled" ? "Anulado" : "Pendiente"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ────────────────────────── Sub-components ────────────────────────── */

function ActionGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center border-r border-[var(--admin-border)] px-3 py-1.5 last:border-r-0">
      <span className="mr-2 text-[9px] font-black uppercase tracking-wider text-[var(--admin-muted)] whitespace-nowrap">{label}</span>
      {children}
    </div>
  );
}

function ActionItem({ label, icon, onClick, disabled, tone }: { label: string; icon: string; onClick?: () => void; disabled?: boolean; tone?: "danger" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded px-2.5 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap ${
        tone === "danger"
          ? "text-rose-300 hover:bg-rose-500/10"
          : "text-[var(--admin-muted)] hover:bg-white/5 hover:text-white"
      } disabled:opacity-30 disabled:cursor-not-allowed`}
    >
      {label}
    </button>
  );
}

function Section({ title, icon, badge, children }: { title: string; icon: string; badge?: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-[var(--admin-border)]">
      <div className="px-6 py-3 bg-white/[0.01]">
        <div className="flex items-center gap-2">
          <Icon name={icon as any} className="text-sm text-[var(--admin-muted)]" />
          <h3 className="text-xs font-black uppercase tracking-widest text-[var(--admin-muted)]">{title}</h3>
          {badge && <span className="rounded-full bg-pink-500/20 px-2 py-0.5 text-[10px] font-bold text-pink-300">{badge}</span>}
        </div>
      </div>
      {children}
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--admin-muted)] mb-0.5">{label}</p>
      <p className="text-sm font-bold">{value}</p>
    </div>
  );
}

function FieldInput({ label, value, type, placeholder, onChange }: { label: string; value: string; type?: string; placeholder?: string; onChange: (v: string) => void }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--admin-muted)] mb-0.5">{label}</p>
      <input className="input w-full py-1 text-sm" type={type ?? "text"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function Modal({ onClose, title, subtitle, children }: { onClose: () => void; title: string; subtitle?: string; children: React.ReactNode }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[70vh] flex flex-col rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--admin-border)]">
          <div>
            <h2 className="text-base font-black">{title}</h2>
            {subtitle && <p className="text-xs text-[var(--admin-muted)]">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-[var(--admin-muted)] hover:bg-white/5 hover:text-white transition-colors">
            <Icon name="x" className="text-sm" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

function FactBoxSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--admin-muted)] mb-2.5 pb-1.5 border-b border-[var(--admin-border)]">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function FactBoxRow({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <div className="flex items-center justify-between text-xs gap-2">
      <span className="text-[var(--admin-muted)] truncate">{label}</span>
      <span className={`tabular-nums whitespace-nowrap ${bold ? "font-black" : "font-semibold"} ${color ?? ""}`}>{value}</span>
    </div>
  );
}

function purchaseStatusLabel(status: string): string {
  const labels: Record<string, string> = { draft: "Borrador", sent: "Enviado", partially_received: "Recibido parcial", received: "Recibido", closed: "Cerrado", cancelled: "Cancelado" };
  return labels[status] ?? status;
}
