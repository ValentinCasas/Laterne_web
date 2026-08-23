import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/format";
import { deliveryStatusTimestamps, canRetireDelivery } from "@/lib/delivery-drivers";
import { applyDeliveryStatusToOrder } from "@/lib/delivery-sync";

const driverUpdateStatusInput = z.object({
  status: z.enum(["PICKED_UP", "ON_THE_WAY", "DELIVERED"]),
  note: z.string().trim().max(500).optional(),
});

/**
 * @summary Permite al repartidor avanzar su entrega en el flujo personal:
 * RETIRADO → EN CAMINO → ENTREGADO. Las incidencias se reportan por su propia ruta.
 * Registra el histórico con el timestamp real.
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

  const parsed = driverUpdateStatusInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });

  const { status, note } = parsed.data;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // El repartidor solo puede RETIRAR cuando el pedido ya está LISTO: la
      // cocina manda sobre la logística y el servidor lo garantiza.
      const current = await tx.orderDelivery.findFirst({
        where: { id: deliveryId, tenantId: auth.tenant.id, driverProfileId: driverProfile.id },
        select: { status: true, order: { select: { status: true } } },
      });
      if (!current) throw new Error("NOT_MINE");
      if (status === "PICKED_UP" && !canRetireDelivery(current.order?.status)) {
        throw new Error("NOT_READY");
      }

      // Compra optimista: solo avanza si la entrega sigue asignada a este repartidor
      // y en el estado previo correcto.
      const change = await tx.orderDelivery.updateMany({
        where: {
          id: deliveryId,
          tenantId: auth.tenant.id,
          driverProfileId: driverProfile.id,
          status: { in: ["ASSIGNED", "PICKED_UP", "ON_THE_WAY"] },
        },
        data: {
          status,
          ...deliveryStatusTimestamps(status),
          ...(note ? { notes: note } : {}),
        },
      });
      if (change.count !== 1) {
        const currentDelivery = await tx.orderDelivery.findFirst({
          where: { id: deliveryId, tenantId: auth.tenant.id },
          select: { status: true, driverProfileId: true },
        });
        if (!currentDelivery || currentDelivery.driverProfileId !== driverProfile.id) {
          throw new Error("NOT_MINE");
        }
        throw new Error("INVALID_TRANSITION");
      }

      const reloaded = await tx.orderDelivery.findFirstOrThrow({
        where: { id: deliveryId, tenantId: auth.tenant.id },
        include: {
          branch: { select: { id: true, name: true } },
          order: { select: { id: true, reference: true, customerName: true } },
          driverProfile: { select: { id: true, name: true } },
          items: { select: { orderItemId: true, quantityDelivered: true } },
        },
      });

      await tx.orderDeliveryStatusLog.create({
        data: {
          tenantId: auth.tenant.id,
          deliveryId,
          driverProfileId: driverProfile.id,
          status: reloaded.status,
          previousStatus: currentStatusFor(reloaded),
          reason: note ?? null,
          changedById: auth.session.userId,
        },
      });

      // El ciclo logístico coordina el ciclo del pedido: EN CAMINO y ENTREGADO
      // se reflejan en el estado del pedido dentro de la misma transacción.
      if (reloaded.status === "ON_THE_WAY" || reloaded.status === "DELIVERED") {
        await applyDeliveryStatusToOrder(
          tx,
          {
            orderId: reloaded.orderId,
            tenantId: reloaded.tenantId,
            status: reloaded.status,
            items: reloaded.items,
          },
          { userId: auth.session.userId },
        );
      }

      // Sincronizar progreso del recorrido si la entrega pertenece a uno
      if (reloaded.status === "DELIVERED" && reloaded.routeId) {
        const completedCount = await tx.orderDelivery.count({
          where: { routeId: reloaded.routeId, status: "DELIVERED" },
        });
        await tx.deliveryRoute.update({
          where: { id: reloaded.routeId },
          data: { completedStops: completedCount },
        });
      }

      return reloaded;
    });

    await recordAudit({
      context: auth,
      action: "delivery-driver-status-update",
      entityType: "order-delivery",
      entityId: deliveryId,
      newValues: toAuditValue(updated),
      request,
    });

    return NextResponse.json({ delivery: serialize(updated) });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_READY") {
      return NextResponse.json({ error: "El pedido todavía no está listo para retirar." }, { status: 409 });
    }
    if (error instanceof Error && (error.message === "INVALID_TRANSITION" || error.message === "NOT_MINE")) {
      return NextResponse.json(
        { error: error.message === "NOT_MINE" ? "La entrega no está asignada a vos" : "No podés saltar pasos: avanzá en orden" },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "No se pudo actualizar la entrega" }, { status: 500 });
  }
}

/** @summary Devuelve el estado anterior basado en el estado actual del flujo personal. */
function currentStatusFor(delivery: { status: string }) {
  if (delivery.status === "PICKED_UP") return "ASSIGNED";
  if (delivery.status === "ON_THE_WAY") return "PICKED_UP";
  if (delivery.status === "DELIVERED") return "ON_THE_WAY";
  return delivery.status;
}

