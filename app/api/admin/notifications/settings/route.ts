import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";

/**
 * @summary Valida la entrada relacionada con las notificaciones.
 */
const settingsInput = z.object({
  panel: z.boolean(),
  email: z.boolean(),
  whatsapp: z.boolean(),
  webPush: z.boolean(),
  events: z.array(z.string().max(80)).max(30),
});

/** @summary Guarda los canales preferidos sin afirmar integraciones externas todavía no configuradas. */
export async function PATCH(request: Request) {
  const auth = await authorize("notification.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = settingsInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Configuración inválida" }, { status: 400 });
  const current = await prisma.notificationSettings.findUnique({ where: { tenantId: auth.tenant.id } });
  const settings = await prisma.notificationSettings.upsert({
    where: { tenantId: auth.tenant.id },
    create: { tenantId: auth.tenant.id, ...parsed.data },
    update: parsed.data,
  });
  await recordAudit({
    context: auth,
    action: "update",
    entityType: "notification-settings",
    entityId: settings.id,
    oldValues: current ? toAuditValue(serialize(current)) : undefined,
    newValues: toAuditValue(serialize(settings)),
    request,
  });
  return NextResponse.json({ settings: serialize(settings) });
}
