import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const mapProviderInput = z.object({
  provider: z.literal("openfreemap"),
  enabled: z.boolean(),
});

/** @summary Activa o pausa OpenFreeMap para el tenant sin solicitar credenciales inexistentes. */
export async function POST(request: Request) {
  const auth = await authorize("business.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const parsed = mapProviderInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Configuración de mapas inválida" }, { status: 400 });

  const previous = await prisma.deliveryProviderConfig.findUnique({
    where: { tenantId_provider: { tenantId: auth.tenant.id, provider: parsed.data.provider } },
  });
  const provider = await prisma.deliveryProviderConfig.upsert({
    where: { tenantId_provider: { tenantId: auth.tenant.id, provider: parsed.data.provider } },
    create: {
      tenantId: auth.tenant.id,
      provider: parsed.data.provider,
      enabled: parsed.data.enabled,
      apiKey: null,
      publicConfig: { style: "liberty" },
      secretConfigured: false,
      status: parsed.data.enabled ? "active" : "inactive",
      lastCheckAt: new Date(),
    },
    update: {
      enabled: parsed.data.enabled,
      apiKey: null,
      publicConfig: { style: "liberty" },
      secretConfigured: false,
      status: parsed.data.enabled ? "active" : "inactive",
      lastCheckAt: new Date(),
    },
    select: { provider: true, enabled: true, status: true, lastCheckAt: true },
  });

  await recordAudit({
    context: auth,
    action: "delivery-map-provider.update",
    entityType: "delivery-provider-config",
    entityId: previous?.id ?? `${auth.tenant.id}:openfreemap`,
    oldValues: toAuditValue(previous),
    newValues: toAuditValue(provider),
    request,
  });

  return NextResponse.json({
    provider: {
      ...provider,
      persisted: true,
      lastCheckAt: provider.lastCheckAt?.toISOString() ?? null,
    },
  });
}
