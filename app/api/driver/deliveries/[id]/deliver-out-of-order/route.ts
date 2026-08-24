import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/format";
import { deliveryStatusTimestamps } from "@/lib/delivery-drivers";
import { applyDeliveryStatusToOrder } from "@/lib/delivery-sync";

const deliverOutOfOrderInput = z.object({
  status: z.literal("DELIVERED"),
  confirmReorder: z.literal(true),
});

/**
 * @summary PATCH: Permite marcar como ENTREGADA una parada fuera del orden previsto.
 * Valida que la entrega pertenezca al repartidor y a un recorrido activo.
 * Reordena las paradas: la entregada toma el siguiente orden operativo,
 * las pendientes conservan su orden relativo. Conserva `plannedOrder` intacto.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize();
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const driverProfile = await prisma.driverProfile.findFirst({
    where: { tenantId: auth.tenant.id, userId: auth.session.userId, active: true },
  });
  if (!driverProfile) {
    return NextResponse.json({ error: "No tenés un perfil de repartidor activo vinculado" }, { status: 403 });
  }

  const deliveryId = Number((await context.params).id);
  if (!Number.isInteger(deliveryId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const parsed = deliverOutOfOrderInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Validar entrega pertenece al driver y está en un recorrido activo
      const current = await tx.orderDelivery.findFirst({
        where: {
          id: deliveryId,
          tenantId: auth.tenant.id,
          driverProfileId: driverProfile.id,
          status: { in: ["ASSIGNED", "PICKED_UP", "ON_THE_WAY"] },
        },
        select: {
          id: true,
          status: true,
          routeId: true,
          routeOrder: true,
          plannedOrder: true,
          orderId: true,
          order: { select: { status: true } },
        },
      });
      if (!current) throw new Error("NOT_MINE");
      if (!current.routeId) throw new Error("NO_ROUTE");

      // Obtener todas las entregas del recorrido ordenadas por routeOrder
      const routeDeliveries = await tx.orderDelivery.findMany({
        where: { routeId: current.routeId, tenantId: auth.tenant.id },
        select: { id: true, status: true, routeOrder: true, plannedOrder: true },
        orderBy: { routeOrder: "asc" },
      });

      // Encontrar la próxima parada pendiente (primera no DELIVERED por routeOrder)
      const nextPending = routeDeliveries.find((d) => d.status !== "DELIVERED");

      // Verificar que realmente está fuera de orden
      if (nextPending && nextPending.id === current.id) {
        // Es la parada esperada, no debería usarse este endpoint, pero lo permitimos
        // para simplificar el flujo (el cliente decide cuándo pedir confirmación)
      }

      // Marcar la entrega como ENTREGED
      await tx.orderDelivery.update({
        where: { id: deliveryId },
        data: {
          status: "DELIVERED",
          ...deliveryStatusTimestamps("DELIVERED"),
        },
      });

      // Registrar log de estado
      await tx.orderDeliveryStatusLog.create({
        data: {
          tenantId: auth.tenant.id,
          deliveryId,
          driverProfileId: driverProfile.id,
          status: "DELIVERED",
          previousStatus: current.status,
          reason: "Entrega fuera del orden previsto. Recorrido actualizado al orden real.",
          changedById: auth.session.userId,
        },
      });

      // Reordenar: la entregada toma el último orden de las entregadas + 1
      // Las pendientes conservan su orden relativo
      const deliveredCount = routeDeliveries.filter((d) => d.status === "DELIVERED").length;
      const newRouteOrder = deliveredCount + 1; // Posición siguiente a las ya entregadas

      await tx.orderDelivery.update({
        where: { id: deliveryId },
        data: { routeOrder: newRouteOrder },
      });

      // Reordenar las pendientes: asignar orden secuencial después de las entregadas
      const pendingDeliveries = routeDeliveries
        .filter((d) => d.status !== "DELIVERED" && d.id !== deliveryId)
        .sort((a, b) => (a.routeOrder ?? 0) - (b.routeOrder ?? 0));

      for (let i = 0; i < pendingDeliveries.length; i++) {
        await tx.orderDelivery.update({
          where: { id: pendingDeliveries[i]!.id },
          data: { routeOrder: newRouteOrder + i + 1 },
        });
      }

      // Actualizar progreso del recorrido
      const completedCount = await tx.orderDelivery.count({
        where: { routeId: current.routeId, status: "DELIVERED" },
      });

      const route = await tx.deliveryRoute.update({
        where: { id: current.routeId },
        data: { completedStops: completedCount },
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
              items: { select: { id: true, productName: true, quantityDelivered: true, unitPrice: true, notes: true } },
              incidents: { select: { id: true, type: true, description: true, resolved: true, reportedAt: true } },
              statusLogs: { select: { id: true, status: true, previousStatus: true, reason: true, changedAt: true }, orderBy: { changedAt: "asc" } },
            },
            orderBy: { routeOrder: "asc" },
          },
        },
      });

      // Sincronizar estado del pedido
      await applyDeliveryStatusToOrder(
        tx,
        {
          orderId: current.orderId,
          tenantId: auth.tenant.id,
          status: "DELIVERED",
          items: [],
        },
        { userId: auth.session.userId },
      );

      return { route, previousStatus: current.status, oldRouteOrder: current.routeOrder, newRouteOrder };
    });

    await recordAudit({
      context: auth,
      action: "delivery-out-of-order",
      entityType: "order-delivery",
      entityId: deliveryId,
      oldValues: toAuditValue({ status: result.previousStatus, routeOrder: result.oldRouteOrder }),
      newValues: toAuditValue({ status: "DELIVERED", routeOrder: result.newRouteOrder }),
      request,
    });

    return NextResponse.json({ route: serialize(result.route) });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_MINE") {
      return NextResponse.json({ error: "La entrega no está asignada a vos" }, { status: 400 });
    }
    if (error instanceof Error && error.message === "NO_ROUTE") {
      return NextResponse.json({ error: "La entrega no pertenece a un recorrido activo" }, { status: 400 });
    }
    return NextResponse.json({ error: "No se pudo procesar la entrega fuera de orden" }, { status: 500 });
  }
}
