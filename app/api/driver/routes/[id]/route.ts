import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/format";
import { canRouteTransition } from "@/lib/delivery-route-state";

const updateRouteInput = z.object({
  status: z.enum(["IN_PROGRESS", "COMPLETED", "CANCELLED"]),
  reason: z.string().trim().max(500).optional(),
});

/**
 * @summary GET: Detalle completo de un recorrido con todas sus entregas, paradas e incidencias.
 * Solo el repartidor dueño puede ver su recorrido.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize();
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const driverProfile = await prisma.driverProfile.findFirst({
    where: { tenantId: auth.tenant.id, userId: auth.session.userId },
  });
  if (!driverProfile) {
    return NextResponse.json({ error: "No tenés un perfil de repartidor vinculado" }, { status: 403 });
  }

  const routeId = Number((await context.params).id);
  if (!Number.isInteger(routeId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const route = await prisma.deliveryRoute.findFirst({
    where: {
      id: routeId,
      tenantId: auth.tenant.id,
      driverProfileId: driverProfile.id,
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
  });

  if (!route) {
    return NextResponse.json({ error: "Recorrido no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ route: serialize(route) });
}

/**
 * @summary PATCH: Actualiza el estado del recorrido (iniciar, completar, cancelar).
 * Valida transiciones y calcula métricas al finalizar.
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

  const routeId = Number((await context.params).id);
  if (!Number.isInteger(routeId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const parsed = updateRouteInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });

  const { status: newStatus, reason } = parsed.data;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.deliveryRoute.findFirst({
        where: { id: routeId, tenantId: auth.tenant.id, driverProfileId: driverProfile.id },
        select: { status: true, startedAt: true },
      });
      if (!current) throw new Error("NOT_FOUND");
      if (!canRouteTransition(current.status, newStatus)) throw new Error("INVALID_TRANSITION");

      const now = new Date();
      const updateData: Record<string, unknown> = { status: newStatus };

      if (newStatus === "IN_PROGRESS") updateData.startedAt = now;
      if (newStatus === "COMPLETED") {
        updateData.completedAt = now;
        if (current.startedAt) {
          updateData.totalDurationS = Math.round((now.getTime() - current.startedAt.getTime()) / 1000);
        }
        // Calcular completadas
        const completedCount = await tx.orderDelivery.count({
          where: { routeId, status: "DELIVERED" },
        });
        updateData.completedStops = completedCount;
      }
      if (newStatus === "CANCELLED") updateData.cancelledAt = now;
      if (reason) updateData.notes = reason;

      const route = await tx.deliveryRoute.update({
        where: { id: routeId },
        data: updateData,
      });

      return route;
    });

    return NextResponse.json({ route: serialize(updated) });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return NextResponse.json({ error: "Recorrido no encontrado" }, { status: 404 });
    }
    if (error instanceof Error && error.message === "INVALID_TRANSITION") {
      return NextResponse.json({ error: "No podés hacer esa transición desde el estado actual" }, { status: 400 });
    }
    return NextResponse.json({ error: "No se pudo actualizar el recorrido" }, { status: 500 });
  }
}
