"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useMemo } from "react";
import { PageHeader, SearchBox } from "@/components/admin/ui";
import { Icon } from "@/components/admin/ui/icons";
import { dateLabel } from "@/lib/helpers";
import { adminHrefFromPathname } from "@/lib/routes";

type ReceiptRow = {
  id: number;
  number: string;
  receivedAt: string;
  notes?: string | null;
  supplier: { id: number; name: string };
  branch: { id: number; name: string };
  order?: { id: number; number: string } | null;
  items: Array<{ id: number; quantity: string | number; unit: string; unitCost: string | number; product?: { id: number; name: string } }>;
  createdBy?: { id: number; name: string } | null;
};

export function ComprasAlbaranesClient({
  initialReceipts,
  total,
}: {
  initialReceipts: ReceiptRow[];
  total: number;
}) {
  const pathname = usePathname();
  const href = (path: string) => adminHrefFromPathname(pathname, path);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("es");
    return initialReceipts.filter((r) => {
      if (q && !r.number.toLocaleLowerCase("es").includes(q) && !r.supplier.name.toLocaleLowerCase("es").includes(q)) return false;
      return true;
    });
  }, [initialReceipts, query]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Costos"
        title="Albaranes de compra registrados"
        description="Documentos históricos de recepción de mercadería"
        section="compras"
      />

      <nav className="flex items-center gap-1.5 text-sm text-[var(--admin-muted)]">
        <Link href={href("/admin/compras")} className="transition-colors hover:text-white">Compras</Link>
        <span className="text-zinc-600">/</span>
        <span className="text-white font-medium">Albaranes registrados</span>
      </nav>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-2.5 sm:p-2.5">
        <SearchBox value={query} onChange={setQuery} placeholder="Buscar por número o proveedor…" className="min-w-[200px] flex-1 sm:min-w-[220px]" />
        <span className="ml-auto text-sm text-[var(--admin-muted)] sm:text-sm">{filtered.length} resultados</span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/15 p-12 text-center">
          <Icon name="receipt" className="mx-auto text-4xl text-zinc-600" />
          <h3 className="mt-3 text-xl font-black">Todavía no hay albaranes</h3>
          <p className="mt-2 text-sm text-[var(--admin-muted)]">Los albaranes se generan al recibir mercadería de un pedido.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl shadow-black/10">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-base sm:text-sm">
              <thead>
                <tr className="border-b border-[var(--admin-border)] bg-white/[0.02] text-base uppercase tracking-wider text-[var(--admin-muted)] sm:text-xs sm:tracking-wider">
                  <th className="px-3 py-3 sm:px-4 sm:py-3">Albarán</th>
                  <th className="px-3 py-3 sm:px-4 sm:py-3">Proveedor</th>
                  <th className="px-3 py-3 sm:px-4 sm:py-3">Pedido origen</th>
                  <th className="px-3 py-3 sm:px-4 sm:py-3">Sucursal</th>
                  <th className="px-3 py-3 sm:px-4 sm:py-3">Fecha recepción</th>
                  <th className="px-3 py-3 sm:px-4 sm:py-3">Registrado por</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--admin-border)]/70">
                {filtered.map((receipt) => (
                  <tr key={receipt.id} className="transition-colors hover:bg-white/[0.02]">
                    <td className="px-3 py-3 sm:px-4 sm:py-3">
                      <Link href={href(`/admin/compras/albaranes/${receipt.id}`)} className="font-black text-pink-300 hover:underline text-base sm:text-sm">
                        {receipt.number}
                      </Link>
                    </td>
                    <td className="px-3 py-3 font-semibold text-base sm:text-sm sm:px-4 sm:py-3">{receipt.supplier.name}</td>
                    <td className="px-3 py-3 sm:px-4 sm:py-3">
                      {receipt.order ? (
                        <Link href={href(`/admin/compras/pedidos/${receipt.order.id}`)} className="text-pink-300 hover:underline font-bold text-base sm:text-sm">
                          {receipt.order.number}
                        </Link>
                      ) : (
                        <span className="text-[var(--admin-muted)]">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-[var(--admin-muted)] text-base sm:text-sm sm:px-4 sm:py-3">{receipt.branch.name}</td>
                    <td className="px-3 py-3 text-[var(--admin-muted)] text-base sm:text-sm sm:px-4 sm:py-3">{dateLabel(receipt.receivedAt)}</td>
                    <td className="px-3 py-3 text-[var(--admin-muted)] text-base sm:text-sm sm:px-4 sm:py-3">{receipt.createdBy?.name ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
