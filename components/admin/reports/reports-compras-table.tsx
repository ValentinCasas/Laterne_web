"use client";

import type { Route } from "next";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ReportsTable } from "./reports-table";
import type { PurchaseItem } from "@/lib/reports";

/** @summary Wrapper Client Component para la tabla de compras con paginación URL-driven. */
export function ReportsComprasTable({
  items,
  page,
  pageSize,
  total,
}: {
  items: PurchaseItem[];
  page: number;
  pageSize: number;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handlePageChange(newPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(newPage));
    router.replace((`${pathname}?${params.toString()}`) as Route);
  }

  return (
    <ReportsTable
      headers={["Fecha", "Proveedor", "Documento", "Producto", "Cantidad", "Unidad", "Costo unitario", "Total", "Sucursal"]}
      rows={items}
      emptyMessage="No hay compras para este período."
      page={page}
      pageSize={pageSize}
      total={total}
      onPageChange={handlePageChange}
      renderRow={(row: PurchaseItem) => (
        <tr key={`${row.document}-${row.productName}-${row.date}`} className="hover:bg-white/[0.02]">
          <td className="px-5 py-3">{row.date}</td>
          <td className="px-5 py-3 font-medium">{row.supplierName}</td>
          <td className="px-5 py-3 font-mono text-xs">{row.document}</td>
          <td className="px-5 py-3">{row.productName}</td>
          <td className="px-5 py-3 text-right tabular-nums">{row.quantity}</td>
          <td className="px-5 py-3">{row.unit}</td>
          <td className="px-5 py-3 text-right tabular-nums">{row.unitCost.toLocaleString("es-AR")}</td>
          <td className="px-5 py-3 text-right font-black tabular-nums">{row.total.toLocaleString("es-AR")}</td>
          <td className="px-5 py-3">{row.branchName}</td>
        </tr>
      )}
    />
  );
}
