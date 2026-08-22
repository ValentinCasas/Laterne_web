import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/format";

/**
 * @summary Obtiene las entregas asignadas al repartidor autenticado.
 * Solo devuelve información del perfil vinculado al usuario autenticado.
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

  const activeDeliveries = await prisma.orderDelivery.findMany({
    where: {
      tenantId: auth.tenant.id,
      driverProfileId: driverProfile.id,
      status: { in: ["PENDING_ASSIGNMENT", "ASSIGNED", "PICKED_UP", "ON_THE_WAY"] },
    },
    include: {
      branch: { select: { id: true, name: true, slug: true, address: true, phone: true, latitude: true, longitude: true } },
      order: { select: { id: true, reference: true, status: true, customerName: true, phone: true, email: true, deliveryAddress: true, notes: true, total: true, currency: true, requestedAt: true } },
      items: { select: { id: true, productName: true, quantityDelivered: true, unitPrice: true, notes: true } },
      incidents: { select: { id: true, type: true, description: true, resolved: true, reportedAt: true } },
      statusLogs: { select: { id: true, status: true, previousStatus: true, reason: true, changedAt: true }, orderBy: { changedAt: "asc" } },
    },
    orderBy: { createdAt: "asc" },
  });

  const completedToday = await prisma.orderDelivery.findMany({
    where: {
      tenantId: auth.tenant.id,
      driverProfileId: driverProfile.id,
      status: "DELIVERED",
      deliveredAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    },
    include: {
      branch: { select: { id: true, name: true } },
      order: { select: { id: true, reference: true, customerName: true } },
    },
    orderBy: { deliveredAt: "desc" },
    take: 10,
  });
  const deliveredTodayCount = await prisma.orderDelivery.count({
    where: {
      tenantId: auth.tenant.id,
      driverProfileId: driverProfile.id,
      status: "DELIVERED",
      deliveredAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    },
  });

  return NextResponse.json({
    driver: serialize(driverProfile),
    activeDeliveries: serialize(activeDeliveries),
    completedToday: serialize(completedToday),
    deliveredTodayCount,
  });
}
