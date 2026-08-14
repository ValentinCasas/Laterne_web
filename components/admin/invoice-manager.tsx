"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef } from "react";
import Swal from "sweetalert2";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { InvoiceRenderer, type InvoiceRenderData } from "@/components/invoice/invoice-renderer";
import { scopedFetch } from "@/lib/client-routing";
import {
  createBlock,
  invoiceBlockLabels,
  invoicePresetLabels,
  invoiceTableStyleLabels,
  presetBlocks,
  resolveInvoiceDesign,
  type InvoiceAlign,
  type InvoiceBlock,
  type InvoiceBlockType,
  type InvoiceDesign,
  type InvoiceFont,
  type InvoicePreset,
  type InvoiceTableStyle,
} from "@/lib/invoice-design";
import { adminHrefFromPathname } from "@/lib/routes";

type Invoice = {
  id: number;
  status: string;
  number: string | null;
  total: string | number;
  currency: string;
  customerName: string;
  customerTaxId: string | null;
  notes: string | null;
  createdAt: string;
  branch: { name: string } | null;
  order: { reference: string };
};
type AvailableOrder = {
  id: number;
  reference: string;
  customerName: string;
  total: string | number;
  currency: string;
  createdAt: string;
};

export type InvoiceSettingsData = {
  issuerName: string | null;
  taxId: string | null;
  address: string | null;
  city: string | null;
  terms: string | null;
  templatePreset: string | null;
  design: unknown;
};

const presetAccent: Record<InvoicePreset, string> = {
  compact: "#18181b",
  classic: "#7f1d1d",
  modern: "#0d9488",
};

const presetSwatches: Record<InvoicePreset, string[]> = {
  compact: ["#18181b", "#fafafa", "#d4d4d8"],
  classic: ["#7f1d1d", "#f5efe6", "#1c1917"],
  modern: ["#0d9488", "#f0fdfa", "#134e4a"],
};

const presetDescriptions: Record<InvoicePreset, string> = {
  compact: "Sobrio y minimalista, sin adornos.",
  classic: "Tradicional, con serifas y QR.",
  modern: "Contemporáneo con color de acento.",
};

/** @summary Datos ficticios y seguros para el preview: nunca se tocan comprobantes reales. */
const previewData: InvoiceRenderData = {
  issuerName: "Nombre del negocio",
  taxId: "30-12345678-9",
  address: "Av. Siempre Viva 123",
  city: "Buenos Aires",
  number: "A-0000-00184",
  customerName: "Juan Pérez",
  customerTaxId: "20-30123456-7",
  orderReference: "PED-00184",
  orderDate: "1 de septiembre de 2026",
  items: [
    { productName: "Hamburguesa Clásica", variantName: "Triple", quantity: 2, unitPrice: 8000, total: 16000 },
    { productName: "Limonada", quantity: 1, unitPrice: 2500, total: 2500 },
  ],
  currency: "ARS",
  subtotal: 18500,
  discount: 0,
  deliveryFee: 0,
  total: 18500,
  notes: "Sin cebolla en una hamburguesa.",
  terms: "Documento operativo. No válido como comprobante fiscal.",
  qrUrl: null,
};

const addableBlocks: Array<{ type: InvoiceBlockType; label: string; hint: string }> = [
  { type: "customText", label: "Texto", hint: "Texto libre o personalizado" },
  { type: "separator", label: "Separador", hint: "Línea horizontal" },
  { type: "logo", label: "Logo", hint: "Monograma del negocio" },
  { type: "qr", label: "QR", hint: "Código del comprobante" },
  { type: "customerData", label: "Datos del cliente", hint: "Nombre y documento" },
  { type: "orderData", label: "Datos del pedido", hint: "Número y fecha" },
  { type: "table", label: "Tabla de productos", hint: "Líneas del pedido" },
  { type: "subtotal", label: "Subtotal", hint: "Total sin descuentos" },
  { type: "discount", label: "Descuento", hint: "Descuentos aplicados" },
  { type: "delivery", label: "Delivery", hint: "Costo de envío" },
  { type: "total", label: "Total", hint: "Importe final" },
  { type: "notes", label: "Observaciones", hint: "Notas del pedido" },
];

const editableTextTypes: InvoiceBlockType[] = ["title", "customText", "footer", "number"];

