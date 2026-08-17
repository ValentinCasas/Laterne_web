import { prisma } from "@/lib/prisma";
import type { Period, ReportFilters, ProductRankingItem } from "./index";
import { salesProductWhere } from "./sales";

/** @summary Ranking de productos por ventas en el período. */
export async function computeProductRanking(
  tenantId: number,
  period: Period,
  filters: ReportFilters,
  top = 10,
): Promise<{ ranking: ProductRankingItem[]; totalSales: number; topProductsShare: number }> {
  const where = salesProductWhere(tenantId, period, filters);

  const items = await prisma.orderItem.findMany({
    where,
    select: {
      productId: true,
      product: { select: { name: true } },
      quantity: true,
      lineTotal: true,
      costSnapshot: true,
    },
  });

  const grouped = new Map<number, { name: string; units: number; sales: number; cmv: number; costAvailable: boolean }>();
  let totalSales = 0;

  for (const item of items) {
    const pid = item.productId ?? 0;
    const current = grouped.get(pid) || { name: item.product?.name || "Sin nombre", units: 0, sales: 0, cmv: 0, costAvailable: false };
    current.units += item.quantity;
    current.sales += Number(item.lineTotal);
    if (item.costSnapshot !== null) {
      current.cmv += Number(item.costSnapshot) * item.quantity;
      current.costAvailable = true;
    }
    grouped.set(pid, current);
    totalSales += Number(item.lineTotal);
  }

  const ranking: ProductRankingItem[] = [...grouped.entries()]
    .sort((a, b) => b[1].sales - a[1].sales)
    .slice(0, top)
    .map(([productId, values]) => {
      const participation = totalSales > 0 ? (values.sales / totalSales) * 100 : 0;
      const cmvPercent = values.sales > 0 ? (values.cmv / values.sales) * 100 : null;
      const margin = values.sales - values.cmv;
      const marginPercent = values.sales > 0 ? (margin / values.sales) * 100 : null;
      const markup = values.cmv > 0 ? (values.sales / values.cmv) * 100 : null;

      return {
        productId,
        productName: values.name,
        units: values.units,
        sales: values.sales,
        participation,
        cmv: values.costAvailable ? values.cmv : null,
        cmvPercent,
        margin: values.costAvailable ? margin : null,
        marginPercent,
        markup,
        costAvailable: values.costAvailable,
      };
    });

  const topSales = ranking.reduce((sum, item) => sum + item.sales, 0);
  const topProductsShare = totalSales > 0 ? (topSales / totalSales) * 100 : 0;

  return { ranking, totalSales, topProductsShare };
}

/** @summary KPIs generales de productos. */
export async function computeProductKpis(
  tenantId: number,
  period: Period,
  filters: ReportFilters,
) {
  const { ranking, totalSales } = await computeProductRanking(tenantId, period, filters, 1000);
  const unitsSold = ranking.reduce((sum, item) => sum + item.units, 0);
  let cmvTotal = 0;
  let marginTotal = 0;

  for (const item of ranking) {
    if (item.costAvailable && item.cmv !== null) {
      cmvTotal += item.cmv;
      if (item.margin !== null) marginTotal += item.margin;
    }
  }

  return { unitsSold, totalSales, cmvTotal, marginTotal, topProductsShare: ranking.length > 0 ? ranking[0].participation : 0 };
}
