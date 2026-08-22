"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useMemo } from "react";
import Swal from "sweetalert2";
import { Icon } from "@/components/admin/ui/icons";
import { apiPath, scopedFetch } from "@/lib/client-routing";
import { documentTypeLabels, documentTypes, type DocumentType } from "@/lib/documents/document-fields";
import { adminHrefFromPathname } from "@/lib/routes";
import { Drawer, Pagination } from "@/components/admin/ui";

type InvoiceDocumentSummary = { pdfStatus: string; conversionMessage: string | null; templateVersion: number | null } | null;

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

export type AvailableInvoiceOrder = { id: number; reference: string; customerName: string; total: string | number; currency: string; createdAt: string };
export type InvoiceSettingsData = { issuerName: string | null; taxId: string | null; address: string | null; city: string | null; terms: string | null };

function fmt(value: string | number, currency: string) { return new Intl.NumberFormat("es-AR", { style: "currency", currency }).format(Number(value)); }
function docStatus(d: InvoiceDocumentSummary) {
  if (!d) return { label: "Legacy", color: "var(--admin-muted)", bg: "color-mix(in srgb, var(--admin-muted) 10%, transparent)" };
  if (d.pdfStatus === "ready") return { label: "PDF + DOCX", color: "var(--admin-success)", bg: "color-mix(in srgb, var(--admin-success) 12%, transparent)" };
  return { label: "DOCX", color: "var(--admin-warning)", bg: "color-mix(in srgb, var(--admin-warning) 12%, transparent)" };
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: "Borrador", color: "var(--admin-muted)", bg: "color-mix(in srgb, var(--admin-muted) 12%, transparent)" },
  issued: { label: "Emitido", color: "var(--admin-success)", bg: "color-mix(in srgb, var(--admin-success) 12%, transparent)" },
  cancelled: { label: "Anulado", color: "var(--admin-danger)", bg: "color-mix(in srgb, var(--admin-danger) 12%, transparent)" },
};

/**
 * @summary Gestor de comprobantes internos de facturacion de ventas — vista estilo ERP moderno.
 * Tabla principal, KPIs, toolbar, configuracion en modal, pedidos pendientes como tabla compacta.
 */
