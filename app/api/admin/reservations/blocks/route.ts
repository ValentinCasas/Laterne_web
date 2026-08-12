import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { resolveEffectiveBranchId } from "@/lib/branch";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { defaultReservationTimeZone, zoneOffset } from "@/lib/reservations";

const blockInput = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  reason: z.string().trim().min(2).max(255),
});

/** @summary Crea un bloqueo total o parcial para impedir reservas en fechas especiales. */
export async function POST(request: Request) {
  const auth = await authorize("reservation.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = blockInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisá las fechas del bloqueo" }, { status: 400 });
  const timeZone = auth.tenant.timeZone ?? defaultReservationTimeZone;
  const offset = zoneOffset(timeZone);
  const startDate = new Date(`${parsed.data.startDate}T00:00:00${offset}`);
  const endDate = new Date(`${parsed.data.endDate}T00:00:00${offset}`);
  if (startDate > endDate)
    return NextResponse.json({ error: "El rango de fechas está invertido" }, { status: 400 });
  const blockBranchId = await resolveEffectiveBranchId(auth.tenant.id, auth.activeBranchId);
  const block = await prisma.reservationBlock.create({
    data: {
      tenantId: auth.tenant.id,
      branchId: blockBranchId ?? null,
      startDate,
      endDate,
      startTime: parsed.data.startTime ? new Date(`1970-01-01T${parsed.data.startTime}:00Z`) : null,
      endTime: parsed.data.endTime ? new Date(`1970-01-01T${parsed.data.endTime}:00Z`) : null,
      reason: parsed.data.reason,
    },
  });
  await recordAudit({
    context: auth,
    action: "create",
    entityType: "reservation-block",
    entityId: block.id,
    newValues: toAuditValue(serialize(block)),
    request,
  });
  return NextResponse.json({ block: serialize(block) }, { status: 201 });
}
