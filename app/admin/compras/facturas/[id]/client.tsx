"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import Swal from "sweetalert2";
import { Icon } from "@/components/admin/ui/icons";
import { dateLabel, money } from "@/lib/helpers";
import { api, showError } from "@/lib/client-helpers";
import { adminHrefFromPathname } from "@/lib/routes";

/* ────────────────────────── Types ────────────────────────── */

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
  createdBy?: { id: number; name: string } | null;
  order?: { id: number; number: string; status?: string } | null;
  subtotal: string | number;
  taxAmount: string | number;
  total: string | number;
  paidAmount: string | number;
  items: Array<{
    id: number;
    productId?: number | null;
    description: string;
    quantity: string | number;
    unit: string;
    unitCost: string | number;
    discountPercent?: string | number;
    taxPercent?: string | number;
    sortOrder: number;
  }>;
  payments: Array<{
    id: number;
    number: string;
    amount: string | number;
    method: string;
    paidAt: string;
    notes?: string | null;
    createdBy?: { id: number; name: string } | null;
  }>;
  receipts: Array<{
    receipt: {
      id: number;
      number: string;
      receivedAt: string;
      order?: { id: number; number: string } | null;
      items: Array<{ id: number; quantity: string | number; unit: string; unitCost: string | number }>;
    };
  }>;
};

const INVOICE_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: "Borrador", color: "var(--admin-muted)", bg: "color-mix(in srgb, var(--admin-muted) 12%, transparent)" },
  pending: { label: "Pendiente", color: "var(--admin-warning)", bg: "color-mix(in srgb, var(--admin-warning) 12%, transparent)" },
  partially_paid: { label: "Parcial", color: "#60a5fa", bg: "color-mix(in srgb, #60a5fa 12%, transparent)" },
  paid: { label: "Pagado", color: "var(--admin-success)", bg: "color-mix(in srgb, var(--admin-success) 12%, transparent)" },
  cancelled: { label: "Anulado", color: "var(--admin-danger)", bg: "color-mix(in srgb, var(--admin-danger) 12%, transparent)" },
};

/* ────────────────────────── Main Component ────────────────────────── */

