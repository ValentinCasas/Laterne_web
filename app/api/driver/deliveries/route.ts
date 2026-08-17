import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/format";

/**
 * @summary Obtiene las entregas asignadas al repartidor autenticado.
 * Solo visible para el propio repartidor o admins con permiso.
 */
export async function GET() {
  const auth = await authorize("driver.self");
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
      order: { select: { id: true, reference: true, status: true, customerName: true, phone: true, email: true, deliveryAddress: true, notes: true } },
      items: { select: { id: true, productName: true, quantityDelivered: true, unitPrice: true, notes: true } },
      incidents: { select: { id: true, type: true, description: true, resolved: true, reportedAt: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const completedToday = await prisma.orderDelivery.findMany({
    where: {
      tenantId: auth.tenant.id,
      driverProfileId: driverProfile.id,
      status: "DELIVERED",
      createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    },
    include: {
      branch: { select: { id: true, name: true } },
      order: { select: { id: true, reference: true, customerName: true } },
    },
    orderBy: { deliveredAt: "desc" },
    take: 10,
  });

  return NextResponse.json({
    driver: serialize(driverProfile),
    activeDeliveries: serialize(activeDeliveries),
    completedToday: serialize(completedToday),
  });
}