export function InvoiceManagerV2({ initialInvoices, availableOrders, initialSettings }: { initialInvoices: InvoiceListItem[]; availableOrders: AvailableInvoiceOrder[]; initialSettings: InvoiceSettingsData | null }) {
  const pathname = usePathname();
  const href = (path: string) => adminHrefFromPathname(pathname, path);

  const [invoices, setInvoices] = useState(initialInvoices);
  const [orders, setOrders] = useState(availableOrders);
  const [settings, setSettings] = useState<InvoiceSettingsData | null>(initialSettings);
  const [savingSettings, setSavingSettings] = useState(false);
  const [documentType, setDocumentType] = useState<DocumentType>("internal_receipt");
  const [busyOrder, setBusyOrder] = useState<number | null>(null);
  const [busyDocument, setBusyDocument] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showConfig, setShowConfig] = useState(false);
  const [showPending, setShowPending] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<25 | 50 | 100>(25);

  const draftCount = invoices.filter((i) => i.status === "draft").length;
  const issuedCount = invoices.filter((i) => i.status === "issued").length;
  const cancelledCount = invoices.filter((i) => i.status === "cancelled").length;

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("es");
    return invoices.filter((inv) => {
      if (statusFilter && inv.status !== statusFilter) return false;
      if (q && !inv.number?.toLocaleLowerCase("es").includes(q) && !inv.customerName.toLocaleLowerCase("es").includes(q) && !inv.order.reference.toLocaleLowerCase("es").includes(q)) return false;
      return true;
    });
  }, [invoices, query, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedInvoices = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  async function generateDocument(invoice: InvoiceListItem) {
    setBusyDocument(invoice.id);
    const r = await scopedFetch(`/api/admin/invoices/${invoice.id}/document`, { method: "POST" });
    const body = (await r.json().catch(() => ({}))) as { document?: InvoiceDocumentSummary; error?: string };
    setBusyDocument(null);
    if (!r.ok || !body.document) { await Swal.fire({ title: "Error", text: body.error ?? "Intenta nuevamente.", icon: "error", background: "#18181b", color: "#fafafa" }); return; }
    setInvoices((c) => c.map((i) => i.id === invoice.id ? { ...i, document: body.document! } : i));
    await Swal.fire({ title: "Documento generado", text: body.document.pdfStatus === "ready" ? "DOCX y PDF listos." : "DOCX disponible.", icon: "success", timer: 1500, showConfirmButton: false, background: "#18181b", color: "#fafafa" });
  }

  async function saveIssuerSettings(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (savingSettings) return; setSavingSettings(true);
    const form = new FormData(e.currentTarget);
    const payload = { issuerName: String(form.get("issuerName") ?? "").trim() || null, taxId: String(form.get("taxId") ?? "").trim() || null, address: String(form.get("address") ?? "").trim() || null, city: String(form.get("city") ?? "").trim() || null, terms: String(form.get("terms") ?? "").trim() || null };
    try {
      const r = await scopedFetch("/api/admin/invoice-settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const body = (await r.json().catch(() => ({}))) as { settings?: InvoiceSettingsData; error?: string };
      if (!r.ok || !body.settings) throw new Error(body.error ?? "Error");
      setSettings(body.settings);
      await Swal.fire({ title: "Emisor guardado", icon: "success", timer: 1400, showConfirmButton: false, background: "#18181b", color: "#fafafa" });
      setShowConfig(false);
    } catch (err) { await Swal.fire({ title: "No se pudo guardar", text: err instanceof Error ? err.message : "Error", icon: "error", background: "#18181b", color: "#fafafa" }); }
    finally { setSavingSettings(false); }
  }

  async function createInvoice(orderId: number) {
    setBusyOrder(orderId);
    const r = await scopedFetch("/api/admin/invoices", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId, documentType }) });
    const body = (await r.json().catch(() => ({}))) as { invoice?: InvoiceListItem; documentError?: string | null; error?: string };
    setBusyOrder(null);
    if (!r.ok || !body.invoice) { await Swal.fire({ title: "Error", text: body.error, icon: "error", background: "#18181b", color: "#fafafa" }); return; }
    setInvoices((c) => [body.invoice!, ...c]);
    setOrders((c) => c.filter((o) => o.id !== orderId));
    await Swal.fire({ title: "Comprobante creado", icon: "success", timer: 1500, showConfirmButton: false, background: "#18181b", color: "#fafafa" });
  }

  async function editInvoice(invoice: InvoiceListItem) {
    const result = await Swal.fire({
      title: "Editar comprobante",
      html: `<label style="display:block;text-align:left;font-size:13px;margin-bottom:8px">Estado<select id="is" class="swal2-select" style="display:block;width:100%;margin-top:4px"><option value="draft" ${invoice.status === "draft" ? "selected" : ""}>Borrador</option><option value="issued" ${invoice.status === "issued" ? "selected" : ""}>Emitido</option><option value="cancelled" ${invoice.status === "cancelled" ? "selected" : ""}>Anulado</option></select></label><input id="it" class="swal2-input" maxlength="40" placeholder="CUIT/DNI"><textarea id="in" class="swal2-textarea" maxlength="1000" placeholder="Notas">`,
      didOpen: () => { (document.querySelector("#it") as HTMLInputElement).value = invoice.customerTaxId ?? ""; (document.querySelector("#in") as HTMLTextAreaElement).value = invoice.notes ?? ""; },
      preConfirm: () => ({ status: (document.querySelector("#is") as HTMLSelectElement).value, customerTaxId: (document.querySelector("#it") as HTMLInputElement).value, notes: (document.querySelector("#in") as HTMLTextAreaElement).value }),
      showCancelButton: true, confirmButtonText: "Guardar", cancelButtonText: "Cancelar", background: "#18181b", color: "#fafafa",
    });
    if (!result.isConfirmed || !result.value) return;
    const r = await scopedFetch(`/api/admin/invoices/${invoice.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(result.value) });
    const body = (await r.json().catch(() => ({}))) as { invoice?: InvoiceListItem; document?: InvoiceDocumentSummary; error?: string };
    if (!r.ok || !body.invoice) { await Swal.fire({ title: "Error", text: body.error, icon: "error", background: "#18181b", color: "#fafafa" }); return; }
    setInvoices((c) => c.map((i) => i.id === invoice.id ? { ...i, ...body.invoice!, document: body.document ?? i.document } : i));
    await Swal.fire({ title: "Actualizado", icon: "success", timer: 1400, showConfirmButton: false, background: "#18181b", color: "#fafafa" });
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--admin-background)" }}>
      {/* Header */}
      <div style={{ background: "var(--admin-surface)" }} className="relative">
        <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: "linear-gradient(90deg, var(--admin-primary-strong), var(--admin-primary), transparent)" }} />
        <div className="mx-auto max-w-[1600px] px-8 pt-6 pb-5">
          <nav className="mb-5 flex items-center gap-2 text-xs" style={{ color: "var(--admin-muted)" }}>
            <Link href={href("/admin")} className="transition-colors hover:opacity-70">Inicio</Link>
            <span className="opacity-40">/</span>
            <span className="font-medium" style={{ color: "var(--admin-text)" }}>Facturacion</span>
          </nav>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight leading-none" style={{ color: "var(--admin-text)" }}>Facturacion</h1>
              <p className="mt-2 text-sm" style={{ color: "var(--admin-muted)" }}>Comprobantes internos y gestion documental</p>
            </div>
            <button type="button" className="rounded-lg px-4 py-2 text-xs font-semibold transition-all hover:opacity-80" style={{ border: "1px solid var(--admin-border)", color: "var(--admin-muted)" }} onClick={() => setShowConfig(true)}>
              Configuracion del emisor
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="border-b" style={{ borderColor: "var(--admin-border)", background: "color-mix(in srgb, var(--admin-surface) 60%, var(--admin-background))" }}>
        <div className="mx-auto max-w-[1600px] flex flex-wrap items-center gap-3 px-8 py-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: "var(--admin-muted)" }} />
            <input className="input w-full py-2 pl-9 pr-3 text-sm rounded-lg" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por numero, cliente o pedido..." />
          </div>
          <select className="input py-2 px-3 text-xs rounded-lg" style={{ minWidth: "130px" }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <span className="ml-auto text-xs font-semibold" style={{ color: "var(--admin-muted)" }}>{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* KPIs */}
      <div className="mx-auto max-w-[1600px] px-8 pt-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Kpi label="Total" value={String(invoices.length)} />
          <Kpi label="Borradores" value={String(draftCount)} color={draftCount > 0 ? "var(--admin-warning)" : undefined} />
          <Kpi label="Emitidos" value={String(issuedCount)} color="var(--admin-success)" />
          <Kpi label="Anulados" value={String(cancelledCount)} />
        </div>
      </div>

      {/* Pending Orders Toggle */}
      {orders.length > 0 && (
        <div className="mx-auto max-w-[1600px] px-8 pt-4">
          <button type="button" className="flex items-center gap-2 text-xs font-bold transition-colors" style={{ color: "var(--admin-primary)" }} onClick={() => setShowPending(!showPending)}>
            <Icon name="arrow-down" className="text-[10px] transition-transform duration-200" style={{ transform: showPending ? "rotate(180deg)" : undefined }} />
            Pedidos sin comprobante ({orders.length})
          </button>
          {showPending && (
            <div className="mt-3 rounded-xl overflow-hidden" style={{ background: "var(--admin-surface)", border: "1px solid var(--admin-border)" }}>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--admin-border)", background: "color-mix(in srgb, var(--admin-surface-elevated) 50%, var(--admin-surface))" }} className="text-[10px] uppercase tracking-wider">
                      <th className="px-4 py-2.5 font-semibold" style={{ color: "var(--admin-muted)" }}>Pedido</th>
                      <th className="px-4 py-2.5 font-semibold" style={{ color: "var(--admin-muted)" }}>Cliente</th>
                      <th className="px-4 py-2.5 font-semibold" style={{ color: "var(--admin-muted)" }}>Fecha</th>
                      <th className="px-4 py-2.5 text-right font-semibold" style={{ color: "var(--admin-muted)" }}>Total</th>
                      <th className="px-4 py-2.5 font-semibold" style={{ color: "var(--admin-muted)" }}>Tipo</th>
                      <th className="px-4 py-2.5 w-28"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o, idx) => (
                      <tr key={o.id} style={{ borderBottom: "1px solid var(--admin-border)", background: idx % 2 === 1 ? "color-mix(in srgb, var(--admin-surface-elevated) 15%, var(--admin-surface))" : undefined }}>
                        <td className="px-4 py-2 font-semibold" style={{ color: "var(--admin-text)" }}>{o.reference}</td>
                        <td className="px-4 py-2" style={{ color: "var(--admin-muted)" }}>{o.customerName}</td>
                        <td className="px-4 py-2" style={{ color: "var(--admin-muted)" }}>{new Date(o.createdAt).toLocaleDateString("es-AR")}</td>
                        <td className="px-4 py-2 text-right font-bold tabular-nums" style={{ color: "var(--admin-text)" }}>{fmt(o.total, o.currency)}</td>
                        <td className="px-4 py-2">
                          <select className="input py-1 px-2 text-[10px] rounded-lg" style={{ minWidth: "120px" }} value={documentType} onChange={(e) => setDocumentType(e.target.value as DocumentType)}>
                            {documentTypes.map((t) => <option key={t} value={t}>{documentTypeLabels[t]}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-2">
                          <button type="button" className="rounded-lg px-3 py-1 text-[10px] font-bold text-white transition-all hover:opacity-90" style={{ background: "var(--admin-primary-strong)" }} disabled={busyOrder === o.id} onClick={() => void createInvoice(o.id)}>
                            {busyOrder === o.id ? "Creando..." : "Crear"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Table */}
      <div className="mx-auto max-w-[1600px] px-8 py-6">
        {filtered.length === 0 ? (
          <div className="rounded-xl p-12 text-center" style={{ border: "1px dashed var(--admin-border)" }}>
            <Icon name="receipt" className="mx-auto text-3xl mb-3" style={{ color: "var(--admin-muted)", opacity: 0.4 }} />
            <h3 className="text-lg font-bold" style={{ color: "var(--admin-text)" }}>No hay comprobantes</h3>
            <p className="mt-1 text-sm" style={{ color: "var(--admin-muted)" }}>Crea un comprobante desde un pedido pendiente.</p>
          </div>
        ) : (           <div className="overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl shadow-black/10">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--admin-border)", background: "color-mix(in srgb, var(--admin-surface-elevated) 50%, var(--admin-surface))" }} className="text-[10px] uppercase tracking-wider sticky top-0 z-10">
                    <Th>Nro</Th><Th>Pedido</Th><Th>Cliente</Th><Th>Tipo</Th><Th>Fecha</Th><Th>Sucursal</Th><Th r>Total</Th><Th>Estado</Th><Th>Documento</Th><Th>Acciones</Th>
                  </tr>
                </thead>
                <tbody>
                  {pagedInvoices.map((inv, idx) => {
                    const st = STATUS_CFG[inv.status] ?? STATUS_CFG.draft;
                    const ds = docStatus(inv.document);
                    return (
                      <tr key={inv.id} className="transition-colors" style={{ borderBottom: "1px solid var(--admin-border)", background: idx % 2 === 1 ? "color-mix(in srgb, var(--admin-surface-elevated) 15%, var(--admin-surface))" : undefined }}>
                        <Td><Link href={href(`/admin/facturacion/${inv.id}`) as never} className="font-bold transition-colors" style={{ color: "var(--admin-primary)" }} onMouseEnter={(e) => e.currentTarget.style.opacity = "0.8"} onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}>{inv.number || "Sin numero"}</Link></Td>
                        <Td muted>{inv.order.reference}</Td>
                        <Td bold>{inv.customerName}</Td>
                        <Td muted>{documentTypeLabels[(inv.documentType as DocumentType) ?? "internal_receipt"] ?? inv.documentType}</Td>
                        <Td muted>{new Date(inv.createdAt).toLocaleDateString("es-AR")}</Td>
                        <Td muted>{inv.branch?.name ?? "—"}</Td>
                        <Td r bold>{fmt(inv.total, inv.currency)}</Td>
                        <Td><span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: st.bg, color: st.color }}>{st.label}</span></Td>
                        <Td><span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: ds.bg, color: ds.color }}>{ds.label}</span></Td>
                        <Td>
                          <div className="flex flex-wrap gap-1">
                            <Link href={href(`/admin/facturacion/${inv.id}`) as never} className="rounded bg-[var(--admin-primary-soft)] px-2 py-1 text-[10px] font-bold text-[var(--admin-primary)] transition hover:text-white">Ver</Link>
                            <button type="button" className="rounded px-2 py-1 text-[10px] font-semibold transition-all" style={{ color: "var(--admin-muted)" }} onClick={() => void editInvoice(inv)} onMouseEnter={(e) => e.currentTarget.style.background = "color-mix(in srgb, var(--admin-primary) 8%, transparent)"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>Editar</button>
                            {!inv.document && <button type="button" className="rounded px-2 py-1 text-[10px] font-semibold transition-all" style={{ color: "var(--admin-primary)" }} disabled={busyDocument === inv.id} onClick={() => void generateDocument(inv)}>{busyDocument === inv.id ? "..." : "Generar"}</button>}
                            {inv.document && <button type="button" className="rounded px-2 py-1 text-[10px] font-semibold text-[var(--admin-muted)] hover:bg-white/5 hover:text-white" onClick={() => window.open(apiPath(`/api/admin/invoices/${inv.id}/document?format=docx&download=1`), "_blank", "noopener,noreferrer")}>DOCX</button>}
                            {inv.document?.pdfStatus === "ready" && <button type="button" className="rounded px-2 py-1 text-[10px] font-semibold text-[var(--admin-muted)] hover:bg-white/5 hover:text-white" onClick={() => window.open(apiPath(`/api/admin/invoices/${inv.id}/document?format=pdf`), "_blank", "noopener,noreferrer")}>PDF / imprimir</button>}
                          </div>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              page={safePage}
              pageSize={pageSize}
              totalItems={filtered.length}
              onPageChange={setPage}
              onPageSizeChange={(value) => { setPageSize(value as 25 | 50 | 100); setPage(1); }}
            />
          </div>
        )}
      </div>

      {/* Config Modal */}
      {showConfig && <ConfigModal settings={settings} saving={savingSettings} onSave={saveIssuerSettings} onClose={() => setShowConfig(false)} />}
    </div>
  );
}

function Th({ children, r }: { children: React.ReactNode; r?: boolean }) { return <th className="px-5 py-3 font-semibold" style={{ textAlign: r ? "right" : "left", color: "var(--admin-muted)" }}>{children}</th>; }
function Td({ children, r, bold, muted }: { children: React.ReactNode; r?: boolean; bold?: boolean; muted?: boolean }) { return <td className="px-5 py-3" style={{ textAlign: r ? "right" : "left", fontWeight: bold ? 700 : 400, color: muted ? "var(--admin-muted)" : "var(--admin-text)" }}>{children}</td>; }
function Kpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return <div className="rounded-xl px-4 py-3" style={{ background: "var(--admin-surface)", border: "1px solid var(--admin-border)" }}>
    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--admin-muted)" }}>{label}</p>
    <p className="text-xl font-extrabold tabular-nums mt-1" style={{ color: color || "var(--admin-text)" }}>{value}</p>
  </div>;
}

function ConfigModal({ settings, saving, onSave, onClose }: { settings: InvoiceSettingsData | null; saving: boolean; onSave: (e: React.FormEvent<HTMLFormElement>) => void; onClose: () => void }) {
  return (
    <Drawer open onClose={onClose} title="Configuración del emisor" width="560px">
        <form className="space-y-4" onSubmit={onSave}>
          <p className="text-xs" style={{ color: "var(--admin-muted)" }}>Estos datos completan los campos business.* de las plantillas Word.</p>
          <Field label="Nombre del negocio" name="issuerName" defaultValue={settings?.issuerName ?? ""} placeholder="Nombre en el comprobante" />
          <Field label="CUIT / documento" name="taxId" defaultValue={settings?.taxId ?? ""} placeholder="Ej. 30-12345678-9" />
          <Field label="Domicilio" name="address" defaultValue={settings?.address ?? ""} placeholder="Calle y numero" />
          <Field label="Localidad" name="city" defaultValue={settings?.city ?? ""} placeholder="Ciudad" />
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--admin-muted)" }}>Condiciones / pie</label>
            <textarea className="input w-full min-h-20 text-sm rounded-lg" name="terms" maxLength={3000} defaultValue={settings?.terms ?? ""} placeholder="Texto pie del comprobante..." />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-all hover:opacity-80" style={{ border: "1px solid var(--admin-border)", color: "var(--admin-muted)" }} onClick={onClose}>Cancelar</button>
            <button type="submit" className="rounded-lg px-4 py-1.5 text-xs font-bold text-white transition-all hover:opacity-90" style={{ background: "var(--admin-primary-strong)" }} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button>
          </div>
        </form>
    </Drawer>
  );
}

function Field({ label, name, defaultValue, placeholder }: { label: string; name: string; defaultValue: string; placeholder?: string }) {
  return <div><label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--admin-muted)" }}>{label}</label><input className="input w-full py-1.5 text-sm rounded-lg" name={name} defaultValue={defaultValue} placeholder={placeholder} /></div>;
}
