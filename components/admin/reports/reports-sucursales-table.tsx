"use client";

import { ReportsTable } from "./reports-table";
import type { BranchComparisonItem } from "@/lib/reports";

/** @summary Wrapper Client Component para la tabla de sucursales (sin paginación). */
export function ReportsSucursalesTable({
  branches,
}: {
  branches: BranchComparisonItem[];
}) {
  return (
    <ReportsTable
      headers={["Sucursal", "Ventas netas", "Pedidos", "Ticket promedio", "Descuentos", "Participación"]}
      rows={branches}
      emptyMessage="No hay datos para este período."
      page={1}
      pageSize={branches.length}
      total={branches.length}
      onPageChange={() => {}}
      renderRow={(row: BranchComparisonItem) => (
        <tr key={row.branchId} className="hover:bg-white/[0.02]">
          <td className="px-5 py-3 font-medium">{row.branchName}</td>
          <td className="px-5 py-3 text-right font-black tabular-nums">{row.netSales.toLocaleString("es-AR")}</td>
          <td className="px-5 py-3 text-right tabular-nums">{row.orderCount}</td>
          <td className="px-5 py-3 text-right tabular-nums">{row.averageTicket.toLocaleString("es-AR")}</td>
          <td className="px-5 py-3 text-right text-red-300">{row.discounts.toLocaleString("es-AR")}</td>
          <td className="px-5 py-3 text-right tabular-nums">{row.participation.toFixed(1)}%</td>
        </tr>
      )}
    />
  );
}
