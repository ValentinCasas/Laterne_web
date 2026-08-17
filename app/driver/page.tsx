import { DriverActiveDeliveries } from "@/components/driver/active-deliveries";
import { DriverProfileCard } from "@/components/driver/profile-card";
import { requireDriver } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/format";

export const dynamic = "force-dynamic";

/** @summary Vista personal del repartidor: disponibilidad, entregas activas y resumen del día. */
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
      <div className="card p-6 text-center">
        <h1 className="text-lg font-black">Sin perfil de repartidor</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Tu usuario no tiene un perfil de repartidor vinculado. Contactá a un administrador.
        </p>
      </div>
    );
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [activeDeliveries, deliveredToday, completedToday] = await Promise.all([
    prisma.orderDelivery.findMany({
      where: {
        tenantId: context.tenant.id,
        driverProfileId: driverProfile.id,
        status: { in: ["ASSIGNED", "PICKED_UP", "ON_THE_WAY"] },
      },
      include: {
        branch: { select: { id: true, name: true, address: true, phone: true } },
        order: {
          select: {
            id: true,
            reference: true,
            status: true,
            customerName: true,
            phone: true,
            deliveryAddress: true,
            notes: true,
          },
        },
        items: { select: { id: true, productName: true, quantityDelivered: true, unitPrice: true, notes: true } },
        incidents: { select: { id: true, type: true, description: true, resolved: true, reportedAt: true } },
        statusLogs: { select: { status: true, previousStatus: true, changedAt: true }, orderBy: { changedAt: "asc" } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.orderDelivery.count({
      where: { tenantId: context.tenant.id, driverProfileId: driverProfile.id, status: "DELIVERED", createdAt: { gte: todayStart } },
    }),
    prisma.orderDelivery.findMany({
      where: { tenantId: context.tenant.id, driverProfileId: driverProfile.id, status: "DELIVERED", createdAt: { gte: todayStart } },
      select: { id: true, number: true, customerName: true, deliveredAt: true, order: { select: { reference: true } } },
      orderBy: { deliveredAt: "desc" },
      take: 10,
    }),
  ]);

  return (
    <div className="space-y-5">
      <DriverProfileCard driver={serialize(driverProfile)} deliveredToday={deliveredToday} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black">Mis entregas</h1>
        <span className="text-xs text-zinc-400">{activeDeliveries.length} activas</span>
      </div>
      <DriverActiveDeliveries deliveries={serialize(activeDeliveries)} />
      {completedToday.length > 0 && (
        <div className="card p-4">
          <p className="text-xs font-black uppercase tracking-widest text-zinc-500">Entregadas hoy</p>
          <ul className="mt-2 divide-y divide-white/5">
            {completedToday.map((delivery) => (
              <li key={delivery.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  <span className="font-bold text-white">{delivery.customerName}</span>
                  <span className="text-zinc-500"> · {delivery.order?.reference ?? delivery.number}</span>
                </span>
                <span className="text-emerald-300">Entregado</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}