"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useCallback, useEffect } from "react";
import Swal from "sweetalert2";
import { Icon, type IconName } from "@/components/admin/ui/icons";
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
  quantityToReceive?: string | number | null;
  quantityToInvoice?: string | number | null;
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

type SupplierOption = { id: number; name: string; paymentTerms?: string | null };
type BranchOption = { id: number; name: string };

export type OrderDetail = {
  id: number;
  number: string;
  status: string;
  orderDate: string;
  postingDate?: string;
  expectedDate?: string | null;
  externalReference?: string | null;
  notes?: string | null;
  createdAt: string;
  supplier: SupplierOption;
  branch: BranchOption;
  createdBy?: { id: number; name: string } | null;
  items: OrderItem[];
  receipts: OrderReceipt[];
  invoices: OrderInvoice[];
};

/* ────────────────────────── Main Component ────────────────────────── */

/**
 * @summary Ficha de pedido de compra — UI moderna estilo ERP premium.
 * Lógica: FastTabs, líneas editables, modales contextuales, FactBox lateral.
 */
export function ComprasPedidoDetailClient({ order, currency }: { order: OrderDetail; currency: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const href = useCallback((path: string) => adminHrefFromPathname(pathname, path), [pathname]);
  const router = useRouter();

  const [lineDrafts, setLineDrafts] = useState<
    Record<
      number,
      {
        quantity: string;
        unitCost: string;
        discountPercent: string;
        qtyToReceive: string;
        qtyToInvoice: string;
      }
    >
  >({});
  const [dirty, setDirty] = useState(false);
  const [receivingFor, setReceivingFor] = useState<number | null>(null);
  const [receiveQty, setReceiveQty] = useState("");
  const [receiveCost, setReceiveCost] = useState("");
  const [receiveNotes, setReceiveNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showReceiptsModal, setShowReceiptsModal] = useState(false);
  const [showInvoicesModal, setShowInvoicesModal] = useState(false);
  const [editingHeader, setEditingHeader] = useState(false);
  const [headerDraft, setHeaderDraft] = useState({
    supplierId: order.supplier.id,
    branchId: order.branch.id,
    orderDate: order.orderDate ? order.orderDate.slice(0, 10) : "",
    postingDate:
      (order.postingDate ?? order.orderDate) ? (order.postingDate ?? order.orderDate).slice(0, 10) : "",
    expectedDate: order.expectedDate ?? "",
    externalReference: order.externalReference ?? "",
    notes: order.notes ?? "",
  });
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    general: true,
    lineas: true,
    facturacion: false,
    envio: false,
    notas: false,
  });
  const factBoxVisible = true;

  const canReceive = !["cancelled", "closed"].includes(order.status);
  const canEdit = order.status === "draft";
  const canEditLines = order.status === "draft";
  const canPrepareInvoice = !["cancelled", "closed"].includes(order.status);
  const canCancel = !["cancelled", "closed"].includes(order.status);
  const canClose = ["received", "partially_received", "sent", "draft"].includes(order.status);

  useEffect(() => {
    const drafts: typeof lineDrafts = {};
    for (const item of order.items) {
      const ordered = Number(item.quantity) || 0;
      const received = Number(item.receivedQuantity) || 0;
      const invoiced = Number(item.invoicedQuantity) || 0;
      const pendingRec = Math.max(0, ordered - received);
      const pendingInv = Math.max(0, ordered - invoiced);
      // Use persisted quantityToReceive/quantityToInvoice from the server when available;
      // fall back to pending defaults only when no persisted value exists.
      const persistedRec = item.quantityToReceive != null ? Number(item.quantityToReceive) : null;
      const persistedInv = item.quantityToInvoice != null ? Number(item.quantityToInvoice) : null;
      drafts[item.id] = {
        quantity: String(ordered),
        unitCost: String(Number(item.unitCost) || 0),
        discountPercent: String(Number(item.discountPercent) || 0),
        qtyToReceive:
          persistedRec != null && !isNaN(persistedRec)
            ? String(Math.min(persistedRec, pendingRec))
            : String(pendingRec),
        qtyToInvoice:
          persistedInv != null && !isNaN(persistedInv)
            ? String(Math.min(persistedInv, pendingInv))
            : String(pendingInv),
      };
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLineDrafts(drafts);
  }, [order.items]);

  const highlightLineId = searchParams.get("line");
  const totalLines = order.items.length;
  const totalReceipts = order.receipts.length;
  const totalInvoices = order.invoices.length;
  const totalOrdered = order.items.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitCost) || 0),
    0,
  );
  const linesFullyReceived = order.items.filter(
    (item) => (Number(item.receivedQuantity) || 0) >= (Number(item.quantity) || 0),
  ).length;
  const linesFullyInvoiced = order.items.filter(
    (item) => (Number(item.invoicedQuantity) || 0) >= (Number(item.quantity) || 0),
  ).length;
  const receiptStatus =
    linesFullyReceived === totalLines ? "complete" : linesFullyReceived > 0 ? "partial" : "none";
  const invoiceStatus =
    totalLines > 0
      ? linesFullyInvoiced === totalLines
        ? "complete"
        : linesFullyInvoiced > 0
          ? "partial"
          : "none"
      : "none";
  const receiptStatusLabel =
    receiptStatus === "complete" ? "Completa" : receiptStatus === "partial" ? "Parcial" : "Sin recibir";
  const invoiceStatusLabel =
    invoiceStatus === "complete" ? "Completa" : invoiceStatus === "partial" ? "Parcial" : "Sin facturar";
  const hasPendingReceipt = order.items.some(
    (item) => (Number(item.quantity) || 0) - (Number(item.receivedQuantity) || 0) > 0,
  );

  // saveHeader removed — merged into saveLines() which handles both header + lines

  async function saveLines() {
    setSaving(true);
    try {
      const lines = order.items.map((item) => {
        const d = lineDrafts[item.id];
        return {
          orderItemId: item.id,
          productId: item.product.id,
          quantity: Number(d?.quantity || item.quantity),
          unit: item.unit,
          unitCost: Number(d?.unitCost || item.unitCost),
          discountPercent: Number(d?.discountPercent || 0),
          taxPercent: Number(item.taxPercent || 0),
          quantityToReceive: d?.qtyToReceive != null ? Number(d.qtyToReceive) : undefined,
          quantityToInvoice: d?.qtyToInvoice != null ? Number(d.qtyToInvoice) : undefined,
        };
      });
      if (editingHeader) {
        await api(`/api/admin/compras/${order.id}`, {
          method: "PUT",
          body: JSON.stringify({
            supplierId: headerDraft.supplierId !== order.supplier.id ? headerDraft.supplierId : undefined,
            branchId: headerDraft.branchId !== order.branch.id ? headerDraft.branchId : undefined,
            orderDate: headerDraft.orderDate || undefined,
            postingDate: headerDraft.postingDate || undefined,
            expectedDate: headerDraft.expectedDate || null,
            externalReference: headerDraft.externalReference || null,
            notes: headerDraft.notes || null,
            lines,
          }),
        });
        setEditingHeader(false);
      } else {
        await api(`/api/admin/compras/${order.id}`, { method: "PUT", body: JSON.stringify({ lines }) });
      }
      setDirty(false);
      await Swal.fire({
        title: "Cambios guardados",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
        background: "#18181b",
        color: "#fafafa",
      });
      router.refresh();
    } catch (reason) {
      await showError("No se pudieron guardar los cambios", reason);
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(nextStatus: string) {
    const c: Record<string, { title: string; text: string; icon: "warning" | "info" }> = {
      sent: {
        title: "Enviar pedido",
        text: `Marcar ${order.number} como enviado al proveedor.`,
        icon: "info",
      },
      closed: {
        title: "Cerrar pedido",
        text: `Cerrar ${order.number}. No se recibirán más cantidades.`,
        icon: "warning",
      },
      cancelled: {
        title: "Cancelar pedido",
        text: `Cancelar ${order.number}. No se puede revertir. Los albaranes y facturas existentes no se eliminan.`,
        icon: "warning",
      },
    };
    const conf = c[nextStatus];
    if (!conf) return;
    const result = await Swal.fire({
      title: conf.title,
      text: conf.text,
      icon: conf.icon,
      showCancelButton: true,
      confirmButtonText: "Confirmar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: nextStatus === "cancelled" ? "#ef4444" : "var(--admin-primary-strong)",
      background: "#18181b",
      color: "#fafafa",
      reverseButtons: true,
    });
    if (!result.isConfirmed) return;
    setBusy(true);
    try {
      // Save pending line/header changes before changing status
      if (dirty && canEdit) {
        const lines = order.items.map((item) => {
          const d = lineDrafts[item.id];
          return {
            orderItemId: item.id,
            productId: item.product.id,
            quantity: Number(d?.quantity || item.quantity),
            unit: item.unit,
            unitCost: Number(d?.unitCost || item.unitCost),
            discountPercent: Number(d?.discountPercent || 0),
            taxPercent: Number(item.taxPercent || 0),
          };
        });
        await api(`/api/admin/compras/${order.id}`, { method: "PUT", body: JSON.stringify({ lines }) });
        setDirty(false);
      }
      await api(`/api/admin/compras/${order.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      router.refresh();
    } catch (reason) {
      await showError("No se pudo cambiar el estado", reason);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
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
      router.push(href("/admin/compras/pedidos"));
    } catch (reason) {
      await showError("No se pudo eliminar el pedido", reason);
    } finally {
      setBusy(false);
    }
  }

  async function confirmReceipt() {
    const items = order.items
      .filter((item) => (Number(item.quantity) || 0) - (Number(item.receivedQuantity) || 0) > 0)
      .map((item) => {
        const d = lineDrafts[item.id];
        return {
          orderItemId: item.id,
          quantity: Number(d?.qtyToReceive || 0),
          unit: item.unit,
          unitCost: Number(d?.unitCost || item.unitCost),
        };
      })
      .filter((item) => item.quantity > 0);
    if (!items.length) {
      await Swal.fire({
        title: "No hay cantidades a recibir",
        text: "Indicá las cantidades en 'A recibir' de cada línea.",
        icon: "info",
        background: "#18181b",
        color: "#fafafa",
      });
      return;
    }
    const lineCount = items.length;
    const unitCount = items.reduce((s, i) => s + i.quantity, 0);
    const totalCost = items.reduce((s, i) => s + i.quantity * i.unitCost, 0);
    const result = await Swal.fire({
      title: "Registrar recepción",
      html: `<div style="text-align:left;font-size:14px;"><p>Se registrarán las cantidades indicadas en "A recibir":</p><p style="margin-top:8px;"><strong>${lineCount}</strong> línea${lineCount > 1 ? "s" : ""}</p><p><strong>${unitCount}</strong> unidad${unitCount > 1 ? "es" : ""}</p><p style="margin-top:4px;color:#a1a1aa;">Costo total: ${money(totalCost, currency)}</p></div>`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Registrar recepción",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ec4899",
      background: "#18181b",
      color: "#fafafa",
      reverseButtons: true,
    });
    if (!result.isConfirmed) return;
    setSaving(true);
    try {
      const resp = await api<{ item: { number: string; id: number } }>(
        `/api/admin/compras/${order.id}/recepciones`,
        { method: "POST", body: JSON.stringify({ notes: receiveNotes || undefined, items }) },
      );
      const receiptNumber = resp.item?.number ?? "Sin número";
      await Swal.fire({
        title: "Recepción registrada",
        html: `<p>Albarán <strong>${receiptNumber}</strong> creado correctamente.</p>`,
        icon: "success",
        timer: 2500,
        showConfirmButton: false,
        background: "#18181b",
        color: "#fafafa",
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
  function toggleSection(key: string) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  /* ── Render ── */
  return (
    <div className="min-h-screen" style={{ background: "var(--admin-background)" }}>
      {/* ── Header ── */}
      <div style={{ background: "var(--admin-surface)" }} className="relative">
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{
            background:
              "linear-gradient(90deg, var(--admin-primary-strong), var(--admin-primary), transparent)",
          }}
        />
        <div className="mx-auto max-w-[1600px] px-4 pt-5 pb-4 sm:px-8 sm:pt-6 sm:pb-5">
          <nav className="mb-5 flex items-center gap-2 text-xs sm:text-sm" style={{ color: "var(--admin-muted)" }}>
            <Link href={href("/admin/compras")} className="transition-colors hover:opacity-70">
              Compras
            </Link>
            <span className="opacity-40">/</span>
            <Link href={href("/admin/compras/pedidos")} className="transition-colors hover:opacity-70">
              Pedidos
            </Link>
            <span className="opacity-40">/</span>
            <span className="font-medium" style={{ color: "var(--admin-text)" }}>
              {order.number}
            </span>
          </nav>
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
            <div>
              <h1
                className="text-2xl font-extrabold tracking-tight leading-none sm:text-3xl"
                style={{ color: "var(--admin-text)" }}
              >
                {order.number}
              </h1>
              <p className="mt-2 text-sm sm:text-base" style={{ color: "var(--admin-muted)" }}>
                {order.supplier.name} · {order.branch.name}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 pb-0.5">
              <StatusBadge status={order.status} labels={ORDER_STATUS_LABELS} />
              <Pill
                color={
                  receiptStatus === "complete"
                    ? "var(--admin-success)"
                    : receiptStatus === "partial"
                      ? "var(--admin-warning)"
                      : undefined
                }
                label={`Recepción: ${receiptStatusLabel}`}
              />
              <Pill
                color={
                  invoiceStatus === "complete"
                    ? "var(--admin-success)"
                    : invoiceStatus === "partial"
                      ? "var(--admin-warning)"
                      : undefined
                }
                label={`Facturación: ${invoiceStatusLabel}`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Dirty bar ── */}
      {dirty && (
        <div
          className="border-b px-4 py-2 sm:px-8 sm:py-2"
          style={{
            borderColor: "color-mix(in srgb, var(--admin-warning) 30%, transparent)",
            background: "color-mix(in srgb, var(--admin-warning) 5%, transparent)",
          }}
        >
          <div className="mx-auto max-w-[1600px] flex items-center justify-between gap-2">
            <span className="text-sm font-semibold sm:text-xs" style={{ color: "var(--admin-warning)" }}>
              Cambios sin guardar
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-lg px-3 py-2 text-sm font-semibold transition-all hover:opacity-80 sm:px-3 sm:py-1.5 sm:text-xs"
                style={{ border: "1px solid var(--admin-border)", color: "var(--admin-muted)" }}
                onClick={() => {
                  setDirty(false);
                  router.refresh();
                }}
                disabled={saving}
              >
                Descartar
              </button>
              <button
                type="button"
                className="rounded-lg px-3 py-2 text-base font-semibold text-white transition-all hover:opacity-90 sm:px-3 sm:py-1.5 sm:text-xs"
                style={{ background: "var(--admin-primary-strong)" }}
                onClick={() => void saveLines()}
                disabled={saving}
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Action Bar (BC-style command bar) ── */}
      <div
        className="border-b"
        style={{
          borderColor: "var(--admin-border)",
          background: "color-mix(in srgb, var(--admin-surface) 60%, var(--admin-background))",
        }}
      >
        <div className="mx-auto max-w-[1600px] flex flex-wrap items-stretch px-4 py-1.5 gap-0 overflow-x-auto sm:px-8">
          {canEdit && (
            <CommandGroup label="PEDIDO">
              <CommandBtn
                label="Guardar"
                icon="save"
                onClick={() => void saveLines()}
                disabled={saving || !dirty}
                primary={dirty}
              />
              <CommandBtn
                label="Editar cabecera"
                icon="edit"
                onClick={() => {
                  setEditingHeader(!editingHeader);
                  setDirty(true);
                }}
                disabled={busy || saving}
                active={editingHeader}
              />
              <CommandBtn
                label="Enviar"
                icon="external-link"
                onClick={() => void changeStatus("sent")}
                disabled={busy || saving}
              />
            </CommandGroup>
          )}
          {canReceive && hasPendingReceipt && (
            <CommandGroup label="REGISTRAR">
              <CommandBtn
                label="Recibir"
                icon="package"
                onClick={() => void confirmReceipt()}
                disabled={busy || saving}
                primary
              />
            </CommandGroup>
          )}
          <CommandGroup label="NAVEGAR">
            <CommandBtn
              label="Albaranes"
              badge={totalReceipts}
              icon="document"
              onClick={() => (totalReceipts > 0 ? setShowReceiptsModal(true) : undefined)}
              disabled={totalReceipts === 0}
            />
            <CommandBtn
              label="Facturas"
              badge={totalInvoices}
              icon="receipt"
              onClick={() => (totalInvoices > 0 ? setShowInvoicesModal(true) : undefined)}
              disabled={totalInvoices === 0}
            />
          </CommandGroup>
          {canClose && (
            <CommandGroup label="ESTADO">
              <CommandBtn
                label="Cerrar"
                icon="check"
                onClick={() => void changeStatus("closed")}
                disabled={busy}
              />
              {canCancel && (
                <CommandBtn
                  label="Cancelar"
                  icon="x"
                  onClick={() => void changeStatus("cancelled")}
                  disabled={busy}
                  danger
                />
              )}
            </CommandGroup>
          )}
          {canEdit && (
            <CommandGroup label="">
              <CommandBtn
                label="Eliminar"
                icon="trash"
                onClick={() => void remove()}
                disabled={busy}
                danger
              />
            </CommandGroup>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="mx-auto max-w-[1600px] flex flex-col lg:flex-row gap-6 px-4 py-5 sm:px-8 sm:py-6">
        <div className="flex-1 min-w-0 space-y-5">
          {/* GENERAL */}
          <CollapsibleSection
            title="General"
            description="Datos principales del documento"
            isOpen={openSections.general}
            onToggle={() => toggleSection("general")}
          >
            <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3 p-4 sm:p-6">
              <FieldRow label="Proveedor" value={order.supplier.name} />
              <FieldRow label="Nº documento" value={order.number} />
              <FieldRow label="Estado" value={purchaseStatusLabel(order.status)} />
              {editingHeader ? (
                <>
                  <FieldSelect
                    label="Sucursal"
                    value={String(headerDraft.branchId)}
                    onChange={(v) => setHeaderDraft((d) => ({ ...d, branchId: Number(v) }))}
                  >
                    <option value={order.branch.id}>{order.branch.name}</option>
                  </FieldSelect>
                  <FieldInput
                    label="Fecha documento"
                    type="date"
                    value={headerDraft.orderDate}
                    onChange={(v) => setHeaderDraft((d) => ({ ...d, orderDate: v }))}
                  />
                  <FieldInput
                    label="Fecha registro"
                    type="date"
                    value={headerDraft.postingDate}
                    onChange={(v) => setHeaderDraft((d) => ({ ...d, postingDate: v }))}
                  />
                  <FieldInput
                    label="Recepción prevista"
                    type="date"
                    value={headerDraft.expectedDate}
                    onChange={(v) => setHeaderDraft((d) => ({ ...d, expectedDate: v }))}
                  />
                  <FieldInput
                    label="Referencia proveedor"
                    value={headerDraft.externalReference}
                    onChange={(v) => setHeaderDraft((d) => ({ ...d, externalReference: v }))}
                    placeholder="Nº remito, OC proveedor..."
                  />
                </>
              ) : (
                <>
                  {order.expectedDate && (
                    <FieldRow label="Recepción prevista" value={dateLabel(order.expectedDate)} />
                  )}
                  {order.externalReference && (
                    <FieldRow label="Referencia proveedor" value={order.externalReference} />
                  )}
                </>
              )}
              <FieldRow label="Fecha documento" value={dateLabel(order.orderDate)} />
              <FieldRow label="Fecha registro" value={dateLabel(order.postingDate ?? order.createdAt)} />
              {order.supplier.paymentTerms && (
                <FieldRow label="Condiciones de pago" value={order.supplier.paymentTerms} />
              )}
              <FieldRow label="Sucursal" value={order.branch.name} />
              <FieldRow label="Moneda" value="ARS" />
              <FieldRow label="Comprador" value={order.createdBy?.name ?? "—"} />
            </div>
            {editingHeader && (
              <div className="flex justify-end gap-2 px-4 pb-5 sm:px-6 sm:pb-5">
                <button
                  type="button"
                  className="rounded-lg px-3 py-2 text-sm font-semibold transition-all hover:opacity-80 sm:px-3 sm:py-1.5 sm:text-xs"
                  style={{ border: "1px solid var(--admin-border)", color: "var(--admin-muted)" }}
                  onClick={() => setEditingHeader(false)}
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="rounded-lg px-3 py-2 text-base font-semibold text-white transition-all hover:opacity-90 sm:px-3 sm:py-1.5 sm:text-xs"
                  style={{ background: "var(--admin-primary-strong)" }}
                  onClick={() => {
                    setDirty(true);
                    void saveLines();
                  }}
                  disabled={saving}
                >
                  {saving ? "Guardando..." : "Guardar cabecera"}
                </button>
              </div>
            )}
          </CollapsibleSection>

          {/* LINES TABLE */}
          <CollapsibleSection
            title="Lineas"
            description={`${totalLines} articulo${totalLines !== 1 ? "s" : ""} en el pedido`}
            isOpen={openSections.lineas}
            onToggle={() => toggleSection("lineas")}
            badge={totalLines > 0 ? String(totalLines) : undefined}
            accentHeader
          >
            <div className="overflow-x-auto" style={{ scrollbarColor: "var(--admin-border) transparent" }}>
              <table className="w-full text-left text-base sm:text-xs">
                <thead>
                  <tr
                    style={{
                      borderBottom: "1px solid var(--admin-border)",
                      background:
                        "color-mix(in srgb, var(--admin-surface-elevated) 50%, var(--admin-surface))",
                    }}
                    className="text-base uppercase tracking-wider sticky top-0 z-10 sm:text-[10px] sm:tracking-wider"
                    role="row"
                  >
                    <Th className="px-3 py-3 sm:px-4 sm:py-3">#</Th>
                    <Th className="px-3 py-3 sm:px-4 sm:py-3">Articulo</Th>
                    <Th className="px-3 py-3 sm:px-4 sm:py-3">UdM</Th>
                    <Th r className="px-3 py-3 sm:px-4 sm:py-3"> cantidad</Th>
                    <Th r className="px-3 py-3 sm:px-4 sm:py-3">Recibida</Th>
                    <Th r accent className="px-3 py-3 sm:px-4 sm:py-3">
                      A recibir
                    </Th>
                    <Th r className="px-3 py-3 sm:px-4 sm:py-3">Facturada</Th>
                    <Th r accent className="px-3 py-3 sm:px-4 sm:py-3">
                      A facturar
                    </Th>
                    <Th r className="px-3 py-3 sm:px-4 sm:py-3">Costo</Th>
                    <Th r className="px-3 py-3 sm:px-4 sm:py-3">Dto %</Th>
                    <Th r className="px-3 py-3 sm:px-4 sm:py-3">Importe</Th>
                    <Th c className="px-3 py-3 sm:px-4 sm:py-3">Estado</Th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item, idx) => {
                    const ordered = Number(item.quantity) || 0,
                      received = Number(item.receivedQuantity) || 0,
                      invoiced = Number(item.invoicedQuantity) || 0;
                    const pendingRec = Math.max(0, ordered - received),
                      pendingInv = Math.max(0, ordered - invoiced);
                    const draft = lineDrafts[item.id] ?? {
                      quantity: String(ordered),
                      unitCost: String(Number(item.unitCost)),
                      discountPercent: "0",
                      qtyToReceive: String(pendingRec),
                      qtyToInvoice: String(pendingInv),
                    };
                    const discount = Number(draft.discountPercent) || 0,
                      unitCost = Number(draft.unitCost) || 0,
                      qty = Number(draft.quantity) || 0;
                    const lineNet = qty * unitCost * (1 - discount / 100);
                    const isHighlighted = highlightLineId === String(item.id);
                    const isComplete = pendingRec === 0 && pendingInv === 0;
                    return (
                      <tr
                        key={item.id}
                        className="transition-colors"
                        style={{
                          background: isHighlighted
                            ? "color-mix(in srgb, var(--admin-primary) 6%, transparent)"
                            : idx % 2 === 1
                              ? "color-mix(in srgb, var(--admin-surface-elevated) 15%, var(--admin-surface))"
                              : undefined,
                          boxShadow: isHighlighted ? `inset 3px 0 0 var(--admin-primary-strong)` : undefined,
                        }}
                      >
                        <Td>{String((idx + 1) * 10000).padStart(5, "0")}</Td>
                        <Td bold>{item.product.name}</Td>
                        <Td muted>{item.unit}</Td>
                        <Td r>
                          {!canEditLines ? (
                            <span className="tabular-nums font-semibold">{qty}</span>
                          ) : (
                            <InlineInput
                              value={draft.quantity}
                              onChange={(v) => {
                                updateLineDraft(item.id, "quantity", v);
                              }}
                            />
                          )}
                        </Td>
                        <Td r muted style={{ color: "var(--admin-success)" }}>
                          {received}
                        </Td>
                        <Td r>
                          {canReceive && pendingRec > 0 ? (
                            <InlineInput
                              value={draft.qtyToReceive}
                              onChange={(v) => updateLineDraft(item.id, "qtyToReceive", v)}
                              accent
                            />
                          ) : (
                            <span
                              className="tabular-nums font-semibold"
                              style={{
                                color: pendingRec === 0 ? "var(--admin-muted)" : "var(--admin-warning)",
                              }}
                            >
                              {pendingRec}
                            </span>
                          )}
                        </Td>
                        <Td r muted style={{ color: "#60a5fa" }}>
                          {invoiced}
                        </Td>
                        <Td r>
                          {canPrepareInvoice && pendingInv > 0 ? (
                            <InlineInput
                              value={draft.qtyToInvoice}
                              onChange={(v) => updateLineDraft(item.id, "qtyToInvoice", v)}
                              accent
                            />
                          ) : (
                            <span
                              className="tabular-nums font-semibold"
                              style={{
                                color: pendingInv === 0 ? "var(--admin-muted)" : "var(--admin-warning)",
                              }}
                            >
                              {pendingInv}
                            </span>
                          )}
                        </Td>
                        <Td r>
                          {!canEditLines ? (
                            <span className="tabular-nums">{money(unitCost, currency)}</span>
                          ) : (
                            <InlineInput
                              value={draft.unitCost}
                              onChange={(v) => updateLineDraft(item.id, "unitCost", v)}
                              wide
                            />
                          )}
                        </Td>
                        <Td r>
                          {!canEditLines ? (
                            <span className="tabular-nums">{discount > 0 ? `${discount}%` : "—"}</span>
                          ) : (
                            <InlineInput
                              value={draft.discountPercent}
                              onChange={(v) => updateLineDraft(item.id, "discountPercent", v)}
                              narrow
                            />
                          )}
                        </Td>
                        <Td r bold>
                          {money(lineNet, currency)}
                        </Td>
                        <Td c>
                          {isComplete ? (
                            <span
                              className="text-[10px] font-semibold"
                              style={{ color: "var(--admin-success)" }}
                            >
                              Completa
                            </span>
                          ) : pendingRec > 0 ? (
                            <span
                              className="text-[10px] font-semibold"
                              style={{ color: "var(--admin-warning)" }}
                            >
                              Pendiente
                            </span>
                          ) : (
                            <span className="text-[10px]" style={{ color: "var(--admin-muted)" }}>
                              —
                            </span>
                          )}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr
                    style={{
                      borderTop: "2px solid var(--admin-border)",
                      background:
                        "color-mix(in srgb, var(--admin-surface-elevated) 30%, var(--admin-surface))",
                    }}
                  >
                    <td
                      className="px-4 py-3 font-bold text-sm sm:px-5 sm:py-3.5 sm:text-xs"
                      colSpan={11}
                      style={{ color: "var(--admin-text)" }}
                    >
                      Total pedido
                    </td>
                    <td
                      className="px-4 py-3 text-right font-extrabold tabular-nums text-sm sm:px-5 sm:py-3.5 sm:text-xs"
                      style={{ color: "var(--admin-text)" }}
                    >
                      {money(totalOrdered, currency)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CollapsibleSection>

          {/* INLINE RECEIPT FORM */}
          {receivingFor !== null && (
            <div
              className="rounded-xl p-4 sm:p-5"
              style={{
                border: "1px solid color-mix(in srgb, var(--admin-primary) 25%, transparent)",
                background: "color-mix(in srgb, var(--admin-primary) 4%, transparent)",
              }}
            >
              <p className="text-base font-bold mb-3 sm:text-sm" style={{ color: "var(--admin-primary)" }}>
                Registrar recepcion
              </p>
              <div className="grid gap-3 sm:grid-cols-4">
                <FieldInput
                  label="Cantidad a recibir"
                  type="number"
                  value={receiveQty}
                  onChange={setReceiveQty}
                />
                <FieldInput
                  label="Costo unitario"
                  type="number"
                  value={receiveCost}
                  onChange={setReceiveCost}
                />
                <FieldInput
                  label="Notas"
                  value={receiveNotes}
                  onChange={setReceiveNotes}
                  placeholder="Remito, observaciones..."
                />
                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    className="rounded-lg px-3 py-2 text-base font-semibold text-white transition-all hover:opacity-90 sm:px-3 sm:py-1.5 sm:text-xs"
                    style={{ background: "var(--admin-primary-strong)" }}
                    onClick={() => void confirmReceipt()}
                    disabled={saving}
                  >
                    {saving ? "Confirmando..." : "Confirmar"}
                  </button>
                  <button
                    type="button"
                    className="rounded-lg px-3 py-2 text-base font-semibold transition-all hover:opacity-80 sm:px-3 sm:py-1.5 sm:text-xs"
                    style={{ border: "1px solid var(--admin-border)", color: "var(--admin-muted)" }}
                    onClick={() => setReceivingFor(null)}
                    disabled={saving}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* FACTURACION */}
          <CollapsibleSection
            title="Facturacion"
            description="Moneda, importes y estado de facturacion"
            isOpen={openSections.facturacion}
            onToggle={() => toggleSection("facturacion")}
            badge={totalInvoices > 0 ? String(totalInvoices) : undefined}
          >
            <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3 p-4 sm:p-6">
              <FieldRow label="Moneda" value="ARS" />
              <FieldRow label="Subtotal estimado" value={money(totalOrdered, currency)} />
              {order.supplier.paymentTerms && (
                <FieldRow label="Condiciones de pago" value={order.supplier.paymentTerms} />
              )}
            </div>
          </CollapsibleSection>

          {/* ENVIO */}
          <CollapsibleSection
            title="Envio y recepcion"
            description="Sucursal destino y recepciones"
            isOpen={openSections.envio}
            onToggle={() => toggleSection("envio")}
            badge={totalReceipts > 0 ? String(totalReceipts) : undefined}
          >
            <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3 p-4 sm:p-6">
              <FieldRow label="Sucursal destino" value={order.branch.name} />
              {order.expectedDate && (
                <FieldRow label="Fecha recepcion prevista" value={dateLabel(order.expectedDate)} />
              )}
              <FieldRow label="Recepciones registradas" value={String(totalReceipts)} />
            </div>
          </CollapsibleSection>

          {/* NOTAS */}
          <CollapsibleSection
            title="Notas"
            isOpen={openSections.notas}
            onToggle={() => toggleSection("notas")}
          >
            <div className="p-4 sm:p-6">
              {editingHeader ? (
                <textarea
                  className="input min-h-20 w-full text-base rounded-lg sm:text-sm"
                  value={headerDraft.notes}
                  onChange={(e) => setHeaderDraft((d) => ({ ...d, notes: e.target.value }))}
                  placeholder="Notas del pedido..."
                />
              ) : (
                <p
                  className="text-base whitespace-pre-wrap sm:text-sm"
                  style={{ color: order.notes ? "var(--admin-muted)" : "var(--admin-border)" }}
                >
                  {order.notes || "Sin notas"}
                </p>
              )}
            </div>
          </CollapsibleSection>
        </div>

        {/* FactBox */}
        {factBoxVisible && (
          <div className="w-full lg:w-72 shrink-0 space-y-4">
            <div
              className="rounded-xl p-4 space-y-5 sm:p-5"
              style={{ background: "var(--admin-surface)", border: "1px solid var(--admin-border)" }}
            >
              <FactBoxSection title="Resumen">
                <FactBoxRow label="Lineas" value={String(totalLines)} />
                <FactBoxRow label="Total" value={money(totalOrdered, currency)} bold />
                <FactBoxRow label="Albaranes" value={String(totalReceipts)} />
                <FactBoxRow label="Facturas" value={String(totalInvoices)} />
              </FactBoxSection>
              <FactBoxSection title="Recepcion">
                <FactBoxRow
                  label="Estado"
                  value={receiptStatusLabel}
                  color={
                    receiptStatus === "complete"
                      ? "var(--admin-success)"
                      : receiptStatus === "partial"
                        ? "var(--admin-warning)"
                        : "var(--admin-muted)"
                  }
                />
                <FactBoxRow label="Lineas" value={`${linesFullyReceived}/${totalLines}`} />
              </FactBoxSection>
              <FactBoxSection title="Facturacion">
                <FactBoxRow
                  label="Estado"
                  value={invoiceStatusLabel}
                  color={
                    invoiceStatus === "complete"
                      ? "var(--admin-success)"
                      : invoiceStatus === "partial"
                        ? "var(--admin-warning)"
                        : "var(--admin-muted)"
                  }
                />
                <FactBoxRow label="Lineas" value={`${linesFullyInvoiced}/${totalLines}`} />
              </FactBoxSection>
              <FactBoxSection title="Proveedor">
                <FactBoxRow label={order.supplier.name} value="" />
                {order.supplier.paymentTerms && (
                  <FactBoxRow label="Pago" value={order.supplier.paymentTerms} />
                )}
              </FactBoxSection>
            </div>
          </div>
        )}
      </div>

      {/* ── MODALS ── */}
      {showReceiptsModal && (
        <DocsModal
          onClose={() => setShowReceiptsModal(false)}
          title="Albaranes registrados"
          subtitle={`Pedido ${order.number}`}
          count={totalReceipts}
          items={order.receipts.map((r) => ({
            id: r.id,
            number: r.number,
            date: dateLabel(r.receivedAt),
            subtitle: `${r.items.length} linea${r.items.length !== 1 ? "s" : ""}${r.createdBy ? ` \u00B7 ${r.createdBy.name}` : ""}`,
            total: r.items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitCost) || 0), 0),
          }))}
          hrefFn={(id) => href(`/admin/compras/albaranes/${id}`)}
          currency={currency}
        />
      )}
      {showInvoicesModal && (
        <DocsModal
          onClose={() => setShowInvoicesModal(false)}
          title="Facturas registradas"
          subtitle={`Pedido ${order.number}`}
          count={totalInvoices}
          items={order.invoices.map((inv) => ({
            id: inv.id,
            number: inv.number,
            date: dateLabel(inv.documentDate),
            subtitle: inv.status === "paid" ? "Pagado" : inv.status === "cancelled" ? "Anulado" : "Pendiente",
            total: Number(inv.total) || 0,
            statusColor:
              inv.status === "paid"
                ? "var(--admin-success)"
                : inv.status === "cancelled"
                  ? "var(--admin-danger)"
                  : "var(--admin-warning)",
          }))}
          hrefFn={(id) => href(`/admin/compras/facturas/${id}`)}
          currency={currency}
        />
      )}
    </div>
  );
}

/* ────────────────────────── Sub-components ────────────────────────── */

function Pill({ color, label }: { color?: string; label: string }) {
  return (
    <span
      className="rounded-full px-2.5 py-1 text-[10px] font-bold"
      style={{
        background: color
          ? `color-mix(in srgb, ${color} 15%, transparent)`
          : "color-mix(in srgb, var(--admin-muted) 10%, transparent)",
        color: color || "var(--admin-muted)",
      }}
    >
      {label}
    </span>
  );
}

function CommandGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      className="flex items-center border-r px-2 sm:px-3 py-1 last:border-r-0"
      style={{ borderColor: "color-mix(in srgb, var(--admin-border) 50%, transparent)" }}
    >
      {label && (
        <span
          className="mr-2.5 text-[9px] font-extrabold uppercase tracking-widest whitespace-nowrap hidden sm:inline"
          style={{ color: "var(--admin-muted)", minWidth: "auto" }}
        >
          {label}
        </span>
      )}
      <div className="flex items-center gap-1 flex-wrap">{children}</div>
    </div>
  );
}

function CommandBtn({
  label,
  icon,
  badge,
  onClick,
  disabled,
  primary,
  danger,
  active,
}: {
  label: string;
  icon?: IconName;
  badge?: number;
  onClick?: () => void;
  disabled?: boolean;
  primary?: boolean;
  danger?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg px-4 py-2.5 text-base font-semibold transition-all duration-150 whitespace-nowrap flex items-center gap-1.5 min-h-[44px] sm:px-3 sm:py-2 sm:text-xs sm:min-h-[36px]"
      style={{
        color: danger
          ? "var(--admin-danger)"
          : primary
            ? "#fff"
            : active
              ? "var(--admin-primary-strong)"
              : "var(--admin-muted)",
        background: primary
          ? "var(--admin-primary-strong)"
          : active
            ? "color-mix(in srgb, var(--admin-primary) 12%, transparent)"
            : "transparent",
        opacity: disabled ? 0.35 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        border: primary
          ? "none"
          : active
            ? "1px solid color-mix(in srgb, var(--admin-primary) 25%, transparent)"
            : "1px solid transparent",
      }}
      onMouseEnter={(e) => {
        if (!disabled && !primary)
          e.currentTarget.style.background = "color-mix(in srgb, var(--admin-primary) 8%, transparent)";
      }}
      onMouseLeave={(e) => {
        if (!primary)
          e.currentTarget.style.background = active
            ? "color-mix(in srgb, var(--admin-primary) 12%, transparent)"
            : "transparent";
      }}
    >
      {icon && <Icon name={icon} className="text-base sm:text-sm" />}
      <span className="hidden sm:inline">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span
          className="rounded-full px-2 py-0.5 text-xs font-bold sm:px-1.5 sm:py-0.5 sm:text-[9px]"
          style={{
            background: primary
              ? "rgba(255,255,255,0.2)"
              : "color-mix(in srgb, var(--admin-primary) 18%, transparent)",
            color: primary ? "#fff" : "var(--admin-primary)",
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function CollapsibleSection({
  title,
  description,
  isOpen,
  onToggle,
  badge,
  accentHeader,
  children,
}: {
  title: string;
  description?: string;
  isOpen: boolean;
  onToggle: () => void;
  badge?: string;
  accentHeader?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl overflow-hidden transition-all duration-250"
      style={{
        background: "var(--admin-surface)",
        border: `1px solid ${accentHeader && isOpen ? "color-mix(in srgb, var(--admin-primary) 20%, var(--admin-border))" : "var(--admin-border)"}`,
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left transition-colors duration-150 group sm:px-6 sm:py-4"
        style={{
          background: isOpen
            ? "color-mix(in srgb, var(--admin-surface-elevated) 30%, var(--admin-surface))"
            : undefined,
        }}
        onMouseEnter={(e) => {
          if (!isOpen)
            e.currentTarget.style.background =
              "color-mix(in srgb, var(--admin-surface-elevated) 20%, var(--admin-surface))";
        }}
        onMouseLeave={(e) => {
          if (!isOpen) e.currentTarget.style.background = "";
        }}
      >
        <div className="flex items-center gap-3">
          <h3 className="text-base font-bold sm:text-sm" style={{ color: "var(--admin-text)" }}>
            {title}
          </h3>
          {badge && (
            <span
              className="rounded-full px-2 py-0.5 text-xs font-bold sm:text-[10px]"
              style={{
                background: "color-mix(in srgb, var(--admin-primary) 15%, transparent)",
                color: "var(--admin-primary)",
              }}
            >
              {badge}
            </span>
          )}
          {description && (
            <span className="text-xs hidden sm:inline" style={{ color: "var(--admin-muted)" }}>
              {description}
            </span>
          )}
        </div>
        <Icon
          name="arrow-down"
          className="text-xs transition-transform duration-200"
          style={{ color: "var(--admin-muted)", transform: isOpen ? "rotate(180deg)" : undefined }}
        />
      </button>
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-200 ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
      >
        <div className="overflow-hidden">{children}</div>
      </div>
    </div>
  );
}

function Th({
  children,
  r,
  c,
  accent,
  className,
}: {
  children: React.ReactNode;
  r?: boolean;
  c?: boolean;
  accent?: boolean;
  className?: string;
}) {
  return (
    <th
      className={`px-3 py-3 font-semibold sm:px-4 sm:py-3 ${className ?? ""}`}
      style={{
        textAlign: r ? "right" : c ? "center" : "left",
        color: accent ? "var(--admin-primary)" : "var(--admin-muted)",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  r,
  c,
  bold,
  muted,
  style,
  className,
}: {
  children: React.ReactNode;
  r?: boolean;
  c?: boolean;
  bold?: boolean;
  muted?: boolean;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <td
      className={`px-3 py-3 transition-colors sm:px-4 sm:py-3 ${className ?? ""}`}
      style={{
        textAlign: r ? "right" : c ? "center" : "left",
        fontWeight: bold ? 700 : 500,
        color: muted ? "var(--admin-muted)" : "var(--admin-text)",
        ...style,
      }}
    >
      {children}
    </td>
  );
}

function InlineInput({
  value,
  onChange,
  accent,
  wide,
  narrow,
}: {
  value: string;
  onChange: (v: string) => void;
  accent?: boolean;
  wide?: boolean;
  narrow?: boolean;
}) {
  return (
    <input
      type="number"
      min={0}
      step="0.001"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border px-3 py-2 text-right text-base tabular-nums outline-none transition-all duration-150 focus:ring-1 sm:px-2 sm:py-1 sm:text-xs"
      style={
        {
          width: narrow ? "48px" : wide ? "80px" : "60px",
          borderColor: accent
            ? "color-mix(in srgb, var(--admin-primary) 30%, transparent)"
            : "var(--admin-border)",
          background: accent ? "color-mix(in srgb, var(--admin-primary) 5%, transparent)" : "transparent",
          color: "var(--admin-text)",
          "--tw-ring-color": "var(--admin-primary)",
          minHeight: "44px",
        } as React.CSSProperties
      }
    />
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p
        className="text-xs font-semibold uppercase tracking-wider mb-1 sm:text-[10px]"
        style={{ color: "var(--admin-muted)" }}
      >
        {label}
      </p>
      <p className="text-base font-bold sm:text-sm" style={{ color: "var(--admin-text)" }}>
        {value}
      </p>
    </div>
  );
}

function FieldInput({
  label,
  value,
  type,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  type?: string;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p
        className="text-xs font-semibold uppercase tracking-wider mb-1"
        style={{ color: "var(--admin-muted)" }}
      >
        {label}
      </p>
      <input
        className="input w-full py-2.5 text-base rounded-lg sm:py-1.5 sm:text-sm"
        type={type ?? "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function FieldSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p
        className="text-xs font-semibold uppercase tracking-wider mb-1"
        style={{ color: "var(--admin-muted)" }}
      >
        {label}
      </p>
      <select
        className="input w-full py-2.5 text-base rounded-lg sm:py-1.5 sm:text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
    </div>
  );
}

function FactBoxSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p
        className="text-xs font-bold uppercase tracking-wider mb-2 pb-2 sm:text-[10px]"
        style={{ color: "var(--admin-muted)", borderBottom: "1px solid var(--admin-border)" }}
      >
        {title}
      </p>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function FactBoxRow({
  label,
  value,
  bold,
  color,
}: {
  label: string;
  value: string;
  bold?: boolean;
  color?: string;
}) {
  return (
    <div className="flex items-center justify-between text-sm gap-2 sm:text-xs">
      <span className="truncate" style={{ color: "var(--admin-muted)" }}>
        {label}
      </span>
      <span
        className={`tabular-nums whitespace-nowrap ${bold ? "font-extrabold" : "font-semibold"}`}
        style={{ color: color || "var(--admin-text)" }}
      >
        {value}
      </span>
    </div>
  );
}

function DocsModal({
  onClose,
  title,
  subtitle,
  count,
  items,
  hrefFn,
  currency,
}: {
  onClose: () => void;
  title: string;
  subtitle: string;
  count: number;
  items: Array<{
    id: number;
    number: string;
    date: string;
    subtitle: string;
    total: number;
    statusColor?: string;
  }>;
  hrefFn: (id: number) => string;
  currency: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const totalAll = items.reduce((s, i) => s + i.total, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg flex flex-col rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: "var(--admin-surface)",
          border: "1px solid var(--admin-border)",
          maxHeight: "70vh",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative px-5 pt-5 pb-4 sm:px-6 sm:pt-5 sm:pb-4" style={{ borderBottom: "1px solid var(--admin-border)" }}>
          <div
            className="absolute top-0 left-0 right-0 h-[2px]"
            style={{ background: "linear-gradient(90deg, var(--admin-primary-strong), transparent)" }}
          />
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold sm:text-base" style={{ color: "var(--admin-text)" }}>
                {title}
              </h2>
              <p className="text-sm mt-0.5 sm:text-xs" style={{ color: "var(--admin-muted)" }}>
                {subtitle}
                {count > 0 ? ` · ${count} documento${count !== 1 ? "s" : ""}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 transition-colors sm:p-1.5"
              style={{ color: "var(--admin-muted)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "color-mix(in srgb, var(--admin-muted) 10%, transparent)")
              }
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <Icon name="x" className="text-lg sm:text-sm" />
            </button>
          </div>
        </div>
        <div
          className="flex-1 overflow-y-auto p-4 space-y-2 sm:p-4"
          style={{ scrollbarColor: "var(--admin-border) transparent" }}
        >
          {items.map((item) => (
            <Link
              key={item.id}
              href={hrefFn(item.id) as never}
              className="block rounded-xl px-5 py-4 transition-all duration-150 group sm:px-5 sm:py-4"
              style={{ border: "1px solid var(--admin-border)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background =
                  "color-mix(in srgb, var(--admin-primary) 5%, var(--admin-surface-elevated))";
                e.currentTarget.style.borderColor =
                  "color-mix(in srgb, var(--admin-primary) 20%, transparent)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.borderColor = "var(--admin-border)";
              }}
              onClick={onClose}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-base sm:text-sm" style={{ color: "var(--admin-primary)" }}>
                  {item.number}
                </span>
                <span className="font-bold tabular-nums text-base sm:text-sm" style={{ color: "var(--admin-text)" }}>
                  {money(item.total, currency)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm sm:text-xs" style={{ color: "var(--admin-muted)" }}>
                  {item.date}
                </span>
                <span className="text-xs sm:text-[11px]" style={{ color: item.statusColor || "var(--admin-muted)" }}>
                  {item.subtitle}
                </span>
              </div>
            </Link>
          ))}
          {count > 1 && (
            <div
              className="flex items-center justify-between px-5 py-3 rounded-xl sm:px-5 sm:py-3"
              style={{
                background: "color-mix(in srgb, var(--admin-surface-elevated) 50%, var(--admin-surface))",
              }}
            >
              <span className="text-sm font-semibold sm:text-xs" style={{ color: "var(--admin-muted)" }}>
                Total recibido
              </span>
              <span className="text-base font-bold tabular-nums sm:text-sm" style={{ color: "var(--admin-text)" }}>
                {money(totalAll, currency)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function purchaseStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: "Borrador",
    sent: "Enviado",
    partially_received: "Recibido parcial",
    received: "Recibido",
    closed: "Cerrado",
    cancelled: "Cancelado",
  };
  return labels[status] ?? status;
}
