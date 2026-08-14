import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const settingsInput = z.object({
  issuerName: z.string().trim().max(180).optional().nullable(),
  taxId: z.string().trim().max(40).optional().nullable(),
  address: z.string().trim().max(300).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  terms: z.string().trim().max(3000).optional().nullable(),
});

/** @summary Devuelve la configuración de emisor que se estampa en los comprobantes. */
export async function GET() {
  const auth = await authorize("order.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const settings = await prisma.invoiceSettings.findUnique({ where: { tenantId: auth.tenant.id } });
  return NextResponse.json({ settings: serialize(settings) });
}

/** @summary Guarda nombre, CUIT, domicilio y condiciones que aparecen en el comprobante. */
export async function PATCH(request: Request) {
  const auth = await authorize("order.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = settingsInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Configuración inválida" }, { status: 400 });
  const current = await prisma.invoiceSettings.findUnique({ where: { tenantId: auth.tenant.id } });
  const settings = await prisma.invoiceSettings.upsert({
    where: { tenantId: auth.tenant.id },
    create: { tenantId: auth.tenant.id, ...parsed.data },
    update: parsed.data,
  });
  await recordAudit({
    context: auth,
    action: "update",
    entityType: "invoice-settings",
    entityId: settings.id,
    oldValues: current ? toAuditValue(serialize(current)) : undefined,
    newValues: toAuditValue(serialize(settings)),
    request,
  });
  return NextResponse.json({ settings: serialize(settings) });
}