/** @summary Gestiona comprobantes internos, datos del emisor y el diseñador visual del comprobante. */
export function InvoiceManager({
  initialInvoices,
  availableOrders,
  initialSettings,
}: {
  initialInvoices: Invoice[];
  availableOrders: AvailableOrder[];
  initialSettings: InvoiceSettingsData | null;
}) {
  const pathname = usePathname();
  const [invoices, setInvoices] = useState(initialInvoices);
  const [orders, setOrders] = useState(availableOrders);
  const [settings, setSettings] = useState<InvoiceSettingsData | null>(initialSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [design, setDesign] = useState<InvoiceDesign>(() => resolveInvoiceDesign(initialSettings?.design));
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [dragBlockId, setDragBlockId] = useState<string | null>(null);
  const [dropBlockId, setDropBlockId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedBlock = design.blocks.find((block) => block.id === selectedBlockId) ?? null;
  const blockIdCounter = useRef(0);
  const previewIssuerName = settings?.issuerName?.trim() || previewData.issuerName;
  const previewDataWithIssuer: InvoiceRenderData = {
    ...previewData,
    issuerName: previewIssuerName,
    taxId: settings?.taxId ?? previewData.taxId,
    address: settings?.address ?? previewData.address,
    city: settings?.city ?? previewData.city,
    terms: settings?.terms ?? previewData.terms,
  };

  /** @summary Guarda los datos del emisor y el diseño que se estampan en cada comprobante. */
  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const payload = {
      issuerName: String(form.get("issuerName") ?? "").trim() || null,
      taxId: String(form.get("taxId") ?? "").trim() || null,
      address: String(form.get("address") ?? "").trim() || null,
      city: String(form.get("city") ?? "").trim() || null,
      terms: String(form.get("terms") ?? "").trim() || null,
      design,
    };
    try {
      const response = await scopedFetch("/api/admin/invoice-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => ({}))) as { settings?: InvoiceSettingsData; error?: string };
      if (!response.ok || !body.settings) {
        throw new Error(body.error ?? "No se pudo guardar");
      }
      setSettings(body.settings);
      setDesign(resolveInvoiceDesign(body.settings.design));
      await Swal.fire({
        title: "Configuración guardada",
        text: "El diseño ya se usa en los comprobantes y su impresión.",
        icon: "success",
        timer: 1400,
        showConfirmButton: false,
        background: "#18181b",
        color: "#fafafa",
      });
    } catch (error) {
      await Swal.fire({
        title: "No se pudo guardar",
        text: error instanceof Error ? error.message : "Intentá nuevamente.",
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
    } finally {
      setSaving(false);
    }
  }

  /** @summary Aplica un preset como punto de partida conservando tipografía y color actuales. */
  function applyPreset(preset: InvoicePreset) {
    setDesign((current) => ({
      ...current,
      preset,
      accent: presetAccent[preset],
      blocks: presetBlocks(preset, presetAccent[preset]),
    }));
    setSelectedBlockId(null);
    setAddOpen(false);
  }

  /** @summary Restaura el diseño por defecto del preset activo después de confirmar. */
  async function restoreDesign() {
    const confirmation = await Swal.fire({
      title: "¿Restaurar diseño?",
      text: "Vas a volver a la estructura por defecto del preset actual. Los cambios sin guardar se pierden.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, restaurar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ef4444",
      background: "#18181b",
      color: "#fafafa",
    });
    if (!confirmation.isConfirmed) return;
    const accent = presetAccent[design.preset];
    setDesign((current) => ({ ...current, accent, blocks: presetBlocks(current.preset, accent) }));
    setSelectedBlockId(null);
  }

  function updateBlock(id: string, patch: Partial<InvoiceBlock>) {
    setDesign((current) => ({
      ...current,
      blocks: current.blocks.map((block) => (block.id === id ? { ...block, ...patch } : block)),
    }));
  }

  function moveBlock(id: string, direction: -1 | 1) {
    setDesign((current) => {
      const index = current.blocks.findIndex((block) => block.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.blocks.length) return current;
      const blocks = [...current.blocks];
      [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
      return { ...current, blocks };
    });
  }

  function moveBlockTo(id: string, targetId: string) {
    setDesign((current) => {
      const from = current.blocks.findIndex((block) => block.id === id);
      const to = current.blocks.findIndex((block) => block.id === targetId);
      if (from < 0 || to < 0 || from === to) return current;
      const blocks = [...current.blocks];
      const [moved] = blocks.splice(from, 1);
      blocks.splice(to, 0, moved);
      return { ...current, blocks };
    });
  }

  function removeBlock(id: string) {
    setDesign((current) => ({
      ...current,
      blocks: current.blocks.filter((block) => block.id !== id),
    }));
    if (selectedBlockId === id) setSelectedBlockId(null);
  }

  function addBlock(type: InvoiceBlockType) {
    blockIdCounter.current += 1;
    const block = createBlock(type, `${type}-${blockIdCounter.current}`);
    setDesign((current) => ({ ...current, blocks: [...current.blocks, block] }));
    setSelectedBlockId(block.id);
    setAddOpen(false);
  }

  function addTotals() {
    const totals: InvoiceBlock[] = ["subtotal", "discount", "delivery"].map((kind) => {
      blockIdCounter.current += 1;
      return createBlock(kind as InvoiceBlockType, `${kind}-${blockIdCounter.current}`);
    });
    blockIdCounter.current += 1;
    const totalBlock = createBlock("total", `total-${blockIdCounter.current}`);
    setDesign((current) => ({
      ...current,
      blocks: [...current.blocks, ...totals, totalBlock],
    }));
    setSelectedBlockId(totalBlock.id);
    setAddOpen(false);
  }

  /** @summary Genera un comprobante trazable desde un pedido seleccionado. */
  async function createInvoice(orderId: number) {
    const response = await scopedFetch("/api/admin/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    });
    const body = (await response.json().catch(() => ({}))) as { invoice?: Invoice; error?: string };
    if (!response.ok || !body.invoice) {
      await Swal.fire({
        title: "No se pudo crear",
        text: body.error,
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
      return;
    }
    setInvoices((current) => [body.invoice!, ...current]);
    setOrders((current) => current.filter((order) => order.id !== orderId));
  }

  /** @summary Edita datos auxiliares y cambia el estado de emisión del comprobante seleccionado. */
  async function editInvoice(invoice: Invoice) {
    const dialog = await Swal.fire({
      title: invoice.number ?? "Comprobante",
      html: `<select id="invoice-status" class="swal2-select" style="display:block;width:100%;margin:.5rem 0"><option value="draft" ${invoice.status === "draft" ? "selected" : ""}>Borrador</option><option value="issued" ${invoice.status === "issued" ? "selected" : ""}>Emitido</option><option value="cancelled" ${invoice.status === "cancelled" ? "selected" : ""}>Anulado</option></select><input id="invoice-tax" class="swal2-input" maxlength="40" placeholder="CUIT/DNI opcional"><textarea id="invoice-notes" class="swal2-textarea" maxlength="1000" placeholder="Notas internas"></textarea>`,
      showCancelButton: true,
      confirmButtonText: "Guardar",
      cancelButtonText: "Cancelar",
      background: "#18181b",
      color: "#fafafa",
      didOpen: () => {
        (document.querySelector("#invoice-tax") as HTMLInputElement).value = invoice.customerTaxId ?? "";
        (document.querySelector("#invoice-notes") as HTMLTextAreaElement).value = invoice.notes ?? "";
      },
      preConfirm: () => ({
        status: (document.querySelector("#invoice-status") as HTMLSelectElement).value,
        customerTaxId: (document.querySelector("#invoice-tax") as HTMLInputElement).value,
        notes: (document.querySelector("#invoice-notes") as HTMLTextAreaElement).value,
      }),
    });
    if (!dialog.isConfirmed) return;
    const response = await scopedFetch(`/api/admin/invoices/${invoice.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dialog.value),
    });
    const body = (await response.json().catch(() => ({}))) as { invoice?: Invoice; error?: string };
    if (!response.ok || !body.invoice) return;
    setInvoices((current) => current.map((item) => (item.id === invoice.id ? body.invoice! : item)));
  }

  return (
    <section>
      <AdminPageHeader
        eyebrow="Documentación"
        title="Comprobantes"
        description="Estos documentos son internos y no sustituyen una factura fiscal. La integración fiscal queda lista para conectarse a un proveedor autorizado."
        section="facturacion"
        actions={
          <button className="btn" onClick={() => setSettingsOpen((current) => !current)} type="button">
            {settingsOpen ? "Cerrar configuración" : "Configuración del comprobante"}
          </button>
        }
      />

      {settingsOpen && (
        <form className="card mt-6 grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_360px]" onSubmit={saveSettings}>
          <div className="space-y-6 min-w-0">
            <section className="grid gap-4 sm:grid-cols-2">
              <h2 className="text-xl font-black sm:col-span-2">Datos del emisor</h2>
              <label className="text-sm font-bold">
                Nombre del negocio en el comprobante
                <input className="input mt-2" name="issuerName" defaultValue={settings?.issuerName ?? ""} placeholder={settings?.issuerName ? undefined : "Nombre que se estampa en el comprobante"} />
              </label>
              <label className="text-sm font-bold">
                CUIT o documento
                <input className="input mt-2" name="taxId" defaultValue={settings?.taxId ?? ""} placeholder={settings?.taxId ? undefined : "Ej. 30-12345678-9"} />
              </label>
              <label className="text-sm font-bold">
                Domicilio
                <input className="input mt-2" name="address" defaultValue={settings?.address ?? ""} placeholder={settings?.address ? undefined : "Calle y número"} />
              </label>
              <label className="text-sm font-bold">
                Localidad
                <input className="input mt-2" name="city" defaultValue={settings?.city ?? ""} placeholder={settings?.city ? undefined : "Ciudad"} />
              </label>
              <label className="text-sm font-bold sm:col-span-2">
                Condiciones o pie de comprobante
                <textarea className="input mt-2 min-h-24" name="terms" defaultValue={settings?.terms ?? ""} placeholder="Ej. Gracias por tu compra. Los comprobantes son internos y no fiscales." />
              </label>
            </section>

            <section>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black">Diseñador del comprobante</h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Tocá un elemento de la hoja o de la lista para editarlo, y arrastralo para ordenarlo.
                  </p>
                </div>
                <button className="btn btn-secondary" onClick={() => void restoreDesign()} type="button">
                  Restaurar diseño
                </button>
              </div>
              <div className="mt-4 rounded-3xl border border-white/10 bg-white p-4 shadow-2xl shadow-black/30 sm:p-6">
                <InvoiceRenderer
                  design={design}
                  data={previewDataWithIssuer}
                  interactive
                  selectedId={selectedBlockId}
                  onSelect={setSelectedBlockId}
                />
              </div>
              <p className="mt-3 text-xs text-zinc-600">
                El preview usa datos ficticios (Juan Pérez, PED-00184, $18.500) y jamás toca comprobantes reales. La
                impresión y el PDF usan exactamente este mismo diseño.
              </p>
            </section>
          </div>

          <aside className="space-y-4 min-w-0">
            <section className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500">Preset de partida</h3>
              <div className="mt-3 grid gap-2">
                {(["compact", "classic", "modern"] as const).map((preset) => (
                  <button
                    className={`rounded-xl border p-3 text-left transition ${
                      design.preset === preset
                        ? "border-pink-500/60 bg-pink-500/10"
                        : "border-white/10 bg-white/[.03] hover:border-white/25"
                    }`}
                    key={preset}
                    onClick={() => applyPreset(preset)}
                    type="button"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex gap-1.5">
                        {presetSwatches[preset].map((color) => (
                          <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: color }} key={color} />
                        ))}
                      </span>
                      <strong className="text-sm">{invoicePresetLabels[preset]}</strong>
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">{presetDescriptions[preset]}</p>
                  </button>
                ))}
              </div>
            </section>

            <section className="grid gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500">Tipografía y acento</h3>
              <label className="text-sm font-bold">
                Color de acento
                <span className="mt-2 flex items-center gap-3 rounded-xl border border-white/10 p-2">
                  <input
                    className="h-8 w-12 cursor-pointer rounded-lg border-0 bg-transparent"
                    type="color"
                    value={design.accent}
                    onChange={(event) => setDesign((current) => ({ ...current, accent: event.target.value }))}
                    aria-label="Color de acento"
                  />
                  <span className="text-xs text-zinc-500">{design.accent}</span>
                </span>
              </label>
              <label className="text-sm font-bold">
                Tipografía
                <select
                  className="input mt-2"
                  value={design.font}
                  onChange={(event) =>
                    setDesign((current) => ({ ...current, font: event.target.value as InvoiceFont }))
                  }
                >
                  <option value="sans">Moderna (sans-serif)</option>
                  <option value="serif">Clásica (serif)</option>
                  <option value="mono">Técnica (monospace)</option>
                </select>
              </label>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500">
                  Elementos del comprobante
                </h3>
                <button className="rounded-lg bg-pink-500/10 px-2 py-1 text-xs font-bold text-pink-300" type="button">
                  {design.blocks.length}
                </button>
              </div>
              <div className="mt-3 space-y-1.5">
                {design.blocks.map((block, index) => (
                  <div
                    className={`flex items-center gap-2 rounded-xl border p-2 transition ${
                      selectedBlockId === block.id
                        ? "border-pink-500/50 bg-pink-500/10"
                        : dropBlockId === block.id
                          ? "border-pink-500/30 bg-pink-500/[.04]"
                          : "border-white/10 bg-white/[.03]"
                    }`}
                    draggable
                    key={block.id}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", block.id);
                      setDragBlockId(block.id);
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDropBlockId(block.id);
                    }}
                    onDragLeave={() => setDropBlockId(null)}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (dragBlockId) moveBlockTo(dragBlockId, block.id);
                      setDragBlockId(null);
                      setDropBlockId(null);
                    }}
                    onDragEnd={() => {
                      setDragBlockId(null);
                      setDropBlockId(null);
                    }}
                  >
                    <button
                      className="cursor-grab text-zinc-600 active:cursor-grabbing"
                      type="button"
                      aria-label="Arrastrar para reordenar"
                      title="Arrastrá para reordenar"
                    >
                      ⋮⋮
                    </button>
                    <button
                      className={`flex min-w-0 flex-1 items-center gap-2 text-left ${block.visible ? "" : "opacity-40"}`}
                      onClick={() => setSelectedBlockId(block.id)}
                      type="button"
                    >
                      <span className="text-[10px] font-black text-zinc-600">{index + 1}</span>
                      <span className="truncate text-sm font-bold">{invoiceBlockLabels[block.type]}</span>
                      {block.columns === "half" && (
                        <span className="rounded bg-white/5 px-1.5 text-[9px] font-black text-zinc-500">½</span>
                      )}
                    </button>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        className="grid h-6 w-6 place-items-center rounded-md text-xs text-zinc-400 hover:bg-white/5"
                        onClick={() => moveBlock(block.id, -1)}
                        disabled={index === 0}
                        type="button"
                        aria-label="Subir"
                      >
                        ↑
                      </button>
                      <button
                        className="grid h-6 w-6 place-items-center rounded-md text-xs text-zinc-400 hover:bg-white/5"
                        onClick={() => moveBlock(block.id, 1)}
                        disabled={index === design.blocks.length - 1}
                        type="button"
                        aria-label="Bajar"
                      >
                        ↓
                      </button>
                      <button
                        className={`grid h-6 w-6 place-items-center rounded-md text-xs ${
                          block.visible ? "text-pink-300" : "text-zinc-600"
                        } hover:bg-white/5`}
                        onClick={() => updateBlock(block.id, { visible: !block.visible })}
                        type="button"
                        aria-label={block.visible ? "Ocultar" : "Mostrar"}
                        title={block.visible ? "Ocultar" : "Mostrar"}
                      >
                        {block.visible ? "👁" : "–"}
                      </button>
                      <button
                        className="grid h-6 w-6 place-items-center rounded-md text-xs text-red-300 hover:bg-red-500/10"
                        onClick={() => removeBlock(block.id)}
                        type="button"
                        aria-label="Quitar"
                        title="Quitar elemento"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="relative mt-3">
                <button
                  className="w-full rounded-2xl border-2 border-dashed border-white/15 p-3 text-sm font-bold text-zinc-400 transition hover:border-pink-500/40 hover:text-pink-200"
                  onClick={() => setAddOpen((current) => !current)}
                  type="button"
                >
                  + Agregar elemento
                </button>
                {addOpen && (
                  <div className="absolute bottom-full left-0 z-20 mb-2 max-h-64 w-full space-y-0.5 overflow-y-auto rounded-2xl border border-white/10 bg-zinc-900 p-2 shadow-2xl">
                    <button
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold text-teal-300 hover:bg-white/5"
                      onClick={addTotals}
                      type="button"
                    >
                      <span>Totales</span>
                      <small className="text-[10px] text-zinc-500">Subtotal + descuento + envío + total</small>
                    </button>
                    {addableBlocks.map((option) => (
                      <button
                        className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold hover:bg-white/5"
                        key={option.type}
                        onClick={() => addBlock(option.type)}
                        type="button"
                      >
                        <span>{option.label}</span>
                        <small className="text-[10px] font-medium text-zinc-500">{option.hint}</small>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <BlockPropertyPanel block={selectedBlock} onUpdate={(patch) => updateBlock(selectedBlockId!, patch)} />
          </aside>

          <button className="btn lg:col-span-2" disabled={saving} type="submit">
            {saving ? "Guardando…" : "Guardar configuración"}
          </button>
        </form>
      )}

      <section className="card mt-6 p-5">
        <h2 className="text-xl font-black">Pedidos sin comprobante</h2>
        <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
          {orders.map((order) => (
            <article className="min-w-64 rounded-2xl bg-white/[.04] p-4" key={order.id}>
              <strong>{order.reference}</strong>
              <p className="mt-1 text-sm text-zinc-500">{order.customerName}</p>
              <p className="mt-2 font-black">
                {new Intl.NumberFormat("es-AR", { style: "currency", currency: order.currency }).format(
                  Number(order.total),
                )}
              </p>
              <button className="btn mt-4 w-full py-2" onClick={() => void createInvoice(order.id)}>
                Crear comprobante
              </button>
            </article>
          ))}
          {!orders.length && (
            <p className="text-zinc-500">Todos los pedidos visibles ya tienen comprobante.</p>
          )}
        </div>
      </section>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {invoices.map((invoice) => (
          <article className="card p-5" key={invoice.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <strong className="text-lg">{invoice.number}</strong>
                <p className="text-sm text-zinc-500">
                  Pedido {invoice.order.reference} · {invoice.customerName}
                </p>
              </div>
              <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-black uppercase">
                {invoice.status}
              </span>
            </div>
            <p className="mt-4 text-2xl font-black">
              {new Intl.NumberFormat("es-AR", { style: "currency", currency: invoice.currency }).format(
                Number(invoice.total),
              )}
            </p>
            <div className="mt-5 flex gap-2">
              <button className="btn btn-secondary" onClick={() => void editInvoice(invoice)}>
                Editar estado
              </button>
              <Link className="btn" href={adminHrefFromPathname(pathname, `/admin/facturacion/${invoice.id}`)}>
                Ver e imprimir
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

/** @summary Panel de propiedades del elemento seleccionado en el diseñador. */
function BlockPropertyPanel({
  block,
  onUpdate,
}: {
  block: InvoiceBlock | null;
  onUpdate: (patch: Partial<InvoiceBlock>) => void;
}) {
  if (!block) {
    return (
      <div className="rounded-2xl border border-dashed border-white/15 p-4 text-center text-sm text-zinc-500">
        Seleccioná un elemento del comprobante para editar sus propiedades.
      </div>
    );
  }

  const alignButtons: Array<{ value: InvoiceAlign; label: string }> = [
    { value: "left", label: "Izq." },
    { value: "center", label: "Centro" },
    { value: "right", label: "Der." },
  ];

  return (
    <section className="space-y-4 rounded-2xl border border-pink-500/20 bg-pink-500/[.04] p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-black uppercase tracking-widest text-pink-300">
          {invoiceBlockLabels[block.type]}
        </h3>
        <button
          className="rounded-lg bg-red-500/10 px-2 py-1 text-xs font-bold text-red-300"
          onClick={() => {
            if (block.type === "title" || block.type === "customText" || block.type === "footer") {
              onUpdate({ text: "" });
            }
          }}
          type="button"
          title="Vaciar texto"
        >
          Vaciar texto
        </button>
      </div>

      {editableTextTypes.includes(block.type) && block.type !== "number" && (
        <label className="block text-sm font-bold">
          Texto
          <textarea
            className="input mt-1 min-h-16"
            maxLength={600}
            value={block.text ?? ""}
            onChange={(event) => onUpdate({ text: event.target.value })}
            placeholder="Escribí el texto de este elemento…"
          />
          {block.type === "customText" && (
            <small className="mt-1 block text-xs text-zinc-500">
              Campos dinámicos como {"{{cliente.nombre}}"} o {"{{pedido.total}}"} se completan al imprimir.
            </small>
          )}
        </label>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm font-bold">
          Tamaño
          <input
            className="input mt-1"
            type="number"
            min={6}
            max={48}
            value={block.fontSize ?? 12}
            onChange={(event) => onUpdate({ fontSize: Number(event.target.value) || 12 })}
          />
        </label>
        <label className="flex items-end gap-2 pb-1 text-sm font-bold">
          <input
            type="checkbox"
            className="h-5 w-5 accent-pink-500"
            checked={block.bold !== false}
            onChange={(event) => onUpdate({ bold: event.target.checked })}
          />
          Negrita
        </label>
      </div>

      <div>
        <span className="text-sm font-bold">Alineación</span>
        <div className="mt-1 flex rounded-xl bg-white/5 p-1">
          {alignButtons.map((option) => (
            <button
              className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-bold ${
                block.align === option.value ? "bg-pink-500" : "text-zinc-400 hover:text-white"
              }`}
              key={option.value}
              onClick={() => onUpdate({ align: option.value })}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm font-bold">
          Color del texto
          <span className="mt-1 flex items-center gap-2 rounded-xl border border-white/10 p-2">
            <input
              className="h-7 w-10 cursor-pointer rounded-lg border-0 bg-transparent"
              type="color"
              value={block.color ?? "#111111"}
              onChange={(event) => onUpdate({ color: event.target.value })}
              aria-label="Color del texto"
            />
            <button
              className="text-[10px] font-bold text-zinc-500 hover:text-white"
              onClick={() => onUpdate({ color: null })}
              type="button"
            >
              Auto
            </button>
          </span>
        </label>
        <label className="text-sm font-bold">
          Fondo
          <span className="mt-1 flex items-center gap-2 rounded-xl border border-white/10 p-2">
            <input
              className="h-7 w-10 cursor-pointer rounded-lg border-0 bg-transparent"
              type="color"
              value={block.background ?? "#ffffff"}
              onChange={(event) => onUpdate({ background: event.target.value })}
              aria-label="Color de fondo"
            />
            <button
              className="text-[10px] font-bold text-zinc-500 hover:text-white"
              onClick={() => onUpdate({ background: null })}
              type="button"
            >
              Sin
            </button>
          </span>
        </label>
      </div>

      <div>
        <span className="text-sm font-bold">Ancho</span>
        <div className="mt-1 flex rounded-xl bg-white/5 p-1">
          <button
            className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-bold ${block.columns !== "half" ? "bg-pink-500" : "text-zinc-400 hover:text-white"}`}
            onClick={() => onUpdate({ columns: "single" })}
            type="button"
          >
            Completo
          </button>
          <button
            className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-bold ${block.columns === "half" ? "bg-pink-500" : "text-zinc-400 hover:text-white"}`}
            onClick={() => onUpdate({ columns: "half" })}
            type="button"
          >
            Media columna
          </button>
        </div>
        <small className="mt-1 block text-xs text-zinc-500">
          Dos elementos en «media columna» consecutivos comparten la misma fila.
        </small>
      </div>

      {block.type === "table" && (
        <>
          <div>
            <span className="text-sm font-bold">Columnas de la tabla</span>
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              {(
                [
                  ["product", "Producto"],
                  ["quantity", "Cantidad"],
                  ["unitPrice", "Precio unitario"],
                  ["total", "Total"],
                  ["variant", "Variante"],
                  ["extras", "Extras"],
                ] as const
              ).map(([field, label]) => (
                <label
                  className="flex items-center justify-between gap-2 rounded-lg border border-white/10 px-2 py-1.5 text-xs"
                  key={field}
                >
                  <span className="font-bold">{label}</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-pink-500"
                    checked={block.tableColumns?.[field] ?? false}
                    onChange={(event) =>
                      onUpdate({
                        tableColumns: { ...block.tableColumns!, [field]: event.target.checked },
                      })
                    }
                  />
                </label>
              ))}
            </div>
          </div>
          <label className="block text-sm font-bold">
            Densidad
            <select
              className="input mt-1"
              value={block.tableStyle ?? "normal"}
              onChange={(event) => onUpdate({ tableStyle: event.target.value as InvoiceTableStyle })}
            >
              {(["compact", "normal", "wide"] as const).map((style) => (
                <option value={style} key={style}>
                  {invoiceTableStyleLabels[style]}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
    </section>
  );
}