export function ComprasFacturaDetailClient({ invoice, currency }: { invoice: InvoiceDetail; currency: string }) {
  const pathname = usePathname();
  const href = useCallback((path: string) => adminHrefFromPathname(pathname, path), [pathname]);
  const router = useRouter();

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("transferencia");
  const [payNotes, setPayNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);

  const balance = Number(invoice.total) - Number(invoice.paidAmount);
  const canPay = !["paid", "cancelled"].includes(invoice.status) && balance > 0;
  const st = INVOICE_STATUS[invoice.status] ?? INVOICE_STATUS.draft;

  async function registerPayment() {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      await Swal.fire({ title: "Indica un monto valido", icon: "warning", background: "#18181b", color: "#fafafa" });
      return;
    }
    setSaving(true);
    try {
      await api(`/api/admin/compras/facturas/${invoice.id}/pagos`, {
        method: "POST",
        body: JSON.stringify({ amount: value, method, notes: payNotes || undefined }),
      });
      await Swal.fire({ title: "Pago registrado", icon: "success", timer: 1500, showConfirmButton: false, background: "#18181b", color: "#fafafa" });
      router.refresh();
      setAmount("");
      setPayNotes("");
    } catch (reason) {
      await showError("No se pudo registrar el pago", reason);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--admin-background)" }}>
      {/* ── Header ── */}
      <div style={{ background: "var(--admin-surface)" }} className="relative">
        <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: "linear-gradient(90deg, var(--admin-primary-strong), var(--admin-primary), transparent)" }} />
        <div className="mx-auto max-w-[1600px] px-8 pt-6 pb-5">
          <nav className="mb-5 flex items-center gap-2 text-xs" style={{ color: "var(--admin-muted)" }}>
            <Link href={href("/admin/compras")} className="transition-colors hover:opacity-70">Compras</Link>
            <span className="opacity-40">/</span>
            <Link href={href("/admin/compras/facturas")} className="transition-colors hover:opacity-70">Facturas</Link>
            <span className="opacity-40">/</span>
            <span className="font-medium" style={{ color: "var(--admin-text)" }}>{invoice.number}</span>
          </nav>
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight leading-none" style={{ color: "var(--admin-text)" }}>{invoice.number}</h1>
              <p className="mt-2 text-sm" style={{ color: "var(--admin-muted)" }}>{invoice.supplier.name} · {dateLabel(invoice.documentDate)}</p>
            </div>
            <div className="flex items-center gap-2.5 pb-0.5">
              <span className="rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: st.bg, color: st.color }}>{st.label}</span>
              {invoice.externalNumber && <span className="text-xs" style={{ color: "var(--admin-muted)" }}>Comp. {invoice.externalNumber}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="border-b" style={{ borderColor: "var(--admin-border)", background: "color-mix(in srgb, var(--admin-surface) 60%, var(--admin-background))" }}>
        <div className="mx-auto max-w-[1600px] flex flex-wrap items-center px-8 py-2 text-xs gap-0">
          <ActionGroup label="Pedido">
            {invoice.order && (
              <>
                <ActionBtn label="Ver pedido" icon="document" onClick={() => setShowOrderModal(true)} />
                <Link href={href(`/admin/compras/pedidos/${invoice.order.id}`) as never} className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 hover:opacity-80" style={{ color: "var(--admin-muted)" }}>
                  <Icon name="external-link" className="text-xs" /> Abrir pedido
                </Link>
              </>
            )}
          </ActionGroup>
          <ActionGroup label="Documento">
            <ActionBtn label="Imprimir" icon="printer" onClick={() => window.print()} />
          </ActionGroup>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="mx-auto max-w-[1600px] flex flex-col lg:flex-row gap-6 px-8 py-6">
        <div className="flex-1 min-w-0 space-y-5">
          {/* RESUMEN */}
          <div className="rounded-xl p-5" style={{ background: "var(--admin-surface)", border: "1px solid var(--admin-border)" }}>
            <div className="grid gap-x-10 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
              <FactField label="Proveedor" value={invoice.supplier.name} />
              <FactField label="Fecha documento" value={dateLabel(invoice.documentDate)} />
              <FactField label="Vencimiento" value={invoice.dueDate ? dateLabel(invoice.dueDate) : "—"} />
              <FactField label="Sucursal" value={invoice.branch?.name ?? "—"} />
              <FactField label="Total" value={money(invoice.total, currency)} bold />
              <FactField label="Pagado" value={money(invoice.paidAmount, currency)} color="var(--admin-success)" />
              <FactField label="Saldo" value={money(balance, currency)} color={balance > 0 ? "var(--admin-warning)" : "var(--admin-success)"} bold />
              <FactField label="Categoria" value={invoice.financialCategory ?? "Insumos"} />
            </div>
          </div>

          {/* LINEAS */}
          <div className="rounded-xl overflow-hidden" style={{ background: "var(--admin-surface)", border: "1px solid var(--admin-border)" }}>
            <div className="px-5 py-3 border-b" style={{ borderColor: "var(--admin-border)" }}>
              <h3 className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--admin-muted)" }}>Lineas de la factura ({invoice.items.length})</h3>
            </div>
            <div className="overflow-x-auto" style={{ scrollbarColor: "var(--admin-border) transparent" }}>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--admin-border)", background: "color-mix(in srgb, var(--admin-surface-elevated) 50%, var(--admin-surface))" }} className="text-[10px] uppercase tracking-wider">
                    <th className="px-4 py-2.5 font-semibold" style={{ color: "var(--admin-muted)" }}>#</th>
                    <th className="px-4 py-2.5 font-semibold" style={{ color: "var(--admin-muted)" }}>Concepto</th>
                    <th className="px-4 py-2.5 text-right font-semibold" style={{ color: "var(--admin-muted)" }}>Cantidad</th>
                    <th className="px-4 py-2.5 text-right font-semibold" style={{ color: "var(--admin-muted)" }}>Costo</th>
                    <th className="px-4 py-2.5 text-right font-semibold" style={{ color: "var(--admin-muted)" }}>Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item, idx) => {
                    const qty = Number(item.quantity);
                    const cost = Number(item.unitCost);
                    return (
                      <tr key={item.id} style={{ borderBottom: "1px solid var(--admin-border)", background: idx % 2 === 1 ? "color-mix(in srgb, var(--admin-surface-elevated) 12%, var(--admin-surface))" : undefined }}>
                        <td className="px-4 py-2 text-[10px]" style={{ color: "var(--admin-muted)" }}>{String((idx + 1) * 10000).padStart(5, "0")}</td>
                        <td className="px-4 py-2 font-semibold" style={{ color: "var(--admin-text)" }}>{item.description}</td>
                        <td className="px-4 py-2 text-right tabular-nums" style={{ color: "var(--admin-text)" }}>{qty} {item.unit}</td>
                        <td className="px-4 py-2 text-right tabular-nums" style={{ color: "var(--admin-text)" }}>{money(cost, currency)}</td>
                        <td className="px-4 py-2 text-right font-bold tabular-nums" style={{ color: "var(--admin-text)" }}>{money(qty * cost, currency)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "2px solid var(--admin-border)", background: "color-mix(in srgb, var(--admin-surface-elevated) 25%, var(--admin-surface))" }}>
                    <td className="px-4 py-2.5 text-xs font-semibold" colSpan={4} style={{ color: "var(--admin-muted)" }}>Subtotal</td>
                    <td className="px-4 py-2.5 text-right font-bold tabular-nums text-xs" style={{ color: "var(--admin-text)" }}>{money(invoice.subtotal, currency)}</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid var(--admin-border)" }}>
                    <td className="px-4 py-2.5 text-xs" colSpan={4} style={{ color: "var(--admin-muted)" }}>Impuestos</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-xs" style={{ color: "var(--admin-muted)" }}>{money(invoice.taxAmount, currency)}</td>
                  </tr>
                  <tr style={{ background: "color-mix(in srgb, var(--admin-surface-elevated) 40%, var(--admin-surface))" }}>
                    <td className="px-4 py-2.5 text-xs font-bold" colSpan={4} style={{ color: "var(--admin-text)" }}>Total</td>
                    <td className="px-4 py-2.5 text-right font-extrabold tabular-nums text-xs" style={{ color: "var(--admin-text)" }}>{money(invoice.total, currency)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* ALBARANES */}
          {invoice.receipts.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ background: "var(--admin-surface)", border: "1px solid var(--admin-border)" }}>
              <div className="px-5 py-3 border-b" style={{ borderColor: "var(--admin-border)" }}>
                <h3 className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--admin-muted)" }}>Albaranes que documenta ({invoice.receipts.length})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider" style={{ borderBottom: "1px solid var(--admin-border)", color: "var(--admin-muted)" }}>
                      <th className="px-4 py-2 font-semibold" style={{ color: "var(--admin-muted)" }}>Albaran</th>
                      <th className="px-4 py-2 font-semibold" style={{ color: "var(--admin-muted)" }}>Fecha</th>
                      <th className="px-4 py-2 font-semibold" style={{ color: "var(--admin-muted)" }}>Pedido</th>
                      <th className="px-4 py-2 text-right font-semibold" style={{ color: "var(--admin-muted)" }}>Lineas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.receipts.map(({ receipt }, idx) => (
                      <tr key={receipt.id} style={{ borderBottom: "1px solid var(--admin-border)", background: idx % 2 === 1 ? "color-mix(in srgb, var(--admin-surface-elevated) 12%, var(--admin-surface))" : undefined }}>
                        <td className="px-4 py-2">
                          <Link href={href(`/admin/compras/albaranes/${receipt.id}`) as never} className="font-bold transition-opacity hover:opacity-80" style={{ color: "var(--admin-primary)" }}>{receipt.number}</Link>
                        </td>
                        <td className="px-4 py-2" style={{ color: "var(--admin-muted)" }}>{dateLabel(receipt.receivedAt)}</td>
                        <td className="px-4 py-2">
                          {receipt.order ? (
                            <Link href={href(`/admin/compras/pedidos/${receipt.order.id}`) as never} className="font-bold transition-opacity hover:opacity-80" style={{ color: "var(--admin-primary)" }}>{receipt.order.number}</Link>
                          ) : <span style={{ color: "var(--admin-muted)" }}>—</span>}
                        </td>
                        <td className="px-4 py-2 text-right" style={{ color: "var(--admin-muted)" }}>{receipt.items.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* PAGOS */}
          <div className="rounded-xl overflow-hidden" style={{ background: "var(--admin-surface)", border: "1px solid var(--admin-border)" }}>
            <div className="px-5 py-3 border-b" style={{ borderColor: "var(--admin-border)" }}>
              <h3 className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--admin-muted)" }}>Pagos ({invoice.payments.length})</h3>
            </div>
            <div className="p-4">
              {invoice.payments.length === 0 ? (
                <p className="text-xs py-4 text-center" style={{ color: "var(--admin-muted)" }}>Sin pagos registrados.</p>
              ) : (
                <div className="space-y-2">
                  {invoice.payments.map((payment) => (
                    <div key={payment.id} className="flex flex-wrap items-center gap-3 rounded-lg px-4 py-2.5 text-xs" style={{ background: "color-mix(in srgb, var(--admin-surface-elevated) 40%, var(--admin-surface))", border: "1px solid var(--admin-border)" }}>
                      <span className="font-bold" style={{ color: "var(--admin-primary)" }}>{payment.number}</span>
                      <span className="font-bold tabular-nums" style={{ color: "var(--admin-text)" }}>{money(payment.amount, currency)}</span>
                      <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase" style={{ background: "color-mix(in srgb, var(--admin-muted) 10%, transparent)", color: "var(--admin-muted)" }}>{payment.method}</span>
                      <span className="text-[10px]" style={{ color: "var(--admin-muted)" }}>{dateLabel(payment.paidAt)}</span>
                      {payment.createdBy && <span className="text-[10px]" style={{ color: "var(--admin-muted)" }}>por {payment.createdBy.name}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* REGISTRAR PAGO */}
          {canPay && (
            <div className="rounded-xl p-5" style={{ border: "1px solid color-mix(in srgb, var(--admin-warning) 25%, transparent)", background: "color-mix(in srgb, var(--admin-warning) 4%, transparent)" }}>
              <p className="text-xs font-bold mb-3" style={{ color: "var(--admin-warning)" }}>Registrar pago</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--admin-muted)" }}>Monto</label>
                  <input className="input w-full py-1.5 text-xs rounded-lg" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--admin-muted)" }}>Medio</label>
                  <select className="input w-full py-1.5 text-xs rounded-lg" value={method} onChange={(e) => setMethod(e.target.value)}>
                    <option value="transferencia">Transferencia</option>
                    <option value="efectivo">Efectivo</option>
                    <option value="tarjeta">Tarjeta</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--admin-muted)" }}>Notas</label>
                  <input className="input w-full py-1.5 text-xs rounded-lg" value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder="Observaciones..." />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <button type="button" className="rounded-lg px-4 py-1.5 text-xs font-bold text-white transition-all hover:opacity-90" style={{ background: "var(--admin-primary-strong)" }} onClick={() => void registerPayment()} disabled={saving}>
                  {saving ? "Registrando..." : "Registrar pago"}
                </button>
                <span className="text-[10px]" style={{ color: "var(--admin-muted)" }}>Saldo pendiente: {money(balance, currency)}</span>
              </div>
            </div>
          )}

          {/* NOTAS */}
          {invoice.notes && (
            <div className="rounded-xl p-5" style={{ background: "var(--admin-surface)", border: "1px solid var(--admin-border)" }}>
              <h3 className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--admin-muted)" }}>Notas</h3>
              <p className="text-xs whitespace-pre-wrap" style={{ color: "var(--admin-muted)" }}>{invoice.notes}</p>
            </div>
          )}
        </div>

        {/* FactBox */}
        <div className="w-full lg:w-72 shrink-0 space-y-4">
          <div className="rounded-xl p-5 space-y-5" style={{ background: "var(--admin-surface)", border: "1px solid var(--admin-border)" }}>
            <FactBoxSection title="Resumen">
              <FactBoxRow label="Lineas" value={String(invoice.items.length)} />
              <FactBoxRow label="Pagos" value={String(invoice.payments.length)} />
              <FactBoxRow label="Total" value={money(invoice.total, currency)} bold />
              <FactBoxRow label="Saldo" value={money(balance, currency)} color={balance > 0 ? "var(--admin-warning)" : "var(--admin-success)"} bold />
            </FactBoxSection>
            <FactBoxSection title="Proveedor">
              <FactBoxRow label={invoice.supplier.name} value="" />
              {invoice.supplier.paymentTerms && <FactBoxRow label="Pago" value={invoice.supplier.paymentTerms} />}
            </FactBoxSection>
            <FactBoxSection title="Documentos relacionados">
              {invoice.order && (
                <div className="space-y-2">
                  <FactBoxRow label="Pedido" value={invoice.order.number} />
                  <div className="flex gap-2">
                    <button type="button" className="text-[10px] font-semibold transition-opacity hover:opacity-80" style={{ color: "var(--admin-primary)" }} onClick={() => setShowOrderModal(true)}>Ver pedido</button>
                    <Link href={href(`/admin/compras/pedidos/${invoice.order.id}`) as never} className="text-[10px] font-semibold transition-opacity hover:opacity-80" style={{ color: "var(--admin-muted)" }}>Abrir</Link>
                  </div>
                </div>
              )}
              {invoice.receipts.length > 0 && (
                <div className="space-y-1 mt-2">
                  <span className="text-[10px] font-semibold" style={{ color: "var(--admin-muted)" }}>Albaranes ({invoice.receipts.length})</span>
                  {invoice.receipts.map(({ receipt }) => (
                    <Link key={receipt.id} href={href(`/admin/compras/albaranes/${receipt.id}`) as never} className="block text-[10px] font-semibold transition-opacity hover:opacity-80" style={{ color: "var(--admin-primary)" }}>{receipt.number}</Link>
                  ))}
                </div>
              )}
            </FactBoxSection>
          </div>
        </div>
      </div>

      {/* ── Quick View Modal: Pedido ── */}
      {showOrderModal && invoice.order && (
        <OrderQuickView orderId={invoice.order.id} orderNumber={invoice.order.number} onClose={() => setShowOrderModal(false)} href={href} currency={currency} />
      )}
    </div>
  );
}

