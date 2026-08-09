import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const settingsInput = z.object({
  enabled: z.boolean(),
  capacityPerSlot: z.coerce.number().int().min(1).max(1000),
  slotInterval: z.coerce.number().int().min(10).max(180),
  minimumLeadHours: z.coerce.number().int().min(0).max(168),
  maximumAdvanceDays: z.coerce.number().int().min(1).max(730),
  maximumPartySize: z.coerce.number().int().min(1).max(500),
  defaultDuration: z.coerce.number().int().min(15).max(1440),
  sectors: z.array(z.string().trim().min(1).max(100)).max(30),
  policy: z.string().trim().max(3000),
  confirmationMode: z.enum(["manual", "automatic"]),
});

/** @summary Actualiza capacidad, franjas y políticas del sistema de reservas. */
export async function PATCH(request: Request) {
  const auth = await authorize("reservation.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = settingsInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisá la configuración" }, { status: 400 });
  const previous = await prisma.reservationSettings.findUnique({ where: { tenantId: auth.tenant.id } });
  const settings = await prisma.reservationSettings.upsert({
    where: { tenantId: auth.tenant.id },
    create: { tenantId: auth.tenant.id, ...parsed.data },
    update: parsed.data,
  });
  await recordAudit({
    context: auth,
    action: "update",
    entityType: "reservation-settings",
    entityId: settings.id,
    oldValues: toAuditValue(serialize(previous)),
    newValues: toAuditValue(serialize(settings)),
    request,
  });
  return NextResponse.json({ settings: serialize(settings) });
}
