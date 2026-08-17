import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { Period, ReportFilters, VentasKpis, EvolutionPoint } from "./index";
import { previousPeriod } from "./period";

/** @summary Filtro base de ventas: tenant, no canceladas y rango de fechas. */
export function salesWhere(tenantId: number, period: Period, filters: ReportFilters): Prisma.CustomerOrderWhereInput {
  const where: Record<string, unknown> = {
    tenantId,
    status: { not: "cancelled" },
    createdAt: { gte: period.from, lte: period.to },
    ...(filters.branchId && filters.branchId > 0 ? { branchId: filters.branchId } : {}),
    ...(filters.source ? { source: filters.source } : {}),
    ...(filters.paymentMethod ? { paymentMethod: filters.paymentMethod } : {}),
  };

  if (filters.channel) {
    where.channel = filters.channel;
  }

  if (filters.userId) {
    where.OR = [
      { tableSession: { waiterUserId: filters.userId } },
      { deliveries: { some: { createdById: filters.userId } } },
    ];
  }

  if (filters.categoryId) {
    where.items = {
      some: {
        product: {
          categories: {
            some: {
              categoryId: filters.categoryId,
              tenantId,
            },
          },
        },
      },
    };
  }

  if (filters.productId) {
    where.items = {
      some: {
        productId: filters.productId,
      },
    };
  }

  return where;
}

/** @summary Filtro para productos en ventas (usado en ranking). */
export function salesProductWhere(tenantId: number, period: Period, filters: ReportFilters): Prisma.OrderItemWhereInput {
  const where: Prisma.OrderItemWhereInput = {
    order: {
      tenantId,
      status: { not: "cancelled" },
      createdAt: { gte: period.from, lte: period.to },
      ...(filters.branchId && filters.branchId > 0 ? { branchId: filters.branchId } : {}),
    },
    ...(filters.productId ? { productId: filters.productId } : {}),
  };

  if (filters.categoryId) {
    where.product = {
      categories: {
        some: {
          categoryId: filters.categoryId,
          tenantId,
        },
      },
    };
  }

  return where;
}

/** @summary Calcula KPIs de ventas para el período actual y el anterior. */
export async function computeVentasKpis(
  tenantId: number,
  period: Period,
  filters: ReportFilters,
) {
  const prev = previousPeriod(period.from, period.to);

  const [current, previous] = await Promise.all([
    aggregateSales(tenantId, period, filters),
    aggregateSales(tenantId, prev, filters),
  ]);

  const netSalesChange = previous.netSales ? ((current.netSales - previous.netSales) / previous.netSales) * 100 : current.netSales ? 100 : 0;
  const orderCountChange = previous.orderCount ? ((current.orderCount - previous.orderCount) / previous.orderCount) * 100 : current.orderCount ? 100 : 0;

  return {
    ...current,
    previousNetSales: previous.netSales,
    previousOrderCount: previous.orderCount,
    previousAverageTicket: previous.averageTicket,
    netSalesChange,
    orderCountChange,
  } satisfies VentasKpis;
}

/** @summary Agregación base de ventas para un período. */
async function aggregateSales(tenantId: number, period: Period, filters: ReportFilters) {
  const where = salesWhere(tenantId, period, filters);
  const result = await prisma.customerOrder.aggregate({
    where: {
      ...where,
      status: { not: "cancelled" },
    },
    _sum: { total: true, discount: true },
    _count: { _all: true },
    _avg: { total: true },
  });

  const grossSales = Number(result._sum.total ?? 0);
  const discounts = Number(result._sum.discount ?? 0);
  const netSales = grossSales - discounts;
  const orderCount = result._count._all ?? 0;
  const averageTicket = orderCount > 0 ? netSales / orderCount : 0;

  return { grossSales, discounts, netSales, orderCount, averageTicket };
}

/** @summary Evolución temporal agregada por día (u hora para períodos cortos). */
export async function computeEvolution(
  tenantId: number,
  period: Period,
  filters: ReportFilters,
  granularity: "hour" | "day" | "week" | "month" = "day",
): Promise<EvolutionPoint[]> {
  const where = salesWhere(tenantId, period, filters);

  // Usamos groupBy con _sum y _count sobre createdAt
  const orders = await prisma.customerOrder.findMany({
    where: {
      ...where,
      status: { not: "cancelled" },
    },
    select: { createdAt: true, total: true, discount: true },
  });

  const grouped = new Map<string, { total: number; discount: number; count: number }>();
  for (const order of orders) {
    const date = new Date(order.createdAt);
    let key: string;
    if (granularity === "hour") {
      key = date.toISOString().slice(0, 13);
    } else if (granularity === "day") {
      key = date.toISOString().slice(0, 10);
    } else if (granularity === "week") {
      const weekStart = new Date(date);
      weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
      key = weekStart.toISOString().slice(0, 10);
    } else {
      key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    }

    const current = grouped.get(key) || { total: 0, discount: 0, count: 0 };
    grouped.set(key, {
      total: current.total + Number(order.total),
      discount: current.discount + Number(order.discount),
      count: current.count + 1,
    });
  }

  return [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({
      date,
      netSales: values.total - values.discount,
      orderCount: values.count,
    }));
}

