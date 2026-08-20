"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
    orderItem?: { id: number; quantity: string | number; receivedQuantity: string | number; invoicedQuantity: string | number; unit: string; unitCost: string | number; sortOrder?: number; product?: { id: number; name: string }; order?: { id: number; number: string } };
  }>;
  invoices: Array<{ invoice: { id: number; number: string; status: string; total: string | number; paidAmount: string | number; documentDate: string } }>;
};

/**
 * @summary Ficha de albaran registrado — documento historico solo lectura estilo ERP premium.
 */
export function ComprasAlbaranDetailClient({ receipt, currency }: { receipt: AlbaranDetail; currency: string }) {
  const pathname = usePathname();
  const href = (path: string) => adminHrefFromPathname(pathname, path);
  const totalReceipt = receipt.items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitCost) || 0), 0);
  const totalQty = receipt.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

  return (
    <div className="min-h-screen" style={{ background: "var(--admin-background)" }}>
      {/* ── Header ── */}
      <div style={{ background: "var(--admin-surface)" }} className="relative">
        <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: "linear-gradient(90deg, var(--admin-success), color-mix(in srgb, var(--admin-success) 40%, transparent), transparent)" }} />
        <div className="mx-auto max-w-[1600px] px-8 pt-6 pb-5">
          <nav className="mb-5 flex items-center gap-2 text-xs" style={{ color: "var(--admin-muted)" }}>
            <Link href={href("/admin/compras")} className="transition-colors hover:opacity-70">Compras</Link>
            <span className="opacity-40">/</span>
            <span className="font-medium" style={{ color: "var(--admin-text)" }}>{receipt.number}</span>
          </nav>
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight leading-none" style={{ color: "var(--admin-text)" }}>{receipt.number}</h1>
              <p className="mt-2 text-sm" style={{ color: "var(--admin-muted)" }}>{receipt.supplier.name} · {receipt.branch.name}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 pb-0.5">
              <span className="rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: "color-mix(in srgb, var(--admin-success) 15%, transparent)", color: "var(--admin-success)" }}>Albaran registrado</span>
              {receipt.createdBy && <span className="text-xs" style={{ color: "var(--admin-muted)" }}>Registrado por {receipt.createdBy.name}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* ── Action Bar ── */}
      <div className="border-b" style={{ borderColor: "var(--admin-border)", background: "color-mix(in srgb, var(--admin-surface) 60%, var(--admin-background))" }}>
        <div className="mx-auto max-w-[1600px] flex flex-wrap items-center px-8 py-2 text-xs gap-0">
          {receipt.order && (
            <div className="flex items-center border-r px-3 py-1.5" style={{ borderColor: "color-mix(in srgb, var(--admin-border) 60%, transparent)" }}>
              <span className="mr-2 text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--admin-muted)" }}>Navegar</span>
              <Link href={href(`/admin/compras/pedidos/${receipt.order.id}`) as never} className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all duration-150" style={{ color: "var(--admin-muted)" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "color-mix(in srgb, var(--admin-primary) 8%, transparent)"; e.currentTarget.style.color = "var(--admin-primary)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--admin-muted)"; }}>
                Pedido origen ({receipt.order.number})
              </Link>
              {receipt.invoices.map(({ invoice }) => (
                <Link key={invoice.id} href={href(`/admin/compras/facturas/${invoice.id}`) as never} className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all duration-150 ml-1" style={{ color: "var(--admin-muted)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "color-mix(in srgb, var(--admin-primary) 8%, transparent)"; e.currentTarget.style.color = "var(--admin-primary)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--admin-muted)"; }}>
                  Factura ({invoice.number})
                </Link>
              ))}
            </div>
          )}
          <span className="px-3 text-[10px] italic" style={{ color: "var(--admin-muted)" }}>Documento de solo lectura</span>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="mx-auto max-w-[1600px] flex flex-col lg:flex-row gap-6 px-8 py-6">
        <div className="flex-1 min-w-0 space-y-5">
          {/* GENERAL */}
          <div className="rounded-xl overflow-hidden" style={{ background: "var(--admin-surface)", border: "1px solid var(--admin-border)" }}>
            <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--admin-border)", background: "color-mix(in srgb, var(--admin-surface-elevated) 30%, var(--admin-surface))" }}>
              <h3 className="text-sm font-bold" style={{ color: "var(--admin-text)" }}>General</h3>
            </div>
            <div className="grid gap-x-12 gap-y-5 sm:grid-cols-2 lg:grid-cols-3 p-6">
              <FieldRow label="Proveedor" value={receipt.supplier.name} />
              <FieldRow label="Nº albaran" value={receipt.number} />
              <FieldRow label="Fecha recepcion" value={dateLabel(receipt.receivedAt)} />
              <FieldRow label="Sucursal" value={receipt.branch.name} />
              {receipt.order && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--admin-muted)" }}>Pedido origen</p>
                  <Link href={href(`/admin/compras/pedidos/${receipt.order.id}`) as never} className="text-sm font-bold transition-colors" style={{ color: "var(--admin-primary)" }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = "0.8"} onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}>
                    {receipt.order.number}
                  </Link>
                </div>
              )}
              {receipt.createdBy && <FieldRow label="Registrado por" value={receipt.createdBy.name} />}
            </div>
          </div>

          {/* LINES */}
          <div className="rounded-xl overflow-hidden" style={{ background: "var(--admin-surface)", border: "1px solid var(--admin-border)" }}>
            <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--admin-border)", background: "color-mix(in srgb, var(--admin-surface-elevated) 30%, var(--admin-surface))" }}>
              <h3 className="text-sm font-bold" style={{ color: "var(--admin-text)" }}>Lineas <span className="text-[10px] font-normal ml-1" style={{ color: "var(--admin-muted)" }}>({receipt.items.length})</span></h3>
            </div>
            <div className="overflow-x-auto" style={{ scrollbarColor: "var(--admin-border) transparent" }}>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--admin-border)", background: "color-mix(in srgb, var(--admin-surface-elevated) 50%, var(--admin-surface))" }} className="text-[10px] uppercase tracking-wider sticky top-0 z-10">
                    <th className="px-5 py-3 font-semibold" style={{ color: "var(--admin-muted)" }}>#</th>
                    <th className="px-5 py-3 font-semibold" style={{ color: "var(--admin-muted)" }}>Articulo</th>
                    <th className="px-5 py-3 font-semibold" style={{ color: "var(--admin-muted)" }}>UdM</th>
                    <th className="px-5 py-3 text-right font-semibold" style={{ color: "var(--admin-muted)" }}>Cantidad</th>
                    <th className="px-5 py-3 text-right font-semibold" style={{ color: "var(--admin-muted)" }}>Costo</th>
                    <th className="px-5 py-3 text-right font-semibold" style={{ color: "var(--admin-muted)" }}>Importe</th>
                    {receipt.items.some((i) => i.orderItem) && <th className="px-5 py-3 font-semibold" style={{ color: "var(--admin-muted)" }}>Origen</th>}
                  </tr>
                </thead>
                <tbody>
                  {receipt.items.map((item, idx) => {
                    const qty = Number(item.quantity) || 0, cost = Number(item.unitCost) || 0;
                    return (
                      <tr key={item.id} className="transition-colors" style={{ background: idx % 2 === 1 ? "color-mix(in srgb, var(--admin-surface-elevated) 15%, var(--admin-surface))" : undefined }}>
                        <td className="px-5 py-3 tabular-nums" style={{ color: "var(--admin-muted)" }}>{String((idx + 1) * 10000).padStart(5, "0")}</td>
                        <td className="px-5 py-3 font-semibold" style={{ color: "var(--admin-text)" }}>{item.product?.name ?? "\u2014"}</td>
                        <td className="px-5 py-3" style={{ color: "var(--admin-muted)" }}>{item.unit}</td>
                        <td className="px-5 py-3 text-right tabular-nums font-semibold" style={{ color: "var(--admin-text)" }}>{qty}</td>
                        <td className="px-5 py-3 text-right tabular-nums" style={{ color: "var(--admin-muted)" }}>{money(cost, currency)}</td>
                        <td className="px-5 py-3 text-right font-bold tabular-nums" style={{ color: "var(--admin-text)" }}>{money(qty * cost, currency)}</td>
                        {receipt.items.some((i) => i.orderItem) && (
                          <td className="px-5 py-3 text-xs">
                            {item.orderItem?.order ? (
                              <Link href={href(`/admin/compras/pedidos/${item.orderItem.order.id}?line=${item.orderItem.id}`) as never} className="font-semibold transition-colors" style={{ color: "var(--admin-primary)" }}
                                onMouseEnter={(e) => e.currentTarget.style.opacity = "0.8"} onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}>
                                {item.orderItem.order.number} / {String(item.orderItem.sortOrder ? (item.orderItem.sortOrder + 1) * 10000 : 10000).padStart(5, "0")}
                              </Link>
                            ) : <span style={{ color: "var(--admin-muted)" }}>—</span>}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "2px solid var(--admin-border)", background: "color-mix(in srgb, var(--admin-surface-elevated) 30%, var(--admin-surface))" }}>
                    <td className="px-5 py-3.5 font-bold text-xs" colSpan={receipt.items.some((i) => i.orderItem) ? 5 : 4} style={{ color: "var(--admin-text)" }}>Total albaran</td>
                    <td className="px-5 py-3.5 text-right font-extrabold tabular-nums text-xs" style={{ color: "var(--admin-text)" }}>{money(totalReceipt, currency)}</td>
                    {receipt.items.some((i) => i.orderItem) && <td />}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {receipt.notes && (
            <div className="rounded-xl overflow-hidden" style={{ background: "var(--admin-surface)", border: "1px solid var(--admin-border)" }}>
              <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--admin-border)" }}>
                <h3 className="text-sm font-bold" style={{ color: "var(--admin-text)" }}>Notas</h3>
              </div>
              <div className="px-6 py-5"><p className="text-sm whitespace-pre-wrap" style={{ color: "var(--admin-muted)" }}>{receipt.notes}</p></div>
            </div>
          )}
        </div>

        {/* FactBox */}
        <div className="w-full lg:w-72 shrink-0 space-y-4">
          <div className="rounded-xl p-5 space-y-5" style={{ background: "var(--admin-surface)", border: "1px solid var(--admin-border)" }}>
            <FactBoxSection title="Resumen">
              <FactBoxRow label="Lineas" value={String(receipt.items.length)} />
              <FactBoxRow label="Cantidad total" value={`${totalQty} u`} />
              <FactBoxRow label="Total" value={money(totalReceipt, currency)} bold />
            </FactBoxSection>
            {receipt.order && (
              <FactBoxSection title="Origen">
                <FactBoxRow label="Pedido" value={receipt.order.number} color="var(--admin-primary)" />
              </FactBoxSection>
            )}
            <FactBoxSection title="Registro">
              <FactBoxRow label="Fecha" value={dateLabel(receipt.receivedAt)} />
              {receipt.createdBy && <FactBoxRow label="Usuario" value={receipt.createdBy.name} />}
              <FactBoxRow label="Sucursal" value={receipt.branch.name} />
            </FactBoxSection>
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--admin-muted)" }}>{label}</p><p className="text-sm font-bold" style={{ color: "var(--admin-text)" }}>{value}</p></div>;
}

function FactBoxSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><p className="text-[10px] font-bold uppercase tracking-wider mb-2.5 pb-2" style={{ color: "var(--admin-muted)", borderBottom: "1px solid var(--admin-border)" }}>{title}</p><div className="space-y-2.5">{children}</div></div>;
}

function FactBoxRow({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return <div className="flex items-center justify-between text-xs gap-2"><span className="truncate" style={{ color: "var(--admin-muted)" }}>{label}</span><span className={`tabular-nums whitespace-nowrap ${bold ? "font-extrabold" : "font-semibold"}`} style={{ color: color || "var(--admin-text)" }}>{value}</span></div>;
}
