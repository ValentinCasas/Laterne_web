import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { reservationStatuses, reservationTime } from "@/lib/reservations";

const updateInput = z.object({
  status: z.enum(reservationStatuses).optional(),
  reservationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  reservationTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  partySize: z.number().int().min(1).max(500).optional(),
  sector: z.string().trim().max(100).optional().nullable(),
  notes: z.string().trim().max(5000).optional().nullable(),
  note: z.string().trim().max(500).optional(),
});

/** @summary Actualiza estado, fecha, hora o datos de una reserva con control de disponibilidad. */
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
  if (current.branchId && !auth.branches.some((branch) => branch.id === current.branchId)) {
    return NextResponse.json({ error: "No tenés acceso a la sucursal de esta reserva" }, { status: 403 });
  }

  const targetDate = parsed.data.reservationDate
    ? new Date(`${parsed.data.reservationDate}T00:00:00Z`)
    : current.reservationDate;
  const targetTime = parsed.data.reservationTime
    ? reservationTime(parsed.data.reservationTime)
    : current.reservationTime;
  const targetPartySize = parsed.data.partySize ?? current.partySize;

  if (parsed.data.reservationDate || parsed.data.reservationTime) {
    const settings = await prisma.reservationSettings.findUnique({
      where: { tenantId: auth.tenant.id },
    });
    if (settings?.capacityPerSlot && settings.capacityPerSlot > 0) {
      const occupied = await prisma.reservation.aggregate({
        where: {
          id: { not: id },
          tenantId: auth.tenant.id,
          branchId: current.branchId,
          reservationDate: targetDate,
          reservationTime: targetTime,
          status: { in: ["pending", "confirmed"] },
        },
        _sum: { partySize: true },
      });
      if ((occupied._sum.partySize ?? 0) + targetPartySize > settings.capacityPerSlot) {
        return NextResponse.json(
          { error: "La franja elegida no tiene capacidad disponible para esa cantidad de personas" },
          { status: 409 },
        );
      }
    }
  }

  const statusChanged = parsed.data.status && parsed.data.status !== current.status;
  const updated = await prisma.$transaction(async (transaction) => {
    const data: Record<string, unknown> = {};
    if (parsed.data.status !== undefined) data.status = parsed.data.status;
    if (parsed.data.reservationDate !== undefined) data.reservationDate = targetDate;
    if (parsed.data.reservationTime !== undefined) data.reservationTime = targetTime;
    if (parsed.data.partySize !== undefined) data.partySize = parsed.data.partySize;
    if (parsed.data.sector !== undefined) data.sector = parsed.data.sector || null;
    if (parsed.data.notes !== undefined) data.notes = parsed.data.notes || null;

    const reservation = await transaction.reservation.update({ where: { id }, data });
    if (statusChanged) {
      await transaction.reservationStatusHistory.create({
        data: {
          reservationId: id,
          userId: auth.session.userId,
          fromStatus: current.status,
          toStatus: parsed.data.status!,
          note: parsed.data.note || null,
        },
      });
    }
    await transaction.notification.create({
      data: {
        tenantId: auth.tenant.id,
        branchId: current.branchId,
        type: "reservation.status",
        title: `Reserva ${current.reference} · actualizada`,
        message: `Se actualizó la reserva de ${current.customerName}.`,
        link: "/admin/reservas",
      },
    });
    return reservation;
  });
  await recordAudit({
    context: auth,
    action: statusChanged ? "status-change" : "update",
    entityType: "reservation",
    entityId: id,
    oldValues: toAuditValue(serialize(current)),
    newValues: toAuditValue(serialize(updated)),
    request,
  });
  return NextResponse.json({ reservation: serialize(updated) });
}