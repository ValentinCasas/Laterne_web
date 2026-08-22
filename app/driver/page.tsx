import { DriverDashboard } from "@/components/driver/dashboard";
import { requireDriver } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/format";

export const dynamic = "force-dynamic";

/** @summary Home operativo del repartidor con GPS persistente, jornada y entregas activas. */
export default async function DriverPage() {
  const context = await requireDriver();
  const driverProfile = await prisma.driverProfile.findFirst({
    where: { tenantId: context.tenant.id, userId: context.session.userId },
    include: {
      branches: { include: { branch: { select: { id: true, name: true, slug: true } } } },
    },
  });

  if (!driverProfile) {
    return (
      <div className="rounded-3xl border border-white/10 bg-zinc-900 p-6 text-center">
        <h1 className="text-lg font-black">Sin perfil de repartidor</h1>
        <p className="mt-2 text-sm text-zinc-400">Tu usuario no tiene un perfil de repartidor vinculado. Contactá a un administrador.</p>
      </div>
    );
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const [activeDeliveries, completedToday, activeIncidents, lastPosition] = await Promise.all([
    prisma.orderDelivery.findMany({
      where: { tenantId: context.tenant.id, driverProfileId: driverProfile.id, status: { in: ["ASSIGNED", "PICKED_UP", "ON_THE_WAY"] } },
      include: {
        branch: { select: { id: true, name: true, address: true, phone: true } },
        order: { select: { id: true, reference: true, status: true, customerName: true, phone: true, deliveryAddress: true, notes: true, total: true, currency: true, requestedAt: true } },
        items: { select: { id: true, productName: true, quantityDelivered: true, unitPrice: true, notes: true } },
        incidents: { select: { id: true, type: true, description: true, resolved: true, reportedAt: true } },
        statusLogs: { select: { id: true, status: true, previousStatus: true, reason: true, changedAt: true }, orderBy: { changedAt: "asc" } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.orderDelivery.findMany({
      where: { tenantId: context.tenant.id, driverProfileId: driverProfile.id, status: "DELIVERED", deliveredAt: { gte: todayStart } },
      select: { id: true, number: true, customerName: true, assignedAt: true, deliveredAt: true, order: { select: { reference: true } } },
      orderBy: { deliveredAt: "desc" },
    }),
    prisma.driverIncident.count({ where: { tenantId: context.tenant.id, driverId: driverProfile.id, resolved: false } }),
    prisma.driverPosition.findFirst({
      where: { tenantId: context.tenant.id, driverProfileId: driverProfile.id },
      select: { latitude: true, longitude: true, accuracy: true, recordedAt: true },
      orderBy: { recordedAt: "desc" },
    }),
  ]);

  const durations = completedToday.flatMap((delivery) => {
    if (!delivery.assignedAt || !delivery.deliveredAt) return [];
    return [(delivery.deliveredAt.getTime() - delivery.assignedAt.getTime()) / 60_000];
  }).filter((value) => value >= 0);
  const averageMinutes = durations.length > 0 ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : null;
  const serializedLastPosition = lastPosition
    ? {
        latitude: Number(lastPosition.latitude),
        longitude: Number(lastPosition.longitude),
        accuracy: lastPosition.accuracy === null ? null : Number(lastPosition.accuracy),
        recordedAt: lastPosition.recordedAt,
      }
    : null;

  return (
    <DriverDashboard
      driver={serialize(driverProfile)}
      initialDeliveries={serialize(activeDeliveries)}
      completedToday={serialize(completedToday)}
      averageMinutes={averageMinutes}
      incidents={activeIncidents}
      lastPosition={serialize(serializedLastPosition)}
    />
  );
}
