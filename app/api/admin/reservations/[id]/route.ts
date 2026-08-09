import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { reservationStatuses } from "@/lib/reservations";

const updateInput = z.object({
  status: z.enum(reservationStatuses),
  note: z.string().trim().max(500).optional(),
});

/** @summary Cambia el estado de una reserva y conserva su historial administrativo. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("reservation.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  const parsed = updateInput.safeParse(await request.json().catch(() => null));
  if (!Number.isInteger(id) || !parsed.success) {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
  const current = await prisma.reservation.findFirst({ where: { id, tenantId: auth.tenant.id } });
  if (!current) return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });

  const updated = await prisma.$transaction(async (transaction) => {
    const reservation = await transaction.reservation.update({
      where: { id },
      data: { status: parsed.data.status },
    });
    await transaction.reservationStatusHistory.create({
      data: {
        reservationId: id,
        userId: auth.session.userId,
        fromStatus: current.status,
        toStatus: parsed.data.status,
        note: parsed.data.note || null,
      },
    });
    await transaction.notification.create({
      data: {
        tenantId: auth.tenant.id,
        type: "reservation.status",
        title: `Reserva ${current.reference} · ${parsed.data.status}`,
        message: `Se actualizó la reserva de ${current.customerName}.`,
        link: "/admin/reservas",
      },
    });
    return reservation;
  });
  await recordAudit({
    context: auth,
    action: "status-change",
    entityType: "reservation",
    entityId: id,
    oldValues: toAuditValue(serialize(current)),
    newValues: toAuditValue(serialize(updated)),
    request,
  });
  return NextResponse.json({ reservation: serialize(updated) });
}
