import { prisma } from "@/lib/prisma";
import type { Period, ReportFilters, MenuEngineeringItem, MenuEngineeringSummary } from "./index";
import { salesProductWhere } from "./sales";
import { previousPeriod } from "./period";

/** @summary Umbrales de tendencia. */
const TREND_THRESHOLD = 0.05;

/** @summary Calcula la ingeniería de menú completa reutilizando datos de ventas. */
export async function computeMenuEngineering(
  tenantId: number,
  period: Period,
  filters: ReportFilters,
): Promise<{ items: MenuEngineeringItem[]; summary: MenuEngineeringSummary }> {
  const prev = previousPeriod(period.from, period.to);

  const [currentItems, previousItems] = await Promise.all([
    fetchProductMetrics(tenantId, period, filters),
    fetchProductMetrics(tenantId, prev, filters),
  ]);

  const currentMap = new Map(currentItems.map((item) => [item.productId, item]));
  const previousMap = new Map(previousItems.map((item) => [item.productId, item]));

  const allProductIds = new Set([...currentMap.keys(), ...previousMap.keys()]);
  const items: MenuEngineeringItem[] = [];

  for (const productId of allProductIds) {
    const current = currentMap.get(productId);
    const previous = previousMap.get(productId);

    if (!current && !previous) continue;

    const units = current?.units ?? 0;
    const sales = current?.sales ?? 0;
    const cmv = current?.cmv ?? null;
    const costAvailable = current?.costAvailable ?? previous?.costAvailable ?? false;
    const categoryName = current?.categoryName ?? previous?.categoryName ?? null;

    const previousUnits = previous?.units ?? 0;
    const previousSales = previous?.sales ?? 0;
    const previousMarginPercent = previous?.marginPercent ?? null;

    const currentMarginPercent = current?.marginPercent ?? null;
    const previousMarginForTrend = previousMarginPercent ?? currentMarginPercent ?? 0;

    const unitsTrend = trend(units, previousUnits);
    const salesTrend = trend(sales, previousSales);
    const marginTrend = trend(currentMarginPercent ?? 0, previousMarginForTrend);

    items.push({
      productId,
      productName: current?.productName ?? previous?.productName ?? "Sin nombre",
      categoryName,
      units,
      sales,
      cmv: costAvailable ? cmv : null,
      cmvPercent: costAvailable && sales > 0 ? (Number(cmv) / sales) * 100 : null,
      margin: costAvailable ? current?.margin ?? null : null,
      marginPercent: costAvailable ? currentMarginPercent : null,
      markup: costAvailable && cmv && Number(cmv) > 0 ? (sales / Number(cmv)) * 100 : null,
      costAvailable,
      previousUnits,
      previousSales,
      previousMarginPercent,
      unitsTrend,
      salesTrend,
      marginTrend,
      quadrant: "sin_datos" as MenuEngineeringItem["quadrant"],
      quadrantReason: "",
    });
  }

  const unitsValues = items.map((item) => item.units);
  const marginValues = items.filter((item) => item.marginPercent !== null).map((item) => item.marginPercent!);

  const popularityMedian = median(unitsValues);
  const marginMedian = marginValues.length > 0 ? median(marginValues) : 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const { quadrant, quadrantReason } = classifyQuadrant(item.units, item.marginPercent, item.costAvailable, popularityMedian, marginMedian);
    items[i] = { ...item, quadrant, quadrantReason };
  }

  const withCostData = items.filter((item) => item.costAvailable).length;
  const withoutCostData = items.length - withCostData;

  const quadrantDistribution: Record<string, number> = {};
  for (const item of items) {
    quadrantDistribution[item.quadrant] = (quadrantDistribution[item.quadrant] || 0) + 1;
  }

  const summary: MenuEngineeringSummary = {
    totalProducts: items.length,
    withCostData,
    withoutCostData,
    quadrantDistribution,
    popularityMedian,
    marginMedian,
  };

  return { items, summary };
}