/* ────────────────────────── Quick View Modal ────────────────────────── */

function OrderQuickView({ orderId, orderNumber, onClose, href, currency }: { orderId: number; orderNumber: string; onClose: () => void; href: (p: string) => string; currency: string }) {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/admin/compras/${orderId}`, { headers: { "Content-Type": "application/json" } });
        if (r.ok) { const data = await r.json(); if (!cancelled) setOrder(data); }
      } catch { /* ignore */ } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [orderId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const ORDER_LABELS: Record<string, string> = { draft: "Borrador", sent: "Enviado", partially_received: "Recibido parcial", received: "Recibido", closed: "Cerrado", cancelled: "Cancelado" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl" style={{ background: "var(--admin-surface)", border: "1px solid var(--admin-border)", maxHeight: "80vh" }} onClick={(e) => e.stopPropagation()}>
        <div className="relative px-6 pt-5 pb-4" style={{ borderBottom: "1px solid var(--admin-border)" }}>
          <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: "linear-gradient(90deg, var(--admin-primary-strong), transparent)" }} />
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold" style={{ color: "var(--admin-text)" }}>{loading ? "Cargando..." : order?.number ?? orderNumber}</h2>
              {order && <p className="text-xs mt-0.5" style={{ color: "var(--admin-muted)" }}>{order.supplier?.name} · {ORDER_LABELS[order.status] ?? order.status}</p>}
            </div>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 transition-colors" style={{ color: "var(--admin-muted)" }}
              onMouseEnter={(e) => e.currentTarget.style.background = "color-mix(in srgb, var(--admin-muted) 10%, transparent)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
              <Icon name="x" className="text-sm" />
            </button>
          </div>
        </div>
        <div className="overflow-y-auto p-6 space-y-4" style={{ maxHeight: "calc(80vh - 70px)" }}>
          {loading ? (
            <div className="py-12 text-center text-xs" style={{ color: "var(--admin-muted)" }}>Cargando pedido...</div>
          ) : order ? (
            <>
              {/* Quick header */}
              <div className="grid gap-3 sm:grid-cols-3 text-xs">
                <QVField label="Cliente" value={order.supplier?.name ?? "—"} />
                <QVField label="Fecha" value={order.orderDate ? new Date(order.orderDate).toLocaleDateString("es-AR") : "—"} />
                <QVField label="Estado" value={ORDER_LABELS[order.status] ?? order.status} />
                <QVField label="Sucursal" value={order.branch?.name ?? "—"} />
                <QVField label="Recepcion prevista" value={order.expectedDate ? new Date(order.expectedDate).toLocaleDateString("es-AR") : "—"} />
                <QVField label="Moneda" value="ARS" />
              </div>

              {/* Lineas */}
              {order.items && order.items.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--admin-muted)" }}>Productos ({order.items.length})</h4>
                  <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--admin-border)" }}>
                    <table className="w-full text-left text-[10px]">
                      <thead>
                        <tr style={{ background: "color-mix(in srgb, var(--admin-surface-elevated) 50%, var(--admin-surface))" }} className="uppercase tracking-wider">
                          <th className="px-3 py-2 font-semibold" style={{ color: "var(--admin-muted)" }}>Producto</th>
                          <th className="px-3 py-2 text-right font-semibold" style={{ color: "var(--admin-muted)" }}>Cant.</th>
                          <th className="px-3 py-2 text-right font-semibold" style={{ color: "var(--admin-muted)" }}>Recibida</th>
                          <th className="px-3 py-2 text-right font-semibold" style={{ color: "var(--admin-muted)" }}>Costo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.items.map((item: any, idx: number) => (
                          <tr key={item.id} style={{ borderTop: "1px solid var(--admin-border)", background: idx % 2 === 1 ? "color-mix(in srgb, var(--admin-surface-elevated) 12%, var(--admin-surface))" : undefined }}>
                            <td className="px-3 py-2 font-semibold" style={{ color: "var(--admin-text)" }}>{item.product?.name ?? "—"}</td>
                            <td className="px-3 py-2 text-right tabular-nums" style={{ color: "var(--admin-text)" }}>{item.quantity}</td>
                            <td className="px-3 py-2 text-right tabular-nums" style={{ color: "var(--admin-success)" }}>{item.receivedQuantity}</td>
                            <td className="px-3 py-2 text-right tabular-nums" style={{ color: "var(--admin-text)" }}>{money(item.unitCost, currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Footer actions */}
              <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid var(--admin-border)" }}>
                <span className="text-xs font-bold tabular-nums" style={{ color: "var(--admin-text)" }}>Total: {money(order.items?.reduce((s: number, i: any) => s + (Number(i.quantity) || 0) * (Number(i.unitCost) || 0), 0) ?? 0, currency)}</span>
                <Link href={href(`/admin/compras/pedidos/${order.id}`) as never} className="rounded-lg px-4 py-1.5 text-xs font-bold text-white transition-all hover:opacity-90" style={{ background: "var(--admin-primary-strong)" }} onClick={onClose}>
                  Abrir ficha completa
                </Link>
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-xs" style={{ color: "var(--admin-muted)" }}>No se pudo cargar el pedido.</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────── Sub-components ────────────────────────── */

function ActionGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center border-r px-3 py-1.5 last:border-r-0" style={{ borderColor: "color-mix(in srgb, var(--admin-border) 60%, transparent)" }}>
      <span className="mr-2 text-[9px] font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--admin-muted)" }}>{label}</span>
      {children}
    </div>
  );
}

function ActionBtn({ label, icon, onClick, disabled }: { label: string; icon?: string; onClick?: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all duration-150 whitespace-nowrap flex items-center gap-1.5"
      style={{ color: "var(--admin-muted)", opacity: disabled ? 0.35 : 1, cursor: disabled ? "not-allowed" : "pointer" }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = "color-mix(in srgb, var(--admin-primary) 8%, transparent)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
      {icon && <Icon name={icon as any} className="text-xs" />}
      {label}
    </button>
  );
}

function FactField({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return <div><p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--admin-muted)" }}>{label}</p><p className={`text-sm ${bold ? "font-extrabold" : "font-bold"}`} style={{ color: color || "var(--admin-text)" }}>{value}</p></div>;
}

function FactBoxSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><p className="text-[10px] font-bold uppercase tracking-wider mb-2.5 pb-2" style={{ color: "var(--admin-muted)", borderBottom: "1px solid var(--admin-border)" }}>{title}</p><div className="space-y-2.5">{children}</div></div>;
}

function FactBoxRow({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return <div className="flex items-center justify-between text-xs gap-2"><span className="truncate" style={{ color: "var(--admin-muted)" }}>{label}</span><span className={`tabular-nums whitespace-nowrap ${bold ? "font-extrabold" : "font-semibold"}`} style={{ color: color || "var(--admin-text)" }}>{value}</span></div>;
}

function QVField({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[9px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: "var(--admin-muted)" }}>{label}</p><p className="text-xs font-bold" style={{ color: "var(--admin-text)" }}>{value}</p></div>;
}
