import { DriversList } from "@/components/admin/drivers/drivers-list";
import { requirePermission } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** @summary Maestro de repartidores con KPIs del día, listado, búsqueda y alta/edición. */
export default async function AdminDriversPage() {
  const context = await requirePermission("driver.view");

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const baseWhere = { tenantId: context.tenant.id };

  const [drivers, branches, users, kpis] = await Promise.all([
    prisma.driverProfile.findMany({
      where: baseWhere,
      include: {
        user: { select: { id: true, name: true, email: true } },
        branches: { include: { branch: { select: { id: true, name: true, slug: true } } } },
        _count: {
          select: {
            deliveries: { where: { status: { in: ["PENDING_ASSIGNMENT", "ASSIGNED", "PICKED_UP", "ON_THE_WAY"] } } },
            incidents: { where: { resolved: false } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.branch.findMany({ where: { tenantId: context.tenant.id, active: true }, select: { id: true, name: true, slug: true } }),
    prisma.user.findMany({
      where: { memberships: { some: { tenantId: context.tenant.id, status: "active" } } },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    Promise.all([
      prisma.orderDelivery.count({ where: { ...baseWhere, createdAt: { gte: todayStart } } }),
      prisma.orderDelivery.count({ where: { ...baseWhere, status: "PENDING_ASSIGNMENT" } }),
      prisma.orderDelivery.count({ where: { ...baseWhere, status: "ON_THE_WAY" } }),
      prisma.orderDelivery.count({ where: { ...baseWhere, status: "INCIDENT" } }),
      prisma.driverIncident.count({ where: { ...baseWhere, resolved: false } }),
      prisma.orderDelivery.findMany({
        where: { ...baseWhere, status: "DELIVERED", createdAt: { gte: todayStart } },
        select: { assignedAt: true, deliveredAt: true },
      }),
      prisma.orderDelivery.groupBy({
        by: ["driverProfileId"],
        where: { ...baseWhere, status: "DELIVERED", createdAt: { gte: todayStart }, driverProfileId: { not: null } },
        _count: { driverProfileId: true },
        orderBy: { _count: { driverProfileId: "desc" } },
        take: 5,
      }),
    ]),
  ]);

  const [deliveriesToday, pendingAssignment, onTheWay, incidentsToday, openIncidents, deliveredToday, topDriversGroup] = kpis;

  const completedTimes = deliveredToday
    .filter((d) => d.assignedAt && d.deliveredAt)
    .map((d) => (d.deliveredAt!.getTime() - d.assignedAt!.getTime()) / 60000);
  const avgMinutes =
    completedTimes.length > 0 ? Math.round(completedTimes.reduce((a, b) => a + b, 0) / completedTimes.length) : null;

  const topDrivers = topDriversGroup
    .filter((item) => item.driverProfileId !== null)
    .map((item) => ({ driverProfileId: item.driverProfileId as number, delivered: item._count.driverProfileId }));

  const driversWithStats = await Promise.all(
    drivers.map(async (driver) => {
      const [deliveriesTodayForDriver, activeDeliveries, completedDeliveries] = await Promise.all([
        prisma.orderDelivery.count({
          where: { tenantId: context.tenant.id, driverProfileId: driver.id, createdAt: { gte: todayStart } },
        }),
        prisma.orderDelivery.count({
          where: {
            tenantId: context.tenant.id,
            driverProfileId: driver.id,
            status: { in: ["PENDING_ASSIGNMENT", "ASSIGNED", "PICKED_UP", "ON_THE_WAY"] },
          },
        }),
        prisma.orderDelivery.findMany({
          where: { tenantId: context.tenant.id, driverProfileId: driver.id, status: "DELIVERED" },
          select: { assignedAt: true, pickedUpAt: true, deliveredAt: true },
          orderBy: { deliveredAt: "desc" },
          take: 200,
        }),
      ]);

      const times = completedDeliveries
        .filter((d) => d.assignedAt && d.deliveredAt)
        .map((d) => (d.deliveredAt!.getTime() - d.assignedAt!.getTime()) / 60000);
      const avgTotalMinutes = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

      const lastActivity = await prisma.orderDelivery.findFirst({
        where: { tenantId: context.tenant.id, driverProfileId: driver.id },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });

      return {
        ...driver,
        branches: driver.branches.map((db) => db.branch),
        activeDeliveriesCount: driver._count.deliveries,
        openIncidents: driver._count.incidents,
        deliveriesToday: deliveriesTodayForDriver,
        activeDeliveries,
        avgTotalMinutes,
        lastActivityAt: lastActivity?.createdAt ?? null,
      };
    }),
  );

  return (
    <DriversList
      initialDrivers={serialize(driversWithStats)}
      branches={serialize(branches)}
      users={serialize(users)}
      canManage={context.permissions.includes("driver.manage")}
      kpis={serialize({
        deliveriesToday,
        pendingAssignment,
        onTheWay,
        incidentsToday,
        openIncidents,
        avgMinutes,
        topDrivers,
      })}
    />
  );
}