import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize, canAccessBranch } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/format";
import { deliveryStatusTimestamps } from "@/lib/delivery-drivers";

const updateDeliveryInput = z.object({
  status: z.enum(["PENDING_ASSIGNMENT", "ASSIGNED", "PICKED_UP", "ON_THE_WAY", "DELIVERED", "FAILED", "CANCELLED", "INCIDENT"]).optional(),
  driverId: z.coerce.number().int().positive().optional(),
  driverProfileId: z.coerce.number().int().positive().optional(),
  latitude: z.string().trim().max(32).optional(),
  longitude: z.string().trim().max(32).optional(),
  contactPhone: z.string().trim().max(60).optional(),
  contactName: z.string().trim().max(160).optional(),
  instructions: z.string().trim().max(1000).optional(),
  receiverName: z.string().trim().max(160).optional(),
  note: z.string().trim().max(500).optional(),
});

/** @summary Estados que no aceptan cambios de repartidor ni de estado posteriores. */
const FINAL_DELIVERY_STATUSES = new Set(["DELIVERED", "FAILED", "CANCELLED"]);

/**
 * @summary Actualiza una entrega: asigna/reasigna repartidor, cambia estado y registra
 * el histórico de estados con el timestamp real y quién lo hizo.
 * La asignación usa una comprobación optimista para evitar asignaciones simultáneas.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("order.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  const parsed = updateDeliveryInput.safeParse(await request.json().catch(() => null));
  if (!Number.isInteger(id) || !parsed.success)
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });

  const { status, driverId, driverProfileId, latitude, longitude, contactPhone, contactName, instructions, receiverName, note } =
    parsed.data;

  const delivery = await prisma.orderDelivery.findFirst({
    where: { id, tenantId: auth.tenant.id },
    include: { order: { select: { branchId: true, status: true } }, driverProfile: { select: { id: true, name: true } } },
  });
  if (!delivery) return NextResponse.json({ error: "Entrega no encontrada" }, { status: 404 });
  if (delivery.order.branchId && !canAccessBranch(auth, delivery.order.branchId)) {
    return NextResponse.json({ error: "No tenés acceso a la sucursal de este pedido" }, { status: 403 });
  }

  if (FINAL_DELIVERY_STATUSES.has(delivery.status) && status && status !== delivery.status) {
    return NextResponse.json({ error: "No se puede modificar una entrega finalizada" }, { status: 400 });
  }

  // Valida y resuelve el repartidor del maestro de perfiles (no de usuarios legados).
  let resolvedProfileId = delivery.driverProfileId;
  let resolvedUserId = delivery.driverId;
  if (driverProfileId !== undefined) {
    const profile = await prisma.driverProfile.findFirst({
      where: { id: driverProfileId, tenantId: auth.tenant.id, active: true },
      select: { id: true, name: true, userId: true, branches: { select: { branchId: true } } },
    });
    if (!profile) return NextResponse.json({ error: "Repartidor no encontrado o inactivo" }, { status: 404 });
    if (delivery.order.branchId) {
      const hasBranch = profile.branches.some((item) => item.branchId === delivery.order.branchId);
      if (!hasBranch) {
        return NextResponse.json({ error: "El repartidor no tiene habilitada la sucursal de la entrega" }, { status: 400 });
      }
    }
    resolvedProfileId = profile.id;
    resolvedUserId = profile.userId ?? null;
  } else if (driverId !== undefined) {
    const user = await prisma.user.findFirst({
      where: { id: driverId, memberships: { some: { tenantId: auth.tenant.id, status: "active" } } },
      select: { id: true },
    });
    if (!user) return NextResponse.json({ error: "Repartidor no encontrado" }, { status: 404 });
    resolvedUserId = user.id;
  }

  // Asignar un repartidor sin indicar estado implica pasar a ASIGNADO.
  const nextStatus = status ?? (resolvedProfileId ? "ASSIGNED" : undefined);
  if (nextStatus === "ASSIGNED" && !resolvedProfileId) {
    return NextResponse.json({ error: "Indicá un repartidor para asignar la entrega" }, { status: 400 });
  }

  const previousStatus = delivery.status;
  const previousProfileId = delivery.driverProfileId;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // Compra optimista: la entrega solo avanza si nadie la cambió en el interín.
      const guard: Record<string, unknown> = { id, tenantId: auth.tenant.id };
      if (nextStatus === "ASSIGNED") guard.status = previousStatus;
      const change = await tx.orderDelivery.updateMany({
        where: guard,
        data: {
          ...(nextStatus ? { status: nextStatus, ...deliveryStatusTimestamps(nextStatus) } : {}),
          ...(resolvedProfileId !== undefined ? { driverProfileId: resolvedProfileId } : {}),
          ...(resolvedUserId !== undefined ? { driverId: resolvedUserId } : {}),
          ...(latitude !== undefined ? { latitude } : {}),
          ...(longitude !== undefined ? { longitude } : {}),
          ...(contactPhone !== undefined ? { contactPhone } : {}),
          ...(contactName !== undefined ? { contactName } : {}),
          ...(instructions !== undefined ? { instructions } : {}),
          ...(receiverName !== undefined ? { receiverName } : {}),
        },
      });
      if (change.count !== 1) {
        throw new Error("CONCURRENT_CHANGE");
      }

      const reloaded = await tx.orderDelivery.findFirstOrThrow({
        where: { id, tenantId: auth.tenant.id },
        include: { driverProfile: { select: { id: true, name: true } }, driver: { select: { id: true, name: true } } },
      });

      // Historial de estados con timestamp real (asignación/reasignación/estado).
      if (nextStatus || resolvedProfileId !== undefined) {
        await tx.orderDeliveryStatusLog.create({
          data: {
            tenantId: auth.tenant.id,
            deliveryId: id,
            driverProfileId: reloaded.driverProfileId,
            status: reloaded.status,
            previousStatus,
            reason:
              resolvedProfileId !== undefined && previousProfileId !== resolvedProfileId
                ? `Asignado a ${reloaded.driverProfile?.name ?? "repartidor"}` +
                  (previousProfileId ? ` (reemplaza al repartidor anterior)` : "")
                : note ?? null,
            changedById: auth.session.userId,
          },
        });
      }

      return reloaded;
    });

    await recordAudit({
      context: auth,
      action: "delivery-update",
      entityType: "order-delivery",
      entityId: id,
      oldValues: toAuditValue({ ...delivery, status: delivery.status, driverProfileId: delivery.driverProfileId }),
      newValues: toAuditValue({ ...updated, status: updated.status, driverProfileId: updated.driverProfileId }),
      request,
    });

    return NextResponse.json({ delivery: serialize(updated) });
  } catch (error) {
    if (error instanceof Error && error.message === "CONCURRENT_CHANGE") {
      return NextResponse.json(
        { error: "La entrega cambió mientras se asignaba. Recargá la lista e intentá de nuevo." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "No se pudo actualizar la entrega" }, { status: 500 });
  }
}

/**
 * @summary Elimina una entrega en borrador (sino está en estados finales).
 */
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("order.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);

  const delivery = await prisma.orderDelivery.findFirst({
    where: { id, tenantId: auth.tenant.id },
    include: { order: { select: { branchId: true, status: true } }, items: true },
  });
  if (!delivery) return NextResponse.json({ error: "Entrega no encontrada" }, { status: 404 });
  if (["DELIVERED", "FAILED", "CANCELLED"].includes(delivery.status)) {
    return NextResponse.json({ error: "No se puede eliminar una entrega finalizada" }, { status: 400 });
  }

  await prisma.$transaction(async (transaction) => {
    for (const item of delivery.items) {
      const orderItem = await transaction.orderItem.findFirst({ where: { id: item.orderItemId } });
      if (!orderItem) continue;
      const newDelivered = Math.max(0, orderItem.deliveredQuantity - item.quantityDelivered);
      await transaction.orderItem.update({
        where: { id: item.orderItemId },
        data: { deliveredQuantity: newDelivered, pendingQuantity: orderItem.quantity - newDelivered },
      });
    }
    await transaction.orderDelivery.delete({ where: { id } });
  });

  await recordAudit({
    context: auth,
    action: "delivery-delete",
    entityType: "order-delivery",
    entityId: id,
    oldValues: toAuditValue(delivery),
    newValues: undefined,
    request,
  });

  return NextResponse.json({ deleted: true });
}
