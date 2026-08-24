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
 * Reordena las paradas: las entregadas forman el prefijo del recorrido real,
 * las pendientes conservan su orden relativo. Conserva `plannedOrder` intacto.
 * Usa actualización en dos fases para evitar colisiones de routeOrder.
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
      // 1. Validar entrega pertenece al driver y está en un recorrido activo
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
          orderId: true,
        },
      });
      if (!current) throw new Error("NOT_MINE");
      if (!current.routeId) throw new Error("NO_ROUTE");

      const routeId = current.routeId;

      // 2. Marcar la entrega como ENTREGED con timestamp
      await tx.orderDelivery.update({
        where: { id: deliveryId },
        data: {
          status: "DELIVERED",
          ...deliveryStatusTimestamps("DELIVERED"),
        },
      });

      // 3. Registrar log de estado
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

      // 4. Obtener TODAS las entregas del recorrido (ya con status actualizado)
      const allDeliveries = await tx.orderDelivery.findMany({
        where: { routeId, tenantId: auth.tenant.id },
        select: { id: true, status: true, routeOrder: true, deliveredAt: true },
        orderBy: { routeOrder: "asc" },
      });

      // 5. Separar en entregadas y pendientes
      const delivered = allDeliveries
        .filter((d) => d.status === "DELIVERED")
        .sort((a, b) => {
          // Ordenar por deliveredAt (timestamp de entrega), luego por routeOrder como fallback
          if (a.deliveredAt && b.deliveredAt) return a.deliveredAt.getTime() - b.deliveredAt.getTime();
          if (a.deliveredAt) return -1;
          if (b.deliveredAt) return 1;
          return (a.routeOrder ?? 0) - (b.routeOrder ?? 0);
        });

      const pending = allDeliveries
        .filter((d) => d.status !== "DELIVERED")
        .sort((a, b) => (a.routeOrder ?? 0) - (b.routeOrder ?? 0));

      // 6. Fase 1: Mover todos los routeOrder a valores temporales negativos para evitar colisiones
      const tempOffset = 100000;
      for (let i = 0; i < allDeliveries.length; i++) {
        await tx.orderDelivery.update({
          where: { id: allDeliveries[i]!.id },
          data: { routeOrder: tempOffset + i },
        });
      }

      // 7. Fase 2: Asignar routeOrder finales (1, 2, 3, ...)
      // Primero las entregadas, luego las pendientes
      const finalOrder = [...delivered, ...pending];
      for (let i = 0; i < finalOrder.length; i++) {
        await tx.orderDelivery.update({
          where: { id: finalOrder[i]!.id },
          data: { routeOrder: i + 1 },
        });
      }

      // 8. Actualizar progreso del recorrido
      const completedCount = delivered.length;

      const route = await tx.deliveryRoute.update({
        where: { id: routeId },
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

      // 9. Sincronizar estado del pedido
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

      return { route, previousStatus: current.status, oldRouteOrder: current.routeOrder };
    });

    await recordAudit({
      context: auth,
      action: "delivery-out-of-order",
      entityType: "order-delivery",
      entityId: deliveryId,
      oldValues: toAuditValue({ status: result.previousStatus, routeOrder: result.oldRouteOrder }),
      newValues: toAuditValue({ status: "DELIVERED" }),
      request,
    });

    return NextResponse.json({ route: serialize(result.route) });
  } catch (error) {
    // Log del error real para debugging en desarrollo
    console.error("[deliver-out-of-order] Error:", error);
    if (error instanceof Error && error.message === "NOT_MINE") {
      return NextResponse.json({ error: "La entrega no está asignada a vos" }, { status: 400 });
    }
    if (error instanceof Error && error.message === "NO_ROUTE") {
      return NextResponse.json({ error: "La entrega no pertenece a un recorrido activo" }, { status: 400 });
    }
    // Incluir el mensaje real del error en desarrollo
    const message = error instanceof Error ? error.message : "No se pudo procesar la entrega fuera de orden";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