const editAddressInput = z.object({
  deliveryAddress: z.string().trim().min(1).max(500),
  reference: z.string().trim().max(500).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

/**
 * @summary PUT: Permite al repartidor corregir la dirección/ubicación de una parada.
 * Solo aplica a entregas propias y que no estén completadas.
 * Registra auditoría del cambio.
 */
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize();
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const driverProfile = await prisma.driverProfile.findFirst({
    where: { tenantId: auth.tenant.id, userId: auth.session.userId, active: true },
  });
  if (!driverProfile) return NextResponse.json({ error: "No tenés un perfil de repartidor activo vinculado" }, { status: 403 });

  const deliveryId = Number((await context.params).id);
  if (!Number.isInteger(deliveryId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const parsed = editAddressInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });

  try {
    const current = await prisma.orderDelivery.findFirst({
      where: { id: deliveryId, tenantId: auth.tenant.id, driverProfileId: driverProfile.id },
      select: { status: true, deliveryAddress: true, addressSnapshot: true, latitude: true, longitude: true, notes: true },
    });
    if (!current) return NextResponse.json({ error: "La entrega no está asignada a vos" }, { status: 400 });
    if (current.status === "DELIVERED") return NextResponse.json({ error: "No podés editar una entrega ya completada" }, { status: 400 });

    const { deliveryAddress, reference, latitude, longitude } = parsed.data;

    const updateData: Record<string, unknown> = {
      deliveryAddress,
      addressSnapshot: deliveryAddress,
    };
    if (latitude !== undefined) updateData.latitude = String(latitude);
    if (longitude !== undefined) updateData.longitude = String(longitude);
    if (reference !== undefined) {
      // Update notes/reference if provided
      const existingNotes = current.notes ?? "";
      const refPrefix = "[Ref] ";
      const cleanNotes = existingNotes.replace(/^\[Ref\] .*$/m, "").trim();
      updateData.notes = reference ? `${refPrefix}${reference}${cleanNotes ? "\n" + cleanNotes : ""}` : cleanNotes || null;
    }

    const updated = await prisma.orderDelivery.update({
      where: { id: deliveryId },
      data: updateData,
    });

    await recordAudit({
      context: auth,
      action: "delivery-address-update",
      entityType: "order-delivery",
      entityId: deliveryId,
      oldValues: toAuditValue({ deliveryAddress: current.deliveryAddress, latitude: current.latitude, longitude: current.longitude }),
      newValues: toAuditValue({ deliveryAddress, latitude: latitude !== undefined ? String(latitude) : undefined, longitude: longitude !== undefined ? String(longitude) : undefined }),
      request,
    });

    return NextResponse.json({ delivery: serialize(updated) });
  } catch {
    return NextResponse.json({ error: "No se pudo actualizar la dirección" }, { status: 500 });
  }
}
