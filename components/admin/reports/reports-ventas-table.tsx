"use client";

import type { Route } from "next";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ReportsTable } from "./reports-table";
import type { OrderDetail } from "@/lib/reports";

/** @summary Wrapper Client Component para la tabla de ventas con paginación URL-driven. */
export function ReportsVentasTable({
  orders,
  page,
  pageSize,
  total,
}: {
  orders: OrderDetail[];
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
      headers={["Referencia", "Fecha", "Estado", "Tipo", "Canal", "Total", "Descuento", "Cliente", "Usuario"]}
      rows={orders}
      emptyMessage="No hay ventas para este período."
      page={page}
      pageSize={pageSize}
      total={total}
      onPageChange={handlePageChange}
      renderRow={(row: OrderDetail) => (
        <tr key={row.id} className="hover:bg-white/[0.02]">
          <td className="px-5 py-3 font-medium">{row.reference}</td>
          <td className="px-5 py-3">{new Date(row.createdAt).toLocaleString("es-AR")}</td>
          <td className="px-5 py-3 capitalize">{row.status.replaceAll("_", " ")}</td>
          <td className="px-5 py-3 capitalize">{row.orderType.replaceAll("_", " ")}</td>
          <td className="px-5 py-3 capitalize">{row.channel}</td>
          <td className="px-5 py-3 text-right font-black tabular-nums">{row.total.toLocaleString("es-AR")}</td>
          <td className="px-5 py-3 text-right text-red-300">{row.discount.toLocaleString("es-AR")}</td>
          <td className="px-5 py-3">{row.customerName}</td>
          <td className="px-5 py-3 text-zinc-400">{row.userName || "—"}</td>
        </tr>
      )}
    />
  );
}
