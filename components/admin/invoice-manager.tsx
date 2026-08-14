"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import Swal from "sweetalert2";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { scopedFetch } from "@/lib/client-routing";
import {
  defaultInvoiceDesign,
  invoiceFontClass,
  invoicePresetDefaults,
  invoicePresetLabels,
  resolveInvoiceDesign,
  type InvoiceDesign,
  type InvoicePreset,
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

const presetSwatches: Record<InvoicePreset, string[]> = {
  compact: ["#18181b", "#fafafa", "#d4d4d8"],
  classic: ["#7f1d1d", "#f5efe6", "#1c1917"],
  modern: ["#0d9488", "#f0fdfa", "#134e4a"],
};

/** @summary Gestiona comprobantes internos, los datos del emisor y el diseño imprimible. */
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

  /** @summary Guarda los datos del emisor y el diseño que se estampan en cada comprobante. */
  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      issuerName: String(form.get("issuerName") ?? "").trim() || null,
      taxId: String(form.get("taxId") ?? "").trim() || null,
      address: String(form.get("address") ?? "").trim() || null,
      city: String(form.get("city") ?? "").trim() || null,
      terms: String(form.get("terms") ?? "").trim() || null,
      design,
    };
    const response = await scopedFetch("/api/admin/invoice-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await response.json().catch(() => ({}))) as { settings?: InvoiceSettingsData; error?: string };
    if (!response.ok || !body.settings) {
      await Swal.fire({
        title: "No se pudo guardar",
        text: body.error ?? "Intentá nuevamente.",
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
      return;
    }
    setSettings(body.settings);
    setDesign(resolveInvoiceDesign(body.settings.design));
    await Swal.fire({
      title: "Configuración guardada",
      icon: "success",
      timer: 1400,
      showConfirmButton: false,
      background: "#18181b",
      color: "#fafafa",
    });
  }

  function applyPreset(preset: InvoicePreset) {
    setDesign((current) => ({ ...defaultInvoiceDesign, ...invoicePresetDefaults[preset], ...current, preset }));
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
        <form className="card mt-6 grid gap-6 p-5 lg:grid-cols-[1fr_minmax(280px,380px)]" onSubmit={saveSettings}>
          <div className="space-y-6">
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
              <h2 className="text-xl font-black">Diseño del comprobante</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Elegí un preset y ajustá los elementos que se muestran al imprimir.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {(["compact", "classic", "modern"] as const).map((preset) => (
                  <button
                    className={`rounded-2xl border p-4 text-left transition ${
                      design.preset === preset
                        ? "border-pink-500/60 bg-pink-500/10"
                        : "border-white/10 bg-white/[.03] hover:border-white/25"
                    }`}
                    key={preset}
                    onClick={() => applyPreset(preset)}
                    type="button"
                  >
                    <div className="flex gap-1.5">
                      {presetSwatches[preset].map((color) => (
                        <span className="h-4 w-4 rounded-full" style={{ backgroundColor: color }} key={color} />
                      ))}
                    </div>
                    <strong className="mt-3 block">{invoicePresetLabels[preset]}</strong>
                    <p className="mt-1 text-xs text-zinc-500">
                      {preset === "compact"
                        ? "Sobrio y minimalista, sin adornos."
                        : preset === "classic"
                          ? "Tradicional, con serifas y QR."
                          : "Contemporáneo con color de acento."}
                    </p>
                  </button>
                ))}
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
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
                      setDesign((current) => ({ ...current, font: event.target.value as InvoiceDesign["font"] }))
                    }
                  >
                    <option value="sans">Moderna (sans-serif)</option>
                    <option value="serif">Clásica (serif)</option>
                    <option value="mono">Técnica (monospace)</option>
                  </select>
                </label>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {(
                  [
                    ["showLogo", "Logo / monograma"],
                    ["showIssuerAddress", "Domicilio del emisor"],
                    ["showTaxId", "CUIT / documento"],
                    ["showQr", "Código QR"],
                    ["showColumns", "Tabla con columnas"],
                    ["showSubtotal", "Fila de subtotal"],
                    ["showDiscounts", "Fila de descuentos"],
                    ["showDelivery", "Fila de envío"],
                    ["showTotal", "Fila de total"],
                    ["showNotes", "Observaciones"],
                    ["showFooter", "Pie de comprobante"],
                  ] as const
                ).map(([field, label]) => (
                  <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 px-3 py-2 text-sm" key={field}>
                    <span className="font-bold">{label}</span>
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-pink-500"
                      checked={design[field]}
                      onChange={(event) =>
                        setDesign((current) => ({ ...current, [field]: event.target.checked }))
                      }
                    />
                  </label>
                ))}
              </div>
              <label className="mt-4 block text-sm font-bold">
                Pie de comprobante personalizado
                <textarea
                  className="input mt-2 min-h-20"
                  maxLength={600}
                  value={design.footerText}
                  onChange={(event) =>
                    setDesign((current) => ({ ...current, footerText: event.target.value }))
                  }
                  placeholder="Se usa en lugar de las condiciones generales cuando está definido."
                />
              </label>
            </section>
          </div>

          <InvoicePreview design={design} issuerName={settings?.issuerName ?? ""} taxId={settings?.taxId ?? ""} address={settings?.address ?? ""} city={settings?.city ?? ""} />

          <button className="btn lg:col-span-2">Guardar configuración</button>
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

/** @summary Miniatura en vivo del comprobante aplicando el diseño elegido. */
function InvoicePreview({
  design,
  issuerName,
  taxId,
  address,
  city,
}: {
  design: InvoiceDesign;
  issuerName: string;
  taxId: string;
  address: string;
  city: string;
}) {
  const addressLine = [address, city].filter(Boolean).join(", ");
  return (
    <aside className="rounded-2xl border border-white/10 bg-white p-5 text-zinc-950">
      <p className="text-xs font-black uppercase tracking-widest text-zinc-500">Vista previa</p>
      <div className={`mt-3 ${invoiceFontClass[design.font]}`}>
        <div
          className={`flex items-start justify-between gap-3 border-b pb-3 ${design.preset === "compact" ? "border-zinc-200" : design.preset === "modern" ? "border-transparent bg-teal-700 p-3 text-white" : "border-zinc-200"}`}
        >
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: design.preset === "modern" ? "#ffffff" : design.accent }}>
              Comprobante interno
            </p>
            <strong className="mt-1 block text-sm">A-0000-0000</strong>
          </div>
          {design.showLogo && (
            <span
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-black text-white"
              style={{ backgroundColor: design.accent }}
            >
              {(issuerName || "LM").slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>
        {design.preset === "modern" && (
          <div className="h-1.5" style={{ backgroundColor: design.accent }} />
        )}
        <div className="flex items-start justify-between gap-3 py-3">
          <div>
            <strong className="block text-sm">{issuerName || "Nombre del negocio"}</strong>
            {design.showIssuerAddress && addressLine && (
              <p className="text-[11px] text-zinc-500">{addressLine}</p>
            )}
            {design.showTaxId && taxId && <p className="text-[11px] text-zinc-500">CUIT {taxId}</p>}
          </div>
          {design.showQr && (
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded bg-zinc-100 text-[8px] text-zinc-500">
              QR
            </span>
          )}
        </div>
        <table className="w-full text-[11px]">
          <thead>
            <tr style={{ backgroundColor: design.preset === "modern" ? design.accent : "#f4f4f5" }}>
              <th className="py-1 pl-2 text-left">Producto</th>
              <th className="px-1 text-center">Cant.</th>
              <th className="py-1 pr-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-zinc-100">
              <td className="py-1.5 pl-2">Hamburguesa clásica</td>
              <td className="px-1 text-center">2</td>
              <td className="py-1.5 pr-2 text-right">$16.000</td>
            </tr>
            <tr className="border-b border-zinc-100">
              <td className="py-1.5 pl-2">Limonada</td>
              <td className="px-1 text-center">1</td>
              <td className="py-1.5 pr-2 text-right">$4.000</td>
            </tr>
          </tbody>
        </table>
        <div className="ml-auto mt-2 max-w-40 space-y-0.5 text-[11px]">
          {design.showSubtotal && (
            <p className="flex justify-between"><span>Subtotal</span><strong>$20.000</strong></p>
          )}
          {design.showDiscounts && (
            <p className="flex justify-between text-zinc-500"><span>Descuento</span><span>-$1.000</span></p>
          )}
          {design.showDelivery && (
            <p className="flex justify-between text-zinc-500"><span>Envío</span><span>$1.500</span></p>
          )}
          {design.showTotal && (
            <p className="flex justify-between text-sm font-black" style={{ color: design.accent }}>
              <span>Total</span><strong>$20.500</strong>
            </p>
          )}
        </div>
        {design.showFooter && (
          <p className="mt-3 border-t border-zinc-200 pt-2 text-[10px] text-zinc-500">
            {design.footerText || "Documento operativo. No válido como comprobante fiscal."}
          </p>
        )}
      </div>
    </aside>
  );
}