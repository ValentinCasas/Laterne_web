"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminHrefFromPathname } from "@/lib/routes";
import { Icon } from "@/components/admin/ui/icons";

/** @summary Hook that builds tenant-aware admin hrefs from the current pathname. */
export function useAdminHref() {
  const pathname = usePathname();
  return (path: string) => adminHrefFromPathname(pathname, path);
}

/** @summary Breadcrumbs para el módulo de compras. */
export function ComprasBreadcrumbs({
  items,
}: {
  items: Array<{ label: string; href?: string }>;
}) {
  const href = useAdminHref();
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-[var(--admin-muted)]">
      <Link href={href("/admin/compras")} className="transition-colors hover:text-white">
        Compras
      </Link>
      {items.map((item, index) => (
        <span key={index} className="flex items-center gap-1.5">
          <span className="text-zinc-600">/</span>
          {item.href ? (
            <Link href={href(item.href) as never} className="transition-colors hover:text-white">
              {item.label}
            </Link>
          ) : (
            <span className="text-white font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

/** @summary Badge de estado con color correspondiente. */
export function StatusBadge({ status, labels }: { status: string; labels: Record<string, { label: string; color: string }> }) {
  const config = labels[status] ?? { label: status, color: "bg-zinc-500/15 text-zinc-300" };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-black ${config.color}`}>
      {config.label}
    </span>
  );
}

/** @summary Etiquetas de estado de pedido. */
export const ORDER_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "Borrador", color: "bg-zinc-500/15 text-zinc-300" },
  sent: { label: "Enviado", color: "bg-sky-500/15 text-sky-300" },
  partially_received: { label: "Recibido parcial", color: "bg-amber-500/15 text-amber-300" },
  received: { label: "Recibido", color: "bg-emerald-500/15 text-emerald-300" },
  closed: { label: "Cerrado", color: "bg-zinc-500/15 text-zinc-300" },
  cancelled: { label: "Cancelado", color: "bg-rose-500/15 text-rose-300" },
};

/** @summary Etiquetas de estado de factura. */
export const INVOICE_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "Borrador", color: "bg-zinc-500/15 text-zinc-300" },
  pending: { label: "Pendiente", color: "bg-amber-500/15 text-amber-300" },
  partially_paid: { label: "Parcialmente pagado", color: "bg-sky-500/15 text-sky-300" },
  paid: { label: "Pagado", color: "bg-emerald-500/15 text-emerald-300" },
  cancelled: { label: "Anulado", color: "bg-rose-500/15 text-rose-300" },
};

/** @summary Etiquetas de estado de proveedor. */
export const SUPPLIER_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: "Activo", color: "bg-emerald-500/15 text-emerald-300" },
  blocked: { label: "Bloqueado", color: "bg-rose-500/15 text-rose-300" },
  suspended: { label: "Suspendido", color: "bg-amber-500/15 text-amber-300" },
};

/** @summary Link clickeable a un documento de compra. */
export function DocLink({ number, path }: { number: string; path: string }) {
  const href = useAdminHref();
  return (
    <Link
      href={href(path) as never}
      className="font-black text-pink-300 hover:underline transition-colors"
    >
      {number}
    </Link>
  );
}

/** @summary Sección de documentos relacionados en un panel lateral. */
export function RelatedDocumentsPanel({
  receipts = [],
  invoices = [],
  order,
}: {
  receipts?: Array<{ id: number; number: string; receivedAt: string }>;
  invoices?: Array<{ id: number; number: string; status: string; total: number | string }>;
  order?: { id: number; number: string; status: string } | null;
}) {
  return (
    <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 space-y-4">
      <h3 className="text-xs font-black uppercase tracking-widest text-[var(--admin-muted)]">
        Documentos relacionados
      </h3>

      {order && (
        <div>
          <p className="text-[11px] font-semibold text-[var(--admin-muted)] mb-1">Pedido origen</p>
          <DocLink number={order.number} path={`/admin/compras/pedidos/${order.id}`} />
          <StatusBadge status={order.status} labels={ORDER_STATUS_LABELS} />
        </div>
      )}

      {receipts.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-[var(--admin-muted)] mb-1">
            Albaranes ({receipts.length})
          </p>
          <div className="space-y-1">
            {receipts.map((receipt) => (
              <DocLink key={receipt.id} number={receipt.number} path={`/admin/compras/albaranes/${receipt.id}`} />
            ))}
          </div>
        </div>
      )}

      {invoices.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-[var(--admin-muted)] mb-1">
            Facturas ({invoices.length})
          </p>
          <div className="space-y-1">
            {invoices.map((invoice) => (
              <DocLink key={invoice.id} number={invoice.number} path={`/admin/compras/facturas/${invoice.id}`} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
