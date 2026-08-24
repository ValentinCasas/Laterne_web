import { requireDriver } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/format";
import { DriverRouteHistory } from "@/components/driver/route-history";

export const dynamic = "force-dynamic";

/** @summary Historial de recorridos del repartidor con filtros, paginación y enlaces al detalle. */
export default async function RouteHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; days?: string; from?: string; to?: string }>;
}) {
  const context = await requireDriver();
  const params = await searchParams;
  const driverProfile = await prisma.driverProfile.findFirst({
    where: { tenantId: context.tenant.id, userId: context.session.userId },
  });

  if (!driverProfile) {
    return (
      <div className="rounded-3xl border border-white/10 bg-zinc-900 p-6 text-center">
        <h1 className="text-lg font-black">Sin perfil de repartidor</h1>
      </div>
    );
  }

  // Parse filters
  const page = Math.max(1, Number(params.page) || 1);
  const statusFilter = params.status || "all";
  const daysFilter = params.days || "all";

  // Date range
  const now = new Date();
  let dateFrom: Date | undefined;
  let dateTo: Date | undefined;

  if (daysFilter === "today") {
    dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    dateTo = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  } else if (daysFilter === "7") {
    dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (daysFilter === "30") {
    dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  } else if (params.from) {
    const parsed = new Date(params.from);
    if (!isNaN(parsed.getTime())) dateFrom = parsed;
    if (params.to) {
      const parsedTo = new Date(params.to);
      if (!isNaN(parsedTo.getTime())) dateTo = new Date(parsedTo.getTime() + 24 * 60 * 60 * 1000);
    }
  }

  // Build where clause
  const where: Record<string, unknown> = {
    tenantId: context.tenant.id,
    driverProfileId: driverProfile.id,
  };

  if (statusFilter === "completed") {
    where.status = "COMPLETED";
  } else if (statusFilter === "cancelled") {
    where.status = "CANCELLED";
  } else if (statusFilter === "incidents") {
    where.incidentCount = { gt: 0 };
  } else {
    where.status = { in: ["COMPLETED", "CANCELLED"] };
  }

  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) (where.createdAt as Record<string, Date>).gte = dateFrom;
    if (dateTo) (where.createdAt as Record<string, Date>).lt = dateTo;
  }

  const pageSize = 25;
  const [total, history] = await Promise.all([
    prisma.deliveryRoute.count({ where }),
    prisma.deliveryRoute.findMany({
      where,
      select: {
        id: true,
        status: true,
        startedAt: true,
        completedAt: true,
        cancelledAt: true,
        totalStops: true,
        completedStops: true,
        incidentCount: true,
        totalDistanceM: true,
        totalDurationS: true,
        createdAt: true,
        branch: { select: { id: true, name: true } },
        deliveries: {
          select: {
            status: true,
            incidents: { select: { resolved: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" as const },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Today stats
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const [completedToday, routesToday, totalIncidents] = await Promise.all([
    prisma.orderDelivery.count({
      where: {
        tenantId: context.tenant.id,
        driverProfileId: driverProfile.id,
        status: "DELIVERED",
        deliveredAt: { gte: todayStart },
      },
    }),
    prisma.deliveryRoute.count({
      where: {
        tenantId: context.tenant.id,
        driverProfileId: driverProfile.id,
        status: "COMPLETED",
        completedAt: { gte: todayStart },
      },
    }),
    prisma.driverIncident.count({
      where: {
        tenantId: context.tenant.id,
        driverId: driverProfile.id,
        resolved: false,
      },
    }),
  ]);

  return (
    <DriverRouteHistory
      stats={{ completedToday, routesToday, totalIncidents }}
      history={serialize(history)}
      currentPage={page}
      totalPages={totalPages}
      totalCount={total}
      filters={{ status: statusFilter, days: daysFilter }}
      tenantSlug={context.tenant.slug}
      tenantGuid={context.tenant.publicGuid}
    />
  );
}
