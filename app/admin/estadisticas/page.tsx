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
  const events = await prisma.analyticsEvent.findMany({
    where: { tenantId: context.tenant.id, occurredAt: { gte: since } },
    select: { eventType: true, entityType: true, entityId: true },
    take: 100_000,
  });
  const counts = new Map<string, number>();
  const productActivity = new Map<number, { views: number; additions: number }>();
  for (const event of events) {
    counts.set(event.eventType, (counts.get(event.eventType) ?? 0) + 1);
    if (event.entityType === "product" && event.entityId) {
      const current = productActivity.get(event.entityId) ?? { views: 0, additions: 0 };
      if (event.eventType === "product.view") current.views += 1;
      if (event.eventType === "product.add") current.additions += 1;
      productActivity.set(event.entityId, current);
    }
  }
  const productIds = [...productActivity.keys()];
  const names = await prisma.product.findMany({
    where: { tenantId: context.tenant.id, id: { in: productIds } },
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
  return (
    <AnalyticsDashboard
      days={days}
      metrics={[...counts]
        .map(([eventType, count]) => ({ eventType, count }))
        .sort((left, right) => right.count - left.count)}
      products={products}
    />
  );
}
