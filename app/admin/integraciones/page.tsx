import { IntegrationManager } from "@/components/admin/integration-manager";
import { requirePermission } from "@/lib/auth";
import { integrationProviders, integrationSecretConfigured } from "@/lib/integrations";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** @summary Reúne el estado seguro de los proveedores sin transferir secretos al navegador. */
export default async function IntegrationsPage() {
  const context = await requirePermission("business.manage");
  const saved = await prisma.integrationSettings.findMany({ where: { tenantId: context.tenant.id } });
  const integrations = integrationProviders.map((provider) => {
    const current = saved.find((item) => item.provider === provider);
    return {
      provider,
      enabled: current?.enabled ?? false,
      mode: current?.mode ?? "disabled",
      status: current?.status ?? "not_configured",
      secretConfigured: integrationSecretConfigured(provider),
      publicConfig: (current?.publicConfig as Record<string, string | null> | null) ?? null,
      lastCheckAt: current?.lastCheckAt?.toISOString() ?? null,
    };
  });
  return <IntegrationManager initialIntegrations={integrations} />;
}
