"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useMemo } from "react";
import { PageHeader, SearchBox } from "@/components/admin/ui";
import { Icon } from "@/components/admin/ui/icons";
import { dateLabel, money } from "@/lib/helpers";
import { adminHrefFromPathname } from "@/lib/routes";

type InvoiceRow = {
  id: number;
  number: string;
  status: string;
  documentDate: string;
  dueDate?: string | null;
  externalNumber?: string | null;
  supplier: { id: number; name: string };
  branch?: { id: number; name: string } | null;
  subtotal: string | number;
  taxAmount: string | number;
  total: string | number;
  paidAmount: string | number;
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-zinc-500/15 text-zinc-300",
  pending: "bg-amber-500/15 text-amber-300",
  partially_paid: "bg-sky-500/15 text-sky-300",
  paid: "bg-emerald-500/15 text-emerald-300",
  cancelled: "bg-rose-500/15 text-rose-300",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  pending: "Pendiente",
  partially_paid: "Parcialmente pagado",
  paid: "Pagado",
  cancelled: "Anulado",
};

export function ComprasFacturasClient({
  initialInvoices,
  total,
}: {
  initialInvoices: InvoiceRow[];
  total: number;
}) {
  const pathname = usePathname();
  const href = (path: string) => adminHrefFromPathname(pathname, path);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("es");
    return initialInvoices.filter((inv) => {
      if (statusFilter && inv.status !== statusFilter) return false;
      if (q && !inv.number.toLocaleLowerCase("es").includes(q) && !inv.supplier.name.toLocaleLowerCase("es").includes(q)) return false;
      return true;
    });
  }, [initialInvoices, query, statusFilter]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Costos"
        title="Facturas de compra"
        description="Documentos de compra y pagos a proveedores"
        section="compras"
      />

      <nav className="flex items-center gap-1.5 text-sm text-[var(--admin-muted)]">
        <Link href={href("/admin/compras")} className="transition-colors hover:text-white">Compras</Link>
        <span className="text-zinc-600">/</span>
        <span className="text-white font-medium">Facturas registradas</span>
      </nav>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-2.5">
        <SearchBox value={query} onChange={setQuery} placeholder="Buscar por número o proveedor…" className="min-w-[220px] flex-1" />
        <select className="input w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <span className="ml-auto text-sm text-[var(--admin-muted)]">{filtered.length} resultados</span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/15 p-12 text-center">
          <Icon name="receipt" className="mx-auto text-4xl text-zinc-600" />
          <h3 className="mt-3 text-xl font-black">Todavía no hay facturas</h3>
          <p className="mt-2 text-sm text-[var(--admin-muted)]">Creá una factura y vincúlala a las recepciones del proveedor.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl shadow-black/10">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--admin-border)] bg-white/[0.02] text-xs uppercase tracking-wider text-[var(--admin-muted)]">
                  <th className="px-4 py-3">Factura</th>
                  <th className="px-4 py-3">Proveedor</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Vencimiento</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Saldo</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--admin-border)]/70">
                {filtered.map((inv) => {
                  const balance = Number(inv.total) - Number(inv.paidAmount);
                  return (
                    <tr key={inv.id} className="transition-colors hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <Link href={href(`/admin/compras/facturas/${inv.id}`)} className="font-black text-pink-300 hover:underline">
                          {inv.number}
                        </Link>
                        {inv.externalNumber && <p className="text-xs text-[var(--admin-muted)]">Comp. {inv.externalNumber}</p>}
                      </td>
                      <td className="px-4 py-3 font-semibold">{inv.supplier.name}</td>
                      <td className="px-4 py-3 text-[var(--admin-muted)]">{dateLabel(inv.documentDate)}</td>
                      <td className="px-4 py-3 text-[var(--admin-muted)]">{dateLabel(inv.dueDate)}</td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums">{money(inv.total, "ARS")}</td>
                      <td className={`px-4 py-3 text-right font-bold tabular-nums ${balance > 0 ? "text-amber-300" : "text-emerald-300"}`}>
                        {money(balance, "ARS")}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${STATUS_COLORS[inv.status] ?? STATUS_COLORS.draft}`}>
                          {STATUS_LABELS[inv.status] ?? inv.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
