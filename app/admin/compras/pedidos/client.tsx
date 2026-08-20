"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useMemo } from "react";
import { PageHeader, SearchBox } from "@/components/admin/ui";
import { Icon } from "@/components/admin/ui/icons";
import { dateLabel } from "@/lib/helpers";
import { adminHrefFromPathname } from "@/lib/routes";

type OrderRow = {
  id: number;
  number: string;
  status: string;
  orderDate: string;
  expectedDate?: string | null;
  externalReference?: string | null;
  supplier: { id: number; name: string };
  branch: { id: number; name: string };
  items: Array<{ quantity: string | number; receivedQuantity: string | number }>;
  createdBy?: { id: number; name: string } | null;
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-zinc-500/15 text-zinc-300",
  sent: "bg-sky-500/15 text-sky-300",
  partially_received: "bg-amber-500/15 text-amber-300",
  received: "bg-emerald-500/15 text-emerald-300",
  closed: "bg-zinc-500/15 text-zinc-300",
  cancelled: "bg-rose-500/15 text-rose-300",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  sent: "Enviado",
  partially_received: "Recibido parcial",
  received: "Recibido",
  closed: "Cerrado",
  cancelled: "Cancelado",
};

export function ComprasPedidosClient({
  initialOrders,
  total,
  suppliers,
}: {
  initialOrders: OrderRow[];
  total: number;
  suppliers: Array<{ id: number; name: string }>;
}) {
  const pathname = usePathname();
  const href = (path: string) => adminHrefFromPathname(pathname, path);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("es");
    return initialOrders.filter((order) => {
      if (statusFilter && order.status !== statusFilter) return false;
      if (supplierFilter && order.supplier.id !== Number(supplierFilter)) return false;
      if (q && !order.number.toLocaleLowerCase("es").includes(q) && !order.supplier.name.toLocaleLowerCase("es").includes(q)) return false;
      return true;
    });
  }, [initialOrders, query, statusFilter, supplierFilter]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Costos"
        title="Pedidos de compra"
        description="Gestioná los pedidos a proveedores"
        section="compras"
        actions={
          <Link href={href("/admin/compras/pedidos/nuevo") as never} className="btn">
            + Nuevo pedido
          </Link>
        }
      />

      <nav className="flex items-center gap-1.5 text-sm text-[var(--admin-muted)]">
        <Link href={href("/admin/compras")} className="transition-colors hover:text-white">Compras</Link>
        <span className="text-zinc-600">/</span>
        <span className="text-white font-medium">Pedidos de compra</span>
      </nav>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-2.5">
        <SearchBox value={query} onChange={setQuery} placeholder="Buscar por número o proveedor…" className="min-w-[220px] flex-1" />
        <select className="input w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select className="input w-auto" value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)}>
          <option value="">Todos los proveedores</option>
          {suppliers.map((s) => (
            <option key={s.id} value={String(s.id)}>{s.name}</option>
          ))}
        </select>
        <span className="ml-auto text-sm text-[var(--admin-muted)]">{filtered.length} resultados</span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/15 p-12 text-center">
          <Icon name="package" className="mx-auto text-4xl text-zinc-600" />
          <h3 className="mt-3 text-xl font-black">Todavía no hay pedidos</h3>
          <p className="mt-2 text-sm text-[var(--admin-muted)]">Creá el primero para pedir mercadería a un proveedor.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl shadow-black/10">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--admin-border)] bg-white/[0.02] text-xs uppercase tracking-wider text-[var(--admin-muted)]">
                  <th className="px-4 py-3">Pedido</th>
                  <th className="px-4 py-3">Proveedor</th>
                  <th className="px-4 py-3">Sucursal</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Recepción</th>
                  <th className="px-4 py-3">Facturación</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--admin-border)]/70">
                {filtered.map((order) => {
                  const totalItems = order.items.length;
                  const pendingReceipt = order.items.filter((item) => (Number(item.quantity) || 0) - (Number(item.receivedQuantity) || 0) > 0).length;
                  const receiptPct = totalItems > 0 ? Math.round(((totalItems - pendingReceipt) / totalItems) * 100) : 0;
                  return (
                    <tr key={order.id} className="transition-colors hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <Link href={href(`/admin/compras/pedidos/${order.id}`)} className="font-black text-pink-300 hover:underline">
                          {order.number}
                        </Link>
                        {order.externalReference && <p className="text-xs text-[var(--admin-muted)]">{order.externalReference}</p>}
                      </td>
                      <td className="px-4 py-3 font-semibold">{order.supplier.name}</td>
                      <td className="px-4 py-3 text-[var(--admin-muted)]">{order.branch.name}</td>
                      <td className="px-4 py-3 text-[var(--admin-muted)]">{dateLabel(order.orderDate)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 rounded-full bg-white/10">
                            <div className={`h-1.5 rounded-full ${receiptPct === 100 ? "bg-emerald-400" : receiptPct > 0 ? "bg-amber-400" : "bg-zinc-500"}`} style={{ width: `${receiptPct}%` }} />
                          </div>
                          <span className="text-xs text-[var(--admin-muted)]">{receiptPct}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[var(--admin-muted)]">—</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${STATUS_COLORS[order.status] ?? STATUS_COLORS.draft}`}>
                          {STATUS_LABELS[order.status] ?? order.status}
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