/** @summary Obtiene métricas de productos para un período. */
async function fetchProductMetrics(
  tenantId: number,
  period: Period,
  filters: ReportFilters,
): Promise<
  Array<{
    productId: number;
    productName: string;
    categoryName: string | null;
    units: number;
    sales: number;
    cmv: number;
    margin: number;
    marginPercent: number | null;
    costAvailable: boolean;
  }>
> {
  const where = salesProductWhere(tenantId, period, filters);

  const orderItems = await prisma.orderItem.findMany({
    where,
    select: {
      productId: true,
      product: {
        select: {
          name: true,
          categories: {
            select: { category: { select: { name: true } } },
            where: { tenantId },
          },
        },
      },
      quantity: true,
      lineTotal: true,
      costSnapshot: true,
    },
  });

  const grouped = new Map<
    number,
    {
      name: string;
      categoryName: string | null;
      units: number;
      sales: number;
      cmv: number;
      costAvailable: boolean;
    }
  >();

  for (const item of orderItems) {
    const pid = item.productId ?? 0;
    const categoryName =
      item.product?.categories?.[0]?.category?.name ??
      null;

    const current = grouped.get(pid) || {
      name: item.product?.name || "Sin nombre",
      categoryName,
      units: 0,
      sales: 0,
      cmv: 0,
      costAvailable: false,
    };

    current.units += item.quantity;
    current.sales += Number(item.lineTotal);
    if (item.costSnapshot !== null) {
      current.cmv += Number(item.costSnapshot) * item.quantity;
      current.costAvailable = true;
    }

    if (!current.categoryName && categoryName) {
      current.categoryName = categoryName;
    }

    grouped.set(pid, current);
  }

  return [...grouped.entries()].map(([productId, values]) => {
    const margin = values.sales - values.cmv;
    const marginPercent = values.sales > 0 ? (margin / values.sales) * 100 : null;
    return {
      productId,
      productName: values.name,
      categoryName: values.categoryName,
      units: values.units,
      sales: values.sales,
      cmv: values.cmv,
      margin,
      marginPercent,
      costAvailable: values.costAvailable,
    };
  });
}

/** @summary Calcula la tendencia comparando valor actual vs anterior. */
function trend(current: number, previous: number): "up" | "down" | "stable" {
  if (previous === 0) return current > 0 ? "up" : "stable";
  const change = (current - previous) / previous;
  if (change > TREND_THRESHOLD) return "up";
  if (change < -TREND_THRESHOLD) return "down";
  return "stable";
}

/** @summary Clasifica un producto en un cuadrante de ingeniería de menú. */
function classifyQuadrant(
  units: number,
  marginPercent: number | null,
  costAvailable: boolean,
  popularityMedian: number,
  marginMedian: number,
): { quadrant: MenuEngineeringItem["quadrant"]; quadrantReason: string } {
  if (!costAvailable || marginPercent === null) {
    return {
      quadrant: "sin_datos",
      quadrantReason: "No hay costo histórico disponible para calcular el margen.",
    };
  }

  const altaPopularidad = units > popularityMedian;
  const altoMargen = marginPercent > marginMedian;

  if (altaPopularidad && altoMargen) {
    return {
      quadrant: "potenciar",
      quadrantReason: `Alta popularidad (${units} unidades) y margen del ${marginPercent.toFixed(1)}%.`,
    };
  }

  if (altaPopularidad && !altoMargen) {
    return {
      quadrant: "revisar",
      quadrantReason: `Alta popularidad (${units} unidades) pero margen del ${marginPercent.toFixed(1)}% por debajo de la mediana.`,
    };
  }

  if (!altaPopularidad && altoMargen) {
    return {
      quadrant: "promocionar",
      quadrantReason: `Baja popularidad (${units} unidades) pero margen del ${marginPercent.toFixed(1)}%.`,
    };
  }

  return {
    quadrant: "reformular",
    quadrantReason: `Baja popularidad (${units} unidades) y margen del ${marginPercent.toFixed(1)}% por debajo de la mediana.`,
  };
}

/** @summary Calcula la mediana de un array de números. */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
