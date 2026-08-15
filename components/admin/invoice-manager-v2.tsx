"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import Swal from "sweetalert2";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { scopedFetch } from "@/lib/client-routing";
import { documentTypeLabels, documentTypes, type DocumentType } from "@/lib/documents/document-fields";
import { adminHrefFromPathname } from "@/lib/routes";

type InvoiceDocumentSummary = {
  pdfStatus: string;
  conversionMessage: string | null;
  templateVersion: number | null;
} | null;

export type InvoiceListItem = {
  id: number;
  status: string;
  documentType: string;
  number: string | null;
  total: string | number;
  currency: string;
  customerName: string;
  customerTaxId: string | null;
  notes: string | null;
  createdAt: string;
  branch: { name: string } | null;
  order: { reference: string };
  document: InvoiceDocumentSummary;
};

export type AvailableInvoiceOrder = {
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
};

function money(value: string | number, currency: string) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency }).format(Number(value));
}

function documentStatus(document: InvoiceDocumentSummary) {
  if (!document) return { label: "Legacy HTML", className: "text-zinc-400 bg-white/5" };
  if (document.pdfStatus === "ready") return { label: "PDF + DOCX", className: "text-emerald-200 bg-emerald-500/10" };
  return { label: "DOCX disponible", className: "text-amber-200 bg-amber-500/10" };
}

/** @summary Gestiona comprobantes y delega el diseño libre a las plantillas Word del tenant. */
export function InvoiceManagerV2({
  initialInvoices,
  availableOrders,
  initialSettings,
}: {
  initialInvoices: InvoiceListItem[];
  availableOrders: AvailableInvoiceOrder[];
  initialSettings: InvoiceSettingsData | null;
}) {
  const pathname = usePathname();
  const [invoices, setInvoices] = useState(initialInvoices);
  const [orders, setOrders] = useState(availableOrders);
  const [settings, setSettings] = useState<InvoiceSettingsData | null>(initialSettings);
  const [savingSettings, setSavingSettings] = useState(false);
  const [documentType, setDocumentType] = useState<DocumentType>("internal_receipt");
  const [busyOrder, setBusyOrder] = useState<number | null>(null);
  const [busyDocument, setBusyDocument] = useState<number | null>(null);

  async function generateDocument(invoice: InvoiceListItem) {
    setBusyDocument(invoice.id);
    const response = await scopedFetch(`/api/admin/invoices/${invoice.id}/document`, { method: "POST" });
    const body = (await response.json().catch(() => ({}))) as {
      document?: InvoiceDocumentSummary;
      error?: string;
    };
    setBusyDocument(null);
    if (!response.ok || !body.document) {
      await Swal.fire({
        title: "No se pudo generar el documento",
        text: body.error ?? "Intentá nuevamente.",
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
      return;
    }
    setInvoices((current) => current.map((item) => (item.id === invoice.id ? { ...item, document: body.document! } : item)));
    await Swal.fire({
      title: "Documento generado",
      text: body.document.pdfStatus === "ready" ? "El DOCX y el PDF quedaron listos." : "El DOCX quedó disponible; el PDF depende del conversor configurado.",
      icon: "success",
      timer: 1500,
      showConfirmButton: false,
      background: "#18181b",
      color: "#fafafa",
    });
  }

  async function saveIssuerSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingSettings) return;
    setSavingSettings(true);
    const form = new FormData(event.currentTarget);
    const payload = {
      issuerName: String(form.get("issuerName") ?? "").trim() || null,
      taxId: String(form.get("taxId") ?? "").trim() || null,
      address: String(form.get("address") ?? "").trim() || null,
      city: String(form.get("city") ?? "").trim() || null,
      terms: String(form.get("terms") ?? "").trim() || null,
    };
    try {
      const response = await scopedFetch("/api/admin/invoice-settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => ({}))) as { settings?: InvoiceSettingsData; error?: string };
      if (!response.ok || !body.settings) throw new Error(body.error ?? "No se pudo guardar la configuración");
      setSettings(body.settings);
      await Swal.fire({
        title: "Emisor guardado",
        text: "Los próximos comprobantes usarán estos datos en las plantillas Word.",
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
      setSavingSettings(false);
    }
  }

  async function createInvoice(orderId: number) {
    setBusyOrder(orderId);
    const response = await scopedFetch("/api/admin/invoices", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orderId, documentType }),
    });
    const body = (await response.json().catch(() => ({}))) as {
      invoice?: InvoiceListItem;
      documentError?: string | null;
      error?: string;
    };
    setBusyOrder(null);
    if (!response.ok || !body.invoice) {
      await Swal.fire({ title: "No se pudo crear el comprobante", text: body.error, icon: "error" });
      return;
    }
    setInvoices((current) => [body.invoice!, ...current]);
    setOrders((current) => current.filter((order) => order.id !== orderId));
    await Swal.fire({
      title: "Comprobante creado",
      text: body.documentError
        ? `El registro se creó, pero el DOCX no pudo generarse: ${body.documentError}`
        : body.invoice.document?.pdfStatus === "ready"
          ? "El DOCX y el PDF quedaron guardados con esta versión de plantilla."
          : body.invoice.document?.conversionMessage || "El DOCX quedó disponible para descargar.",
      icon: body.documentError ? "warning" : "success",
      background: "#18181b",
      color: "#fafafa",
    });
  }

  async function editInvoice(invoice: InvoiceListItem) {
    const result = await Swal.fire({
      title: "Editar registro interno",
      text: "En Borrador el DOCX/PDF se regenera con los datos corregidos. Una vez emitido o anulado queda congelado en su versión histórica.",
      html: `<label style="display:block;text-align:left">Estado<select id="invoice-status" class="swal2-select" style="display:block;width:100%;margin:.5rem 0"><option value="draft" ${invoice.status === "draft" ? "selected" : ""}>Borrador</option><option value="issued" ${invoice.status === "issued" ? "selected" : ""}>Emitido internamente</option><option value="cancelled" ${invoice.status === "cancelled" ? "selected" : ""}>Anulado</option></select></label><input id="invoice-tax" class="swal2-input" maxlength="40" placeholder="CUIT/DNI opcional"><textarea id="invoice-notes" class="swal2-textarea" maxlength="1000" placeholder="Notas internas"></textarea>`,
      didOpen: () => {
        (document.querySelector("#invoice-tax") as HTMLInputElement).value = invoice.customerTaxId ?? "";
        (document.querySelector("#invoice-notes") as HTMLTextAreaElement).value = invoice.notes ?? "";
      },
      preConfirm: () => ({
        status: (document.querySelector("#invoice-status") as HTMLSelectElement).value,
        customerTaxId: (document.querySelector("#invoice-tax") as HTMLInputElement).value,
        notes: (document.querySelector("#invoice-notes") as HTMLTextAreaElement).value,
      }),
      showCancelButton: true,
      confirmButtonText: "Guardar",
      cancelButtonText: "Cancelar",
      background: "#18181b",
      color: "#fafafa",
    });
    if (!result.isConfirmed || !result.value) return;
    const response = await scopedFetch(`/api/admin/invoices/${invoice.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(result.value),
    });
    const body = (await response.json().catch(() => ({}))) as { invoice?: InvoiceListItem; document?: InvoiceDocumentSummary; error?: string };
    if (!response.ok || !body.invoice) {
      await Swal.fire({
        title: "No se pudo actualizar",
        text: body.error ?? "Intentá nuevamente.",
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
      return;
    }
    setInvoices((current) => current.map((item) => item.id === invoice.id ? { ...item, ...body.invoice!, document: body.document ?? item.document } : item));
    await Swal.fire({
      title: "Registro actualizado",
      text: body.document ? "El DOCX/PDF se regeneró con los datos corregidos." : "Los documentos emitidos conservan su versión histórica.",
      icon: "success",
      timer: 1600,
      showConfirmButton: false,
      background: "#18181b",
      color: "#fafafa",
    });
  }

  return (
    <section className="min-w-0">
      <AdminPageHeader
        eyebrow="Operación documental"
        title="Comprobantes internos"
        description="Generá documentos trazables desde pedidos y conservá el DOCX/PDF exacto de cada emisión."
        section="facturacion"
        actions={
          <Link className="btn" href={adminHrefFromPathname(pathname, "/admin/configuracion/comprobantes/plantillas")}>
            Configurar plantillas Word
          </Link>
        }
      />

      <div className="mb-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
        Estos documentos son internos. Los tipos Factura A/B son diseños visuales y no representan emisión fiscal, CAE ni integración con un proveedor autorizado.
      </div>

      <section className="card mb-6 min-w-0 p-5 sm:p-7">
        <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-black">Emisor del comprobante</h2>
            <p className="mt-1 text-sm text-[var(--admin-muted)]">Estos datos completan los campos business.* de las plantillas Word (nombre, CUIT, domicilio y teléfono).</p>
          </div>
          <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-black uppercase">Configuración</span>
        </div>
        <form className="mt-5 grid min-w-0 gap-4 sm:grid-cols-2" onSubmit={saveIssuerSettings}>
          <label className="text-sm font-bold">Nombre del negocio<input className="input mt-2" name="issuerName" maxLength={180} defaultValue={settings?.issuerName ?? ""} placeholder="Nombre que se estampa en el comprobante" /></label>
          <label className="text-sm font-bold">CUIT / documento<input className="input mt-2" name="taxId" maxLength={40} defaultValue={settings?.taxId ?? ""} placeholder="Ej. 30-12345678-9" /></label>
          <label className="text-sm font-bold">Domicilio<input className="input mt-2" name="address" maxLength={300} defaultValue={settings?.address ?? ""} placeholder="Calle y número" /></label>
          <label className="text-sm font-bold">Localidad<input className="input mt-2" name="city" maxLength={120} defaultValue={settings?.city ?? ""} placeholder="Ciudad" /></label>
          <label className="text-sm font-bold sm:col-span-2">Condiciones o pie de comprobante<textarea className="input mt-2 min-h-24" name="terms" maxLength={3000} defaultValue={settings?.terms ?? ""} placeholder="Ej. Gracias por tu compra. Este documento es interno y no fiscal." /></label>
          <div className="flex min-w-0 flex-wrap items-center gap-3 sm:col-span-2">
            <button className="btn" disabled={savingSettings} type="submit">{savingSettings ? "Guardando…" : "Guardar emisor"}</button>
            {!settings?.issuerName && !settings?.taxId && !settings?.address && !settings?.city && <p className="text-xs text-[var(--admin-muted)]">Sin datos cargados: se usa el nombre del negocio y el monograma por defecto.</p>}
          </div>
        </form>
      </section>

      <section className="card min-w-0 p-5 sm:p-7">
        <div className="flex min-w-0 flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-black">Pedidos sin comprobante</h2>
            <p className="mt-1 text-sm text-[var(--admin-muted)]">La plantilla activa se completa con los datos y queda congelada en el historial.</p>
          </div>
          <label className="w-full text-sm font-bold sm:w-auto sm:min-w-72">
            Tipo visual/documental
            <select className="input mt-2" value={documentType} onChange={(event) => setDocumentType(event.target.value as DocumentType)}>
              {documentTypes.map((type) => <option value={type} key={type}>{documentTypeLabels[type]}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-5 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {orders.map((order) => (
            <article className="min-w-0 rounded-2xl border border-white/10 bg-white/[.03] p-4" key={order.id}>
              <strong className="break-words">{order.reference}</strong>
              <p className="mt-1 break-words text-sm text-[var(--admin-muted)]">{order.customerName}</p>
              <p className="mt-3 text-xl font-black">{money(order.total, order.currency)}</p>
              <button className="btn mt-4 w-full" disabled={busyOrder === order.id} onClick={() => void createInvoice(order.id)} type="button">
                {busyOrder === order.id ? "Generando…" : "Crear comprobante"}
              </button>
            </article>
          ))}
          {!orders.length && <p className="rounded-2xl border border-dashed border-white/15 p-5 text-sm text-[var(--admin-muted)] sm:col-span-2 xl:col-span-3">Todos los pedidos visibles ya tienen comprobante.</p>}
        </div>
      </section>

      <section className="mt-6 grid min-w-0 gap-4 lg:grid-cols-2">
        {invoices.map((invoice) => {
          const fileStatus = documentStatus(invoice.document);
          const type = documentTypes.includes(invoice.documentType as DocumentType) ? invoice.documentType as DocumentType : "internal_receipt";
          return (
            <article className="card min-w-0 p-5" key={invoice.id}>
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <strong className="block break-words text-lg">{invoice.number}</strong>
                  <p className="mt-1 break-words text-sm text-[var(--admin-muted)]">Pedido {invoice.order.reference} · {invoice.customerName}</p>
                  <p className="mt-1 text-xs text-[var(--admin-muted)]">{documentTypeLabels[type]}{invoice.branch ? ` · ${invoice.branch.name}` : ""}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-black uppercase">{invoice.status}</span>
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${fileStatus.className}`}>{fileStatus.label}</span>
                </div>
              </div>
              <p className="mt-4 text-2xl font-black">{money(invoice.total, invoice.currency)}</p>
              {invoice.document?.conversionMessage && invoice.document.pdfStatus !== "ready" && <p className="mt-3 rounded-xl bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-200">{invoice.document.conversionMessage}</p>}
              <div className="mt-5 flex flex-wrap gap-2">
                <button className="btn btn-secondary" onClick={() => void editInvoice(invoice)} type="button">Editar registro</button>
                {!invoice.document && (
                  <button className="btn btn-secondary" disabled={busyDocument === invoice.id} onClick={() => void generateDocument(invoice)} type="button">
                    {busyDocument === invoice.id ? "Generando…" : "Generar documento"}
                  </button>
                )}
                <Link className="btn" href={adminHrefFromPathname(pathname, `/admin/facturacion/${invoice.id}`)}>Abrir documento</Link>
              </div>
            </article>
          );
        })}
      </section>
    </section>
  );
}
