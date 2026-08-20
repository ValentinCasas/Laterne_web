"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/admin/ui";
import { Icon } from "@/components/admin/ui/icons";
import { dateLabel, money } from "@/lib/helpers";
import { adminHrefFromPathname } from "@/lib/routes";

type AlbaranDetail = {
  id: number;
  number: string;
  receivedAt: string;
  notes?: string | null;
  supplier: { id: number; name: string; paymentTerms?: string | null };
  branch: { id: number; name: string };
  createdBy?: { id: number; name: string } | null;
  order?: { id: number; number: string; status: string } | null;
  items: Array<{
    id: number;
    quantity: string | number;
    unit: string;
    unitCost: string | number;
    sortOrder: number;
    product?: { id: number; name: string };
    orderItem?: {
      id: number;
      quantity: string | number;
      receivedQuantity: string | number;
      invoicedQuantity: string | number;
      unit: string;
      unitCost: string | number;
      sortOrder?: number;
      product?: { id: number; name: string };
      order?: { id: number; number: string };
    };
  }>;
  invoices: Array<{
    invoice: { id: number; number: string; status: string; total: string | number; paidAmount: string | number; documentDate: string };
  }>;
};

/**
 * @summary Ficha de albarán registrado — solo lectura estilo Business Central.
 * Documento histórico con header, líneas y acciones de navegación.
 */
