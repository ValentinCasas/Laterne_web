import { DriverIncidentsPanel } from "@/components/driver/incidents";
import { requireDriver } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/format";

export const dynamic = "force-dynamic";

/** @summary Incidencias del repartidor autenticado: listado y reporte de nuevas. */
export default async function DriverIncidentsPage() {
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

  const [incidents, activeDeliveries] = await Promise.all([
    prisma.driverIncident.findMany({
      where: { tenantId: context.tenant.id, driverId: driverProfile.id },
      include: {
        delivery: { select: { id: true, number: true, customerName: true } },
      },
      orderBy: { reportedAt: "desc" },
      take: 50,
    }),
    prisma.orderDelivery.findMany({
      where: {
        tenantId: context.tenant.id,
        driverProfileId: driverProfile.id,
        status: { in: ["ASSIGNED", "PICKED_UP", "ON_THE_WAY"] },
      },
      select: { id: true, number: true, customerName: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <DriverIncidentsPanel
      incidents={serialize(incidents)}
      activeDeliveries={serialize(activeDeliveries)}
    />
  );
}