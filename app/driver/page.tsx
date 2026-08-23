import { DriverRoutePanel } from "@/components/driver/route-panel";
import { requireDriver } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/format";

export const dynamic = "force-dynamic";

/** @summary Home operativo del repartidor con recorrido, mapa, entregas y GPS. */
export default async function DriverPage() {
  const context = await requireDriver();
  const driverProfile = await prisma.driverProfile.findFirst({
    where: { tenantId: context.tenant.id, userId: context.session.userId },
  });

  if (!driverProfile) {
    return (
      <div className="rounded-3xl border border-white/10 bg-zinc-900 p-6 text-center">
        <h1 className="text-lg font-black">Sin perfil de repartidor</h1>
        <p className="mt-2 text-sm text-zinc-400">Tu usuario no tiene un perfil de repartidor vinculado. Contactá a un administrador.</p>
      </div>
    );
  }

  // Fetch active route with deliveries
  const activeRoute = await prisma.deliveryRoute.findFirst({
    where: {
      tenantId: context.tenant.id,
      driverProfileId: driverProfile.id,
      status: { in: ["PREPARING", "IN_PROGRESS"] },
    },
    include: {
      deliveries: {
        include: {
          order: {
            select: {
              id: true, reference: true, status: true, customerName: true,
              phone: true, deliveryAddress: true, notes: true, total: true,
              currency: true, requestedAt: true,
            },
          },
          branch: {
            select: { id: true, name: true, address: true, phone: true, latitude: true, longitude: true },
          },
          items: {
            select: { id: true, productName: true, quantityDelivered: true, unitPrice: true, notes: true },
          },
          incidents: {
            select: { id: true, type: true, description: true, resolved: true, reportedAt: true },
          },
          statusLogs: {
            select: { id: true, status: true, previousStatus: true, reason: true, changedAt: true },
            orderBy: { changedAt: "asc" as const },
          },
        },
        orderBy: { routeOrder: "asc" as const },
      },
    },
    orderBy: { createdAt: "desc" as const },
  });

  // GPS
  const lastPosition = await prisma.driverPosition.findFirst({
    where: { tenantId: context.tenant.id, driverProfileId: driverProfile.id },
    select: { latitude: true, longitude: true, accuracy: true, recordedAt: true },
    orderBy: { recordedAt: "desc" },
  });

  const serializedLastPosition = lastPosition
    ? {
        latitude: Number(lastPosition.latitude),
        longitude: Number(lastPosition.longitude),
        accuracy: lastPosition.accuracy === null ? null : Number(lastPosition.accuracy),
        recordedAt: lastPosition.recordedAt,
      }
    : null;

  return (
    <DriverRoutePanel
      initialRoute={activeRoute ? serialize(activeRoute) : null}
      lastPosition={serialize(serializedLastPosition)}
      gpsEnabled={driverProfile.locationSharingEnabled}
    />
  );
}
