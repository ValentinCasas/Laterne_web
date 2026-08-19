import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/format";
import { ReceptionAssistantConfig } from "@/components/admin/reception-assistant-config";

export const dynamic = "force-dynamic";

/**
 * @summary Página admin para configurar la base de conocimiento de la recepcionista IA.
 *
 * Lee la configuración existente de `ReceptionKnowledge` (sin escrituras).
 * Si la tabla no existe o no hay registro para el tenant, pasa `null` al
 * componente client que muestra defaults vacíos. El registro se crea
 * únicamente cuando el usuario guarda la configuración por primera vez.
 */
export default async function ReceptionAssistantPage() {
  const context = await requirePermission("business.manage");

  /**
   * @summary Solo lectura con try-catch: si la tabla no existe todavía
   * (migración no aplicada), devolvemos null en vez de romper la página.
   */
  let knowledge: Awaited<ReturnType<typeof prisma.receptionKnowledge.findUnique>> = null;
  try {
    knowledge = await prisma.receptionKnowledge.findUnique({
      where: { tenantId: context.tenant.id },
    });
  } catch {
    // Tabla aún no migrada — se muestra formulario vacío
  }

  const branches = await prisma.branch.findMany({
    where: { tenantId: context.tenant.id, active: true },
    select: { id: true, name: true, slug: true },
    orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
  });

  const serialized = knowledge
    ? (serialize(knowledge) as unknown as {
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
      })
    : null;

  return (
    <ReceptionAssistantConfig
      initialKnowledge={serialized}
      branches={branches.map((b) => ({ id: b.id, name: b.name, slug: b.slug }))}
    />
  );
}