/** @summary Ventas por día de la semana. */
export async function computeByWeekday(tenantId: number, period: Period, filters: ReportFilters) {
  const where = salesWhere(tenantId, period, filters);
  const orders = await prisma.customerOrder.findMany({
    where: { ...where, status: { not: "cancelled" } },
    select: { createdAt: true, total: true, discount: true },
  });

  const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const grouped = new Map<number, { total: number; discount: number; count: number }>();
  for (const order of orders) {
    const day = new Date(order.createdAt).getUTCDay();
    const current = grouped.get(day) || { total: 0, discount: 0, count: 0 };
    grouped.set(day, {
      total: current.total + Number(order.total),
      discount: current.discount + Number(order.discount),
      count: current.count + 1,
    });
  }

  return [...grouped.entries()]
    .sort(([a], [b]) => a - b)
    .map(([day, values]) => ({
      weekday: day,
      label: days[day],
      netSales: values.total - values.discount,
      orderCount: values.count,
    }));
}

/** @summary Ventas por hora del día. */
export async function computeByHour(tenantId: number, period: Period, filters: ReportFilters) {
  const where = salesWhere(tenantId, period, filters);
  const orders = await prisma.customerOrder.findMany({
    where: { ...where, status: { not: "cancelled" } },
    select: { createdAt: true, total: true, discount: true },
  });

  const grouped = new Map<number, { total: number; discount: number; count: number }>();
  for (const order of orders) {
    const hour = new Date(order.createdAt).getUTCHours();
    const current = grouped.get(hour) || { total: 0, discount: 0, count: 0 };
    grouped.set(hour, {
      total: current.total + Number(order.total),
      discount: current.discount + Number(order.discount),
      count: current.count + 1,
    });
  }

  return [...grouped.entries()]
    .sort(([a], [b]) => a - b)
    .map(([hour, values]) => ({
      hour,
      netSales: values.total - values.discount,
      orderCount: values.count,
    }));
}

/** @summary Ventas por medio de pago. */
export async function computeByPaymentMethod(tenantId: number, period: Period, filters: ReportFilters) {
  const where = salesWhere(tenantId, period, filters);
  const orders = await prisma.customerOrder.findMany({
    where: { ...where, status: { not: "cancelled" } },
    select: { paymentMethod: true, total: true, discount: true },
  });

  const grouped = new Map<string, { total: number; discount: number; count: number }>();
  for (const order of orders) {
    const method = order.paymentMethod || "Sin método";
    const current = grouped.get(method) || { total: 0, discount: 0, count: 0 };
    grouped.set(method, {
      total: current.total + Number(order.total),
      discount: current.discount + Number(order.discount),
      count: current.count + 1,
    });
  }

  return [...grouped.entries()].map(([method, values]) => ({
    method,
    netSales: values.total - values.discount,
    orderCount: values.count,
  }));
}

/** @summary Ventas por origen/canal. */
export async function computeByChannel(tenantId: number, period: Period, filters: ReportFilters) {
  const where = salesWhere(tenantId, period, filters);
  const orders = await prisma.customerOrder.findMany({
    where: { ...where, status: { not: "cancelled" } },
    select: { channel: true, total: true, discount: true },
  });

  const grouped = new Map<string, { total: number; discount: number; count: number }>();
  for (const order of orders) {
    const channel = order.channel || "Sin canal";
    const current = grouped.get(channel) || { total: 0, discount: 0, count: 0 };
    grouped.set(channel, {
      total: current.total + Number(order.total),
      discount: current.discount + Number(order.discount),
      count: current.count + 1,
    });
  }

  return [...grouped.entries()].map(([channel, values]) => ({
    channel,
    netSales: values.total - values.discount,
    orderCount: values.count,
  }));
}

/** @summary Ventas por source. */
export async function computeBySource(tenantId: number, period: Period, filters: ReportFilters) {
  const where = salesWhere(tenantId, period, filters);
  const orders = await prisma.customerOrder.findMany({
    where: { ...where, status: { not: "cancelled" } },
    select: { source: true, total: true, discount: true },
  });

  const grouped = new Map<string, { total: number; discount: number; count: number }>();
  for (const order of orders) {
    const source = order.source || "Sin fuente";
    const current = grouped.get(source) || { total: 0, discount: 0, count: 0 };
    grouped.set(source, {
      total: current.total + Number(order.total),
      discount: current.discount + Number(order.discount),
      count: current.count + 1,
    });
  }

  return [...grouped.entries()].map(([source, values]) => ({
    source,
    netSales: values.total - values.discount,
    orderCount: values.count,
  }));
}

/** @summary Cantidad de cancelaciones en el período. */
export async function computeCancellations(tenantId: number, period: Period, filters: ReportFilters) {
  const where: Prisma.CustomerOrderWhereInput = {
    tenantId,
    status: "cancelled",
    createdAt: { gte: period.from, lte: period.to },
    ...(filters.branchId && filters.branchId > 0 ? { branchId: filters.branchId } : {}),
  };

  return prisma.customerOrder.groupBy({
    by: ["status"],
    where,
    _count: { _all: true },
  });
}
