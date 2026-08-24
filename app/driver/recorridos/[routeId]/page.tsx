import { notFound } from "next/navigation";
import { requireDriver } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/format";
import { DriverRouteDetail } from "@/components/driver/route-detail";

export const dynamic = "force-dynamic";

/** @summary Detalle histórico de un recorrido: mapa, paradas, timeline y métricas. */
export default async function RouteDetailPage({
  params,
}: {
  params: Promise<{ routeId: string }>;
}) {
  const context = await requireDriver();
  const { routeId } = await params;
  const id = Number(routeId);

  if (!Number.isInteger(id)) notFound();

  const driverProfile = await prisma.driverProfile.findFirst({
    where: { tenantId: context.tenant.id, userId: context.session.userId },
    select: { id: true, name: true },
  });

  if (!driverProfile) notFound();

  const route = await prisma.deliveryRoute.findFirst({
    where: {
      id,
      tenantId: context.tenant.id,
      driverProfileId: driverProfile.id,
    },
    include: {
      branch: { select: { id: true, name: true, address: true, latitude: true, longitude: true } },
      deliveries: {
        include: {
          order: {
            select: {
              id: true, reference: true, status: true, customerName: true,
              phone: true, deliveryAddress: true, notes: true, total: true,
              currency: true, requestedAt: true,
            },
          },
          items: { select: { id: true, productName: true, quantityDelivered: true, notes: true } },
          incidents: { select: { id: true, type: true, description: true, resolved: true, reportedAt: true } },
          statusLogs: { select: { id: true, status: true, previousStatus: true, reason: true, changedAt: true }, orderBy: { changedAt: "asc" } },
        },
        orderBy: { routeOrder: "asc" as const },
      },
    },
  });

  if (!route) notFound();

  return (
    <DriverRouteDetail
      route={serialize(route)}
      driverName={driverProfile.name}
      tenantSlug={context.tenant.slug}
      tenantGuid={context.tenant.publicGuid}
    />
  );
}
