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
}: {
  initialInvoices: InvoiceListItem[];
  availableOrders: AvailableInvoiceOrder[];
}) {
  const pathname = usePathname();
  const [invoices, setInvoices] = useState(initialInvoices);
  const [orders, setOrders] = useState(availableOrders);
  const [documentType, setDocumentType] = useState<DocumentType>("internal_receipt");
  const [busyOrder, setBusyOrder] = useState<number | null>(null);

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
      text: "El DOCX/PDF histórico no se modifica; conserva los datos con los que fue generado.",
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
    const body = (await response.json().catch(() => ({}))) as { invoice?: InvoiceListItem };
    if (response.ok && body.invoice) {
      setInvoices((current) => current.map((item) => item.id === invoice.id ? { ...item, ...body.invoice!, document: item.document } : item));
    }
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
                <Link className="btn" href={adminHrefFromPathname(pathname, `/admin/facturacion/${invoice.id}`)}>Abrir documento</Link>
              </div>
            </article>
          );
        })}
      </section>
    </section>
  );
}
