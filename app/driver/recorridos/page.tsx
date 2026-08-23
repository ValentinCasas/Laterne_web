import { requireDriver } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/format";
import { DriverRouteHistory } from "@/components/driver/route-history";

export const dynamic = "force-dynamic";

/** @summary Historial de recorridos del repartidor con métricas y detalle. */
export default async function RouteHistoryPage() {
  const context = await requireDriver();
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

  // History
  const history = await prisma.deliveryRoute.findMany({
    where: {
      tenantId: context.tenant.id,
      driverProfileId: driverProfile.id,
      status: { in: ["COMPLETED", "CANCELLED"] },
    },
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
    },
    orderBy: { createdAt: "desc" as const },
    take: 50,
  });

  return (
    <DriverRouteHistory
      stats={{ completedToday, routesToday, totalIncidents }}
      history={serialize(history)}
    />
  );
}
