"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import Swal from "sweetalert2";
import { PageHeader } from "@/components/admin/ui";
import { dateLabel, money } from "@/lib/helpers";
import { api, showError } from "@/lib/client-helpers";
import { StatusBadge, INVOICE_STATUS_LABELS, DocLink } from "@/components/admin/compras/document-header";
import { adminHrefFromPathname } from "@/lib/routes";

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
  order?: { id: number; number: string } | null;
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

export function ComprasFacturaDetailClient({
  invoice,
  currency,
}: {
  invoice: InvoiceDetail;
  currency: string;
}) {
  const pathname = usePathname();
  const href = (path: string) => adminHrefFromPathname(pathname, path);
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("transferencia");
  const [payNotes, setPayNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const balance = Number(invoice.total) - Number(invoice.paidAmount);
  const canPay = !["paid", "cancelled"].includes(invoice.status) && balance > 0;

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
    <div className="space-y-6">
      <PageHeader
        eyebrow="Costos"
        title={invoice.number}
        description={`${invoice.supplier.name} · ${dateLabel(invoice.documentDate)}`}
        section="compras"
      />

      <nav className="flex items-center gap-1.5 text-sm text-[var(--admin-muted)]">
        <Link href={href("/admin/compras")} className="transition-colors hover:text-white">Compras</Link>
        <span className="text-zinc-600">/</span>
        <Link href={href("/admin/compras/facturas")} className="transition-colors hover:text-white">Facturas registradas</Link>
        <span className="text-zinc-600">/</span>
        <span className="text-white font-medium">{invoice.number}</span>
      </nav>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Contenido principal */}
        <div className="flex-1 space-y-6 min-w-0">
          {/* Cabecera */}
          <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={invoice.status} labels={INVOICE_STATUS_LABELS} />
              {invoice.externalNumber && <span className="text-sm text-[var(--admin-muted)]">Comp. {invoice.externalNumber}</span>}
              {invoice.createdBy && <span className="text-sm text-[var(--admin-muted)]">por {invoice.createdBy.name}</span>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="text-[11px] font-semibold text-[var(--admin-muted)]">Proveedor</p>
                <p className="font-bold">{invoice.supplier.name}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[var(--admin-muted)]">Documento</p>
                <p className="font-bold">{invoice.number}</p>
                <p className="text-xs text-[var(--admin-muted)]">{dateLabel(invoice.documentDate)}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[var(--admin-muted)]">Vencimiento</p>
                <p className="font-bold">{invoice.dueDate ? dateLabel(invoice.dueDate) : "—"}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-[var(--admin-border)]">
              <div className="text-center">
                <p className="text-[11px] text-[var(--admin-muted)]">Total</p>
                <p className="text-lg font-black tabular-nums">{money(invoice.total, currency)}</p>
              </div>
              <div className="text-center">
                <p className="text-[11px] text-[var(--admin-muted)]">Pagado</p>
                <p className="text-lg font-black tabular-nums text-emerald-300">{money(invoice.paidAmount, currency)}</p>
              </div>
              <div className="text-center">
                <p className="text-[11px] text-[var(--admin-muted)]">Saldo</p>
                <p className={`text-lg font-black tabular-nums ${balance > 0 ? "text-amber-300" : "text-emerald-300"}`}>{money(balance, currency)}</p>
              </div>
            </div>

            {/* Pedido origen */}
            {invoice.order && (
              <div className="pt-3 border-t border-[var(--admin-border)]">
                <p className="text-[11px] font-semibold text-[var(--admin-muted)]">Pedido origen</p>
                <Link href={href(`/admin/compras/pedidos/${invoice.order.id}`)} className="font-black text-pink-300 hover:underline">
                  {invoice.order.number}
                </Link>
              </div>
            )}
          </div>

          {/* Líneas de la factura */}
          <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] overflow-hidden">
            <div className="px-5 py-3 border-b border-[var(--admin-border)]">
              <h3 className="text-sm font-black uppercase tracking-widest text-[var(--admin-muted)]">Líneas de la factura</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--admin-border)] bg-white/[0.02] text-[10px] uppercase tracking-wider text-[var(--admin-muted)]">
                    <th className="px-4 py-2.5">#</th>
                    <th className="px-4 py-2.5">Concepto</th>
                    <th className="px-4 py-2.5 text-right">Cantidad</th>
                    <th className="px-4 py-2.5 text-right">Costo</th>
                    <th className="px-4 py-2.5 text-right">Importe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--admin-border)]/70">
                  {invoice.items.map((item, idx) => {
                    const qty = Number(item.quantity);
                    const cost = Number(item.unitCost);
                    return (
                      <tr key={item.id} className="transition-colors hover:bg-white/[0.02]">
                        <td className="px-4 py-2.5 text-xs text-[var(--admin-muted)]">{(idx + 1) * 10000}</td>
                        <td className="px-4 py-2.5 font-semibold">{item.description}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{qty} {item.unit}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{money(cost, currency)}</td>
                        <td className="px-4 py-2.5 text-right font-bold tabular-nums">{money(qty * cost, currency)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-white/[0.02]">
                    <td className="px-4 py-2.5" colSpan={4}>Subtotal</td>
                    <td className="px-4 py-2.5 text-right font-bold tabular-nums">{money(invoice.subtotal, currency)}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5" colSpan={4}>Impuestos</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{money(invoice.taxAmount, currency)}</td>
                  </tr>
                  <tr className="bg-white/[0.02] font-bold">
                    <td className="px-4 py-2.5" colSpan={4}>Total</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{money(invoice.total, currency)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Albaranes que documenta */}
          {invoice.receipts.length > 0 && (
            <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
              <h3 className="text-sm font-black uppercase tracking-widest text-[var(--admin-muted)]">
                Albaranes que documenta ({invoice.receipts.length})
              </h3>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--admin-border)] text-[10px] uppercase tracking-wider text-[var(--admin-muted)]">
                      <th className="px-3 py-2">Albarán</th>
                      <th className="px-3 py-2">Fecha</th>
                      <th className="px-3 py-2">Pedido</th>
                      <th className="px-3 py-2 text-right">Líneas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--admin-border)]/70">
                    {invoice.receipts.map(({ receipt }) => (
                      <tr key={receipt.id} className="transition-colors hover:bg-white/[0.02]">
                        <td className="px-3 py-2">
                          <Link href={href(`/admin/compras/albaranes/${receipt.id}`)} className="font-black text-pink-300 hover:underline">
                            {receipt.number}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-[var(--admin-muted)]">{dateLabel(receipt.receivedAt)}</td>
                        <td className="px-3 py-2">
                          {receipt.order ? (
                            <Link href={href(`/admin/compras/pedidos/${receipt.order.id}`)} className="text-pink-300 hover:underline font-bold">
                              {receipt.order.number}
                            </Link>
                          ) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right text-[var(--admin-muted)]">{receipt.items.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pagos */}
          <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
            <h3 className="text-sm font-black uppercase tracking-widest text-[var(--admin-muted)]">
              Pagos ({invoice.payments.length})
            </h3>
            {invoice.payments.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--admin-muted)]">Sin pagos registrados.</p>
            ) : (
              <div className="mt-3 space-y-2">
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
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className="block text-xs font-semibold text-[var(--admin-muted)]">Monto</span>
                  <input className="input mt-1" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </label>
                <label className="block">
                  <span className="block text-xs font-semibold text-[var(--admin-muted)]">Medio</span>
                  <select className="input mt-1" value={method} onChange={(e) => setMethod(e.target.value)}>
                    <option value="transferencia">Transferencia</option>
                    <option value="efectivo">Efectivo</option>
                    <option value="tarjeta">Tarjeta</option>
                    <option value="otro">Otro</option>
                  </select>
                </label>
                <label className="block">
                  <span className="block text-xs font-semibold text-[var(--admin-muted)]">Notas</span>
                  <input className="input mt-1" value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder="Observaciones…" />
                </label>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button type="button" className="btn" onClick={() => void registerPayment()} disabled={saving}>
                  {saving ? "Registrando…" : "Registrar pago"}
                </button>
                <span className="text-xs text-[var(--admin-muted)]">Saldo pendiente: {money(balance, currency)}</span>
              </div>
            </div>
          )}

          {invoice.notes && (
            <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
              <h3 className="text-sm font-black uppercase tracking-widest text-[var(--admin-muted)]">Notas</h3>
              <p className="mt-2 text-sm text-[var(--admin-muted)]">{invoice.notes}</p>
            </div>
          )}
        </div>

        {/* Panel lateral */}
        <div className="w-full lg:w-64 shrink-0 space-y-4">
          <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 space-y-3">
            <h3 className="text-xs font-black uppercase tracking-widest text-[var(--admin-muted)]">Resumen</h3>
            <div className="flex justify-between text-sm">
              <span className="text-[var(--admin-muted)]">Líneas</span>
              <span className="font-bold">{invoice.items.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[var(--admin-muted)]">Pagos</span>
              <span className="font-bold">{invoice.payments.length}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-[var(--admin-border)] pt-2">
              <span className="text-[var(--admin-muted)]">Saldo</span>
              <span className={`font-black tabular-nums ${balance > 0 ? "text-amber-300" : "text-emerald-300"}`}>{money(balance, currency)}</span>
            </div>
          </div>

          {/* Documentos relacionados */}
          <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 space-y-3">
            <h3 className="text-xs font-black uppercase tracking-widest text-[var(--admin-muted)]">Documentos relacionados</h3>
            {invoice.order && (
              <div>
                <p className="text-[11px] font-semibold text-[var(--admin-muted)] mb-1">Pedido origen</p>
                <DocLink number={invoice.order.number} path={`/admin/compras/pedidos/${invoice.order.id}`} />
              </div>
            )}
            {invoice.receipts.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-[var(--admin-muted)] mb-1">Albaranes ({invoice.receipts.length})</p>
                <div className="space-y-1">
                  {invoice.receipts.map(({ receipt }) => (
                    <DocLink key={receipt.id} number={receipt.number} path={`/admin/compras/albaranes/${receipt.id}`} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
