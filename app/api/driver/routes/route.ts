import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/format";
import { canRouteTransition } from "@/lib/delivery-route-state";

/**
 * @summary GET: Devuelve el recorrido activo (si existe) y el historial reciente del repartidor.
 * El repartidor solo ve sus propios recorridos.
 */
export async function GET() {
  const auth = await authorize();
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const driverProfile = await prisma.driverProfile.findFirst({
    where: { tenantId: auth.tenant.id, userId: auth.session.userId },
  });
  if (!driverProfile) {
    return NextResponse.json({ error: "No tenés un perfil de repartidor vinculado" }, { status: 403 });
  }

  const activeRoute = await prisma.deliveryRoute.findFirst({
    where: {
      tenantId: auth.tenant.id,
      driverProfileId: driverProfile.id,
      status: { in: ["PREPARING", "IN_PROGRESS"] },
    },
    include: {
      deliveries: {
        include: {
          order: {
            select: {
              id: true,
              reference: true,
              status: true,
              customerName: true,
              phone: true,
              deliveryAddress: true,
              notes: true,
              total: true,
              currency: true,
              requestedAt: true,
            },
          },
          branch: {
            select: {
              id: true,
              name: true,
              address: true,
              phone: true,
              latitude: true,
              longitude: true,
            },
          },
          items: {
            select: {
              id: true,
              productName: true,
              quantityDelivered: true,
              unitPrice: true,
              notes: true,
            },
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

  const recentHistory = await prisma.deliveryRoute.findMany({
    where: {
      tenantId: auth.tenant.id,
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
    take: 20,
  });

  return NextResponse.json({
    activeRoute: activeRoute ? serialize(activeRoute) : null,
    history: serialize(recentHistory),
  });
}

/**
 * @summary POST: Crea un nuevo recorrido asignando automáticamente las entregas pendientes del repartidor.
 * Si ya existe un recorrido activo, devuelve ese en lugar de crear uno nuevo.
 */
export async function POST() {
  const auth = await authorize();
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const driverProfile = await prisma.driverProfile.findFirst({
    where: { tenantId: auth.tenant.id, userId: auth.session.userId, active: true },
  });
  if (!driverProfile) {
    return NextResponse.json({ error: "No tenés un perfil de repartidor activo vinculado" }, { status: 403 });
  }

  // Verificar si ya hay un recorrido activo
  const existingActive = await prisma.deliveryRoute.findFirst({
    where: {
      tenantId: auth.tenant.id,
      driverProfileId: driverProfile.id,
      status: { in: ["PREPARING", "IN_PROGRESS"] },
    },
  });
  if (existingActive) {
    return NextResponse.json({ route: serialize(existingActive), existing: true });
  }

  // Buscar entregas pendientes del repartidor
  const pendingDeliveries = await prisma.orderDelivery.findMany({
    where: {
      tenantId: auth.tenant.id,
      driverProfileId: driverProfile.id,
      status: { in: ["ASSIGNED", "PICKED_UP", "ON_THE_WAY"] },
    },
    orderBy: { createdAt: "asc" as const },
  });

  if (pendingDeliveries.length === 0) {
    return NextResponse.json({ error: "No tenés entregas pendientes para iniciar un recorrido" }, { status: 400 });
  }

  // Determinar branchId: usar la branch de la primera entrega
  const branchId = pendingDeliveries[0]?.branchId ?? null;

  const route = await prisma.$transaction(async (tx) => {
    const newRoute = await tx.deliveryRoute.create({
      data: {
        tenantId: auth.tenant.id,
        driverProfileId: driverProfile.id,
        branchId,
        status: "IN_PROGRESS",
        startedAt: new Date(),
        totalStops: pendingDeliveries.length,
      },
    });

    // Asignar entregas al recorrido con orden
    await Promise.all(
      pendingDeliveries.map((delivery, index) =>
        tx.orderDelivery.update({
          where: { id: delivery.id },
          data: {
            routeId: newRoute.id,
            routeOrder: index + 1,
          },
        })
      )
    );

    return newRoute;
  });

  return NextResponse.json({ route: serialize(route) });
}
