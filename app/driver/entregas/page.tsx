import { DriverDeliveriesHistory } from "@/components/driver/deliveries-table";
import { requireDriver } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/format";

export const dynamic = "force-dynamic";

/** @summary Historial de entregas del repartidor autenticado. */
export default async function DriverDeliveriesPage() {
  const context = await requireDriver();

  const driverProfile = await prisma.driverProfile.findFirst({
    where: { tenantId: context.tenant.id, userId: context.session.userId },
    select: { id: true },
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

  const deliveries = await prisma.orderDelivery.findMany({
    where: { tenantId: context.tenant.id, driverProfileId: driverProfile.id },
    include: {
      branch: { select: { id: true, name: true } },
      order: { select: { id: true, reference: true, customerName: true } },
      incidents: { select: { id: true, type: true, resolved: true, reportedAt: true } },
      statusLogs: { select: { status: true, previousStatus: true, changedAt: true }, orderBy: { changedAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return <DriverDeliveriesHistory deliveries={serialize(deliveries)} />;
}