export function ComprasAlbaranDetailClient({ receipt, currency }: { receipt: AlbaranDetail; currency: string }) {
  const pathname = usePathname();
  const href = (path: string) => adminHrefFromPathname(pathname, path);
  const totalReceipt = receipt.items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitCost) || 0), 0);

  return (
    <div className="min-h-screen bg-[var(--admin-bg)]">
      {/* ── Document Header ── */}
      <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="mx-auto max-w-[1600px] px-6 pt-4 pb-3">
          <nav className="mb-4 flex items-center gap-1.5 text-xs text-[var(--admin-muted)]">
            <Link href={href("/admin/compras")} className="transition-colors hover:text-white/80">Compras</Link>
            <span className="text-zinc-600">/</span>
            <span className="text-white font-medium">{receipt.number}</span>
          </nav>

          <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
            <div>
              <h1 className="text-3xl font-black tracking-tight leading-none">{receipt.number}</h1>
              <p className="mt-1.5 text-sm text-[var(--admin-muted)]">
                {receipt.supplier.name} · {receipt.branch.name}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 pb-0.5">
              <span className="rounded-full bg-emerald-500/15 text-emerald-300 px-2.5 py-1 text-[10px] font-black">
                Albarán registrado
              </span>
              {receipt.createdBy && (
                <span className="text-xs text-[var(--admin-muted)]">
                  Registrado por {receipt.createdBy.name}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Action Bar ── */}
      <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface)]/50">
        <div className="mx-auto max-w-[1600px] flex flex-wrap items-center gap-0 px-6 py-1.5 text-xs">
          {receipt.order && (
            <div className="flex items-center border-r border-[var(--admin-border)] px-3 py-1.5">
              <span className="mr-2 text-[9px] font-black uppercase tracking-wider text-[var(--admin-muted)]">Navegar</span>
              <Link href={href(`/admin/compras/pedidos/${receipt.order.id}`) as never} className="rounded px-2.5 py-1 text-[11px] font-semibold text-[var(--admin-muted)] hover:bg-white/5 hover:text-white transition-colors">
                Pedido origen ({receipt.order.number})
              </Link>
              {receipt.invoices.length > 0 && receipt.invoices.map(({ invoice }) => (
                <Link key={invoice.id} href={href(`/admin/compras/facturas/${invoice.id}`) as never} className="rounded px-2.5 py-1 text-[11px] font-semibold text-[var(--admin-muted)] hover:bg-white/5 hover:text-white transition-colors ml-1">
                  Factura ({invoice.number})
                </Link>
              ))}
            </div>
          )}
          <div className="flex items-center px-3 py-1.5">
            <span className="text-[10px] text-[var(--admin-muted)] italic">Documento de solo lectura</span>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="mx-auto max-w-[1600px] flex flex-col lg:flex-row gap-0">
        <div className="flex-1 min-w-0">
          {/* ── GENERAL ── */}
          <div className="border-b border-[var(--admin-border)]">
            <div className="px-6 py-3 bg-white/[0.01]">
              <div className="flex items-center gap-2">
                <Icon name="document" className="text-sm text-[var(--admin-muted)]" />
                <h3 className="text-xs font-black uppercase tracking-widest text-[var(--admin-muted)]">General</h3>
              </div>
            </div>
            <div className="grid gap-x-10 gap-y-4 sm:grid-cols-2 lg:grid-cols-3 px-6 py-5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--admin-muted)] mb-0.5">Proveedor</p>
                <p className="text-sm font-bold">{receipt.supplier.name}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--admin-muted)] mb-0.5">Nº albarán</p>
                <p className="text-sm font-bold">{receipt.number}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--admin-muted)] mb-0.5">Fecha recepción</p>
                <p className="text-sm font-bold">{dateLabel(receipt.receivedAt)}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--admin-muted)] mb-0.5">Sucursal</p>
                <p className="text-sm font-bold">{receipt.branch.name}</p>
              </div>
              {receipt.order && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--admin-muted)] mb-0.5">Pedido origen</p>
                  <Link href={href(`/admin/compras/pedidos/${receipt.order.id}`) as never} className="text-sm font-bold text-pink-300 hover:underline transition-colors">
                    {receipt.order.number}
                  </Link>
                </div>
              )}
              {receipt.createdBy && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--admin-muted)] mb-0.5">Registrado por</p>
                  <p className="text-sm font-bold">{receipt.createdBy.name}</p>
                </div>
              )}
            </div>
          </div>

          {/* ── LINES ── */}
          <div className="border-b border-[var(--admin-border)]">
            <div className="px-6 py-3 bg-white/[0.01]">
              <h3 className="text-xs font-black uppercase tracking-widest text-[var(--admin-muted)]">
                Líneas ({receipt.items.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--admin-border)] bg-white/[0.02] text-[10px] uppercase tracking-wider text-[var(--admin-muted)]">
                    <th className="px-4 py-2.5 w-14">#</th>
                    <th className="px-4 py-2.5">Producto</th>
                    <th className="px-4 py-2.5">UdM</th>
                    <th className="px-4 py-2.5 text-right">Cantidad recibida</th>
                    <th className="px-4 py-2.5 text-right">Costo unitario</th>
                    <th className="px-4 py-2.5 text-right">Importe</th>
                    {receipt.items.some((item) => item.orderItem) && <th className="px-4 py-2.5">Línea origen</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--admin-border)]/50">
                  {receipt.items.map((item, idx) => {
                    const qty = Number(item.quantity) || 0;
                    const cost = Number(item.unitCost) || 0;
                    return (
                      <tr key={item.id} className="transition-colors hover:bg-white/[0.02]">
                        <td className="px-4 py-2 text-[var(--admin-muted)] tabular-nums">{String((idx + 1) * 10000).padStart(5, "0")}</td>
                        <td className="px-4 py-2 font-semibold">{item.product?.name ?? "—"}</td>
                        <td className="px-4 py-2 text-[var(--admin-muted)]">{item.unit}</td>
                        <td className="px-4 py-2 text-right tabular-nums font-semibold">{qty}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{money(cost, currency)}</td>
                        <td className="px-4 py-2 text-right font-bold tabular-nums">{money(qty * cost, currency)}</td>
                        {receipt.items.some((i) => i.orderItem) && (
                          <td className="px-4 py-2 text-xs text-[var(--admin-muted)]">
                            {item.orderItem?.order ? (
                              <Link
                                href={href(`/admin/compras/pedidos/${item.orderItem.order.id}?line=${item.orderItem.id}`) as never}
                                className="text-pink-300/80 hover:text-pink-300 hover:underline transition-colors"
                              >
                                {item.orderItem.order.number} / {String(item.orderItem.sortOrder ? (item.orderItem.sortOrder + 1) * 10000 : 10000).padStart(5, "0")}
                              </Link>
                            ) : "—"}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-white/[0.02] font-bold text-xs border-t border-[var(--admin-border)]">
                    <td className="px-4 py-3" colSpan={receipt.items.some((i) => i.orderItem) ? 5 : 4}>Total albarán</td>
                    <td className="px-4 py-3 text-right tabular-nums">{money(totalReceipt, currency)}</td>
                    {receipt.items.some((i) => i.orderItem) && <td />}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* ── Notes ── */}
          {receipt.notes && (
            <div className="border-b border-[var(--admin-border)]">
              <div className="px-6 py-3 bg-white/[0.01]">
                <h3 className="text-xs font-black uppercase tracking-widest text-[var(--admin-muted)]">Notas</h3>
              </div>
              <div className="px-6 py-5">
                <p className="text-sm text-[var(--admin-muted)] whitespace-pre-wrap">{receipt.notes}</p>
              </div>
            </div>
          )}
        </div>

        {/* ── FactBox ── */}
        <div className="w-full lg:w-64 shrink-0 border-l border-[var(--admin-border)] bg-[var(--admin-surface)]/30">
          <div className="p-5 space-y-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--admin-muted)] mb-2.5 pb-1.5 border-b border-[var(--admin-border)]">Resumen</p>
              <div className="space-y-2">
                <div className="flex justify-between text-xs"><span className="text-[var(--admin-muted)]">Líneas</span><span className="font-semibold tabular-nums">{receipt.items.length}</span></div>
                <div className="flex justify-between text-xs border-t border-[var(--admin-border)] pt-2"><span className="text-[var(--admin-muted)]">Total</span><span className="font-black tabular-nums">{money(totalReceipt, currency)}</span></div>
              </div>
            </div>

            {receipt.order && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--admin-muted)] mb-2.5 pb-1.5 border-b border-[var(--admin-border)]">Pedido origen</p>
                <Link href={href(`/admin/compras/pedidos/${receipt.order.id}`) as never} className="text-sm font-bold text-pink-300 hover:underline transition-colors block">
                  {receipt.order.number}
                </Link>
                <p className="text-xs text-[var(--admin-muted)] mt-0.5">{receipt.order.status}</p>
              </div>
            )}

            {receipt.invoices.length > 0 && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--admin-muted)] mb-2.5 pb-1.5 border-b border-[var(--admin-border)]">Facturas ({receipt.invoices.length})</p>
                <div className="space-y-1.5">
                  {receipt.invoices.map(({ invoice }) => (
                    <Link key={invoice.id} href={href(`/admin/compras/facturas/${invoice.id}`) as never} className="block text-sm font-bold text-pink-300 hover:underline transition-colors">
                      {invoice.number}
                    </Link>
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
