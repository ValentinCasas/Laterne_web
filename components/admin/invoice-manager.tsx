"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import Swal from "sweetalert2";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { scopedFetch } from "@/lib/client-routing";
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
};

/** @summary Gestiona comprobantes internos y aclara el límite entre registro operativo y facturación fiscal. */
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

  /** @summary Guarda los datos del emisor que se estampan en cada comprobante. */
  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      issuerName: String(form.get("issuerName") ?? "").trim() || null,
      taxId: String(form.get("taxId") ?? "").trim() || null,
      address: String(form.get("address") ?? "").trim() || null,
      city: String(form.get("city") ?? "").trim() || null,
      terms: String(form.get("terms") ?? "").trim() || null,
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
    await Swal.fire({
      title: "Configuración guardada",
      icon: "success",
      timer: 1400,
      showConfirmButton: false,
      background: "#18181b",
      color: "#fafafa",
    });
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
        <form
          className="card mt-6 grid gap-4 p-5 sm:grid-cols-2"
          onSubmit={saveSettings}
        >
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
          <button className="btn sm:col-span-2">Guardar configuración</button>
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
