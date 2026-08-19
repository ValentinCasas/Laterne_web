import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/format";
import { ReceptionAssistantConfig } from "@/components/admin/reception-assistant-config";

export const dynamic = "force-dynamic";

/**
 * @summary Página admin para configurar la base de conocimiento de la recepcionista IA.
 *
 * Carga o inicializa la configuración de `ReceptionKnowledge` y la pasa
 * al componente client para edición. No implementa IA real; solo prepara
 * la estructura para futuros proveedores.
 */
export default async function ReceptionAssistantPage() {
  const context = await requirePermission("business.manage");

  const knowledge = await prisma.receptionKnowledge.upsert({
    where: { tenantId: context.tenant.id },
    create: { tenantId: context.tenant.id },
    update: {},
  });

  const branches = await prisma.branch.findMany({
    where: { tenantId: context.tenant.id, active: true },
    select: { id: true, name: true, slug: true },
    orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
  });

  const serialized = serialize(knowledge) as unknown as {
    id: number;
    businessName: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    timezone: string;
    openingHoursText: string | null;
    reservationPolicy: string | null;
    faqs: Array<{ question: string; answer: string; category?: string }>;
    locationInfo: Record<string, unknown> | null;
    assistantConfig: Record<string, unknown> | null;
    enabled: boolean;
  };

  return (
    <ReceptionAssistantConfig
      initialKnowledge={serialized}
      branches={branches.map((b) => ({ id: b.id, name: b.name, slug: b.slug }))}
    />
  );
}
