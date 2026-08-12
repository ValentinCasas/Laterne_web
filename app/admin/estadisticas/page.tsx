import { AnalyticsDashboard } from "@/components/admin/analytics-dashboard";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type AnalyticsPageProps = { searchParams: Promise<{ days?: string }> };

/** @summary Agrega eventos del negocio para construir el tablero analítico del período elegido. */
export default async function AdminAnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const context = await requirePermission("analytics.read");
  const requestedDays = Number((await searchParams).days ?? 30);
  const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 30;
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const previousSince = new Date(since);
  previousSince.setUTCDate(previousSince.getUTCDate() - days);
  const activeId = context.activeBranchId && context.activeBranchId > 0 ? context.activeBranchId : null;
  const branchScope = activeId ? { branchId: activeId } : { branchId: { in: context.branches.map((branch) => branch.id) } };
  const [events, orders, reservationCount, tenant] = await Promise.all([
    prisma.analyticsEvent.findMany({
      where: { tenantId: context.tenant.id, ...(activeId ? { branchId: activeId } : {}), occurredAt: { gte: since } },
      select: {
        eventType: true,
        entityType: true,
        entityId: true,
        metadata: true,
        occurredAt: true,
      },
      take: 100_000,
    }),
    prisma.customerOrder.findMany({
      where: { tenantId: context.tenant.id, ...branchScope, createdAt: { gte: previousSince } },
      select: { createdAt: true, status: true, total: true },
    }),
    prisma.reservation.count({
      where: { tenantId: context.tenant.id, ...branchScope, createdAt: { gte: since } },
    }),
    prisma.tenant.findUniqueOrThrow({
      where: { id: context.tenant.id },
      select: { defaultCurrency: true, locale: true, timeZone: true },
    }),
  ]);
  const counts = new Map<string, number>();
  const productActivity = new Map<number, { views: number; additions: number }>();
  const categoryActivity = new Map<number, number>();
  const devices = new Map<string, number>();
  const hours = new Map<number, number>();
  for (const event of events) {
    counts.set(event.eventType, (counts.get(event.eventType) ?? 0) + 1);
    const hour = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: tenant.timeZone,
        hour: "2-digit",
        hourCycle: "h23",
      }).format(event.occurredAt),
    );
    hours.set(hour, (hours.get(hour) ?? 0) + 1);
    const metadata = event.metadata as Record<string, unknown> | null;
    const device = typeof metadata?.device === "string" ? metadata.device : "sin identificar";
    devices.set(device, (devices.get(device) ?? 0) + 1);
    if (event.entityType === "product" && event.entityId) {
      const current = productActivity.get(event.entityId) ?? { views: 0, additions: 0 };
      if (event.eventType === "product.view") current.views += 1;
      if (event.eventType === "product.add") current.additions += 1;
      productActivity.set(event.entityId, current);
    }
    if (event.entityType === "category" && event.entityId) {
      categoryActivity.set(event.entityId, (categoryActivity.get(event.entityId) ?? 0) + 1);
    }
  }
  const productIds = [...productActivity.keys()];
  const names = await prisma.product.findMany({
    where: {
      tenantId: context.tenant.id,
      ...(activeId ? { branchAssignments: { some: { branchId: activeId } } } : {}),
      id: { in: productIds },
    },
    select: { id: true, name: true },
  });
  const products = names
    .map((product) => ({
      id: product.id,
      name: product.name,
      ...(productActivity.get(product.id) ?? { views: 0, additions: 0 }),
    }))
    .sort((left, right) => right.views + right.additions - left.views - left.additions)
    .slice(0, 12);
  const categoryNames = await prisma.category.findMany({
    where: { tenantId: context.tenant.id, ...(activeId ? { branchId: activeId } : {}), id: { in: [...categoryActivity.keys()] } },
    select: { id: true, name: true },
  });
  const currentOrders = orders.filter((order) => order.createdAt >= since);
  const previousOrders = orders.filter((order) => order.createdAt < since);
  /** @summary Excluye pedidos cancelados de los cálculos de venta y ticket promedio. */
  const billable = (collection: typeof orders) => collection.filter((order) => order.status !== "cancelled");
  const revenue = billable(currentOrders).reduce((sum, order) => sum + Number(order.total), 0);
  const previousRevenue = billable(previousOrders).reduce((sum, order) => sum + Number(order.total), 0);
  const orderStatus = [...new Set(currentOrders.map((order) => order.status))].map((status) => ({
    status,
    count: currentOrders.filter((order) => order.status === status).length,
  }));

  return (
    <AnalyticsDashboard
      days={days}
      metrics={[...counts]
        .map(([eventType, count]) => ({ eventType, count }))
        .sort((left, right) => right.count - left.count)}
      products={products}
      operations={{
        orders: currentOrders.length,
        previousOrders: previousOrders.length,
        revenue,
        previousRevenue,
        averageTicket: billable(currentOrders).length ? revenue / billable(currentOrders).length : 0,
        reservations: reservationCount,
        orderStatus,
        currency: tenant.defaultCurrency,
        locale: tenant.locale,
      }}
      activity={{
        devices: [...devices].map(([name, count]) => ({ name, count })),
        hours: [...hours]
          .map(([hour, count]) => ({ hour, count }))
          .sort((left, right) => right.count - left.count)
          .slice(0, 8),
        categories: categoryNames
          .map((category) => ({
            name: category.name,
            count: categoryActivity.get(category.id) ?? 0,
          }))
          .sort((left, right) => right.count - left.count)
          .slice(0, 8),
      }}
    />
  );
}
