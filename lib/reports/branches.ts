import { prisma } from "@/lib/prisma";
import type { Period, ReportFilters, BranchComparisonItem } from "./index";

/** @summary Comparativa de ventas por sucursal. */
export async function computeBranchComparison(
  tenantId: number,
  period: Period,
  filters: ReportFilters,
  accessibleBranchIds?: number[],
): Promise<BranchComparisonItem[]> {
  const branchFilter = accessibleBranchIds && accessibleBranchIds.length > 0
    ? { branchId: { in: accessibleBranchIds } }
    : filters.branchId && filters.branchId > 0
      ? { branchId: filters.branchId }
      : {};

  const orders = await prisma.customerOrder.findMany({
    where: {
      tenantId,
      status: { not: "cancelled" as const },
      createdAt: { gte: period.from, lte: period.to },
      ...branchFilter,
    },
    select: {
      branchId: true,
      branch: { select: { id: true, name: true } },
      total: true,
      discount: true,
      channel: true,
    },
  });

  const grouped = new Map<number, { name: string; total: number; discount: number; count: number; byChannel: Record<string, number> }>();
  let grandTotal = 0;

  for (const order of orders) {
    if (!order.branch) continue;
    const bid = order.branch.id;
    const current = grouped.get(bid) || { name: order.branch.name, total: 0, discount: 0, count: 0, byChannel: {} };
    current.total += Number(order.total);
    current.discount += Number(order.discount);
    current.count += 1;
    current.byChannel[order.channel] = (current.byChannel[order.channel] || 0) + Number(order.total);
    grouped.set(bid, current);
    grandTotal += Number(order.total);
  }

  return [...grouped.entries()]
    .map(([branchId, values]) => ({
      branchId,
      branchName: values.name,
      netSales: values.total - values.discount,
      orderCount: values.count,
      averageTicket: values.count > 0 ? (values.total - values.discount) / values.count : 0,
      discounts: values.discount,
      participation: grandTotal > 0 ? ((values.total - values.discount) / grandTotal) * 100 : 0,
      byChannel: values.byChannel,
    }))
    .sort((a, b) => b.netSales - a.netSales);
}
