import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { integrationProviders, integrationSecretConfigured } from "@/lib/integrations";
import { prisma } from "@/lib/prisma";

const integrationInput = z.object({
  provider: z.enum(integrationProviders),
  enabled: z.boolean(),
  mode: z.enum(["disabled", "sandbox", "live"]),
  accountLabel: z.string().trim().max(160).optional(),
  publicIdentifier: z.string().trim().max(300).optional(),
});

/** @summary Guarda únicamente configuración pública y comprueba credenciales desde variables del servidor. */
export async function POST(request: Request) {
  const auth = await authorize("business.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = integrationInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Configuración inválida" }, { status: 400 });

  const secretConfigured = integrationSecretConfigured(parsed.data.provider);
  const requestedEnabled = parsed.data.enabled && parsed.data.mode !== "disabled";
  const enabled = parsed.data.provider === "mercado_pago" ? false : requestedEnabled && secretConfigured;
  const status = secretConfigured ? (enabled ? "ready" : "credentials_ready") : "not_configured";
  const previous = await prisma.integrationSettings.findUnique({
    where: { tenantId_provider: { tenantId: auth.tenant.id, provider: parsed.data.provider } },
  });
  const integration = await prisma.integrationSettings.upsert({
    where: { tenantId_provider: { tenantId: auth.tenant.id, provider: parsed.data.provider } },
    create: {
      tenantId: auth.tenant.id,
      provider: parsed.data.provider,
      enabled,
      mode: parsed.data.provider === "mercado_pago" ? "disabled" : parsed.data.mode,
      publicConfig: {
        accountLabel: parsed.data.accountLabel || null,
        publicIdentifier: parsed.data.publicIdentifier || null,
      },
      secretConfigured,
      status,
      lastCheckAt: new Date(),
    },
    update: {
      enabled,
      mode: parsed.data.provider === "mercado_pago" ? "disabled" : parsed.data.mode,
      publicConfig: {
        accountLabel: parsed.data.accountLabel || null,
        publicIdentifier: parsed.data.publicIdentifier || null,
      },
      secretConfigured,
      status,
      lastCheckAt: new Date(),
    },
  });
  await recordAudit({
    context: auth,
    action: "integration.update",
    entityType: "integration",
    entityId: integration.id,
    oldValues: toAuditValue(previous),
    newValues: toAuditValue(integration),
    request,
  });
  return NextResponse.json({ integration });
}
