import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/format";

const driverCreateIncidentInput = z.object({
  deliveryId: z.coerce.number().int().positive(),
  type: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(2000),
});

/** @summary Tipos de incidencia habituales para la vista personal. */
export const INCIDENT_TYPES = [
  "cliente ausente",
  "dirección incorrecta",
  "rechazó el pedido",
  "problema de tránsito",
  "problema del vehículo",
  "otro",
] as const;

/**
 * @summary Permite al repartidor reportar una incidencia en su entrega. La entrega
 * pasa a estado INCIDENCIA y se registra en el histórico con el timestamp real.
 */
export async function POST(request: Request) {
  const auth = await authorize("driver.self");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const driverProfile = await prisma.driverProfile.findFirst({
    where: { tenantId: auth.tenant.id, userId: auth.session.userId, active: true },
  });
  if (!driverProfile) {
    return NextResponse.json({ error: "No tenés un perfil de repartidor activo vinculado" }, { status: 403 });
  }

  const parsed = driverCreateIncidentInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });

  const { deliveryId, type, description } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const delivery = await tx.orderDelivery.findFirst({
        where: { id: deliveryId, tenantId: auth.tenant.id, driverProfileId: driverProfile.id },
        select: { id: true, status: true },
      });
      if (!delivery) throw new Error("NOT_MINE");
      if (!["ASSIGNED", "PICKED_UP", "ON_THE_WAY"].includes(delivery.status)) {
        throw new Error("ALREADY_FINISHED");
      }

      const change = await tx.orderDelivery.updateMany({
        where: { id: deliveryId, tenantId: auth.tenant.id, driverProfileId: driverProfile.id, status: delivery.status },
        data: { status: "INCIDENT" },
      });
      if (change.count !== 1) {
        throw new Error("ALREADY_FINISHED");
      }

      const incident = await tx.driverIncident.create({
        data: {
          tenantId: auth.tenant.id,
          driverId: driverProfile.id,
          deliveryId,
          type,
          description,
          reportedById: auth.session.userId,
        },
        include: {
          delivery: { select: { id: true, number: true, customerName: true } },
          reportedBy: { select: { id: true, name: true } },
        },
      });

      await tx.orderDeliveryStatusLog.create({
        data: {
          tenantId: auth.tenant.id,
          deliveryId,
          driverProfileId: driverProfile.id,
          status: "INCIDENT",
          previousStatus: delivery.status,
          reason: description,
          changedById: auth.session.userId,
        },
      });

      return incident;
    });

    await recordAudit({
      context: auth,
      action: "driver-incident-create",
      entityType: "driver-incident",
      entityId: result.id,
      newValues: toAuditValue(result),
      request,
    });

    return NextResponse.json({ incident: serialize(result) }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && (error.message === "NOT_MINE" || error.message === "ALREADY_FINISHED")) {
      return NextResponse.json(
        { error: error.message === "NOT_MINE" ? "La entrega no está asignada a vos" : "La entrega ya finalizó" },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "No se pudo reportar la incidencia" }, { status: 500 });
  }
}
