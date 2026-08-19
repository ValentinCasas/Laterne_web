import { prisma } from "@/lib/prisma";
import type {
  BusinessFAQ,
  BusinessKnowledge,
  LocationInfo,
  AssistantConfig,
} from "./types";

/**
 * @summary Carga la base de conocimiento del negocio desde Prisma.
 *
 * Esta función consulta la tabla `ReceptionKnowledge` y la enriquece
 * con datos del tenant y las sucursales activas. Es la fuente única
 * de información para cualquier proveedor de IA futuro.
 */
export async function loadBusinessKnowledge(
  tenantId: number,
): Promise<BusinessKnowledge | null> {
  const [knowledge, tenant] = await Promise.all([
    prisma.receptionKnowledge.findUnique({ where: { tenantId } }),
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        name: true,
        timeZone: true,
        businessInfo: {
          select: {
            description: true,
            address: true,
            city: true,
            province: true,
            phone: true,
            email: true,
            website: true,
          },
        },
      },
    }),
  ]);

  if (!tenant) return null;

  const faqs: BusinessFAQ[] = Array.isArray(knowledge?.faqs)
    ? (knowledge.faqs as unknown as BusinessFAQ[])
    : [];

  const locationInfo: LocationInfo | null = knowledge?.locationInfo
    ? (knowledge.locationInfo as LocationInfo)
    : tenant.businessInfo
      ? {
          address: tenant.businessInfo.address ?? undefined,
          city: tenant.businessInfo.city ?? undefined,
          province: tenant.businessInfo.province ?? undefined,
        }
      : null;

  const assistantConfig: AssistantConfig = knowledge?.assistantConfig
    ? (knowledge.assistantConfig as AssistantConfig)
    : { tone: "friendly", language: "es" };

  return {
    tenantId,
    businessName: knowledge?.businessName ?? tenant.name,
    address: knowledge?.address ?? tenant.businessInfo?.address ?? null,
    phone: knowledge?.phone ?? tenant.businessInfo?.phone ?? null,
    email: knowledge?.email ?? tenant.businessInfo?.email ?? null,
    website: knowledge?.website ?? tenant.businessInfo?.website ?? null,
    timezone: tenant.timeZone ?? "America/Argentina/Buenos_Aires",
    openingHoursText: knowledge?.openingHoursText ?? null,
    reservationPolicy: knowledge?.reservationPolicy ?? null,
    faqs,
    locationInfo,
    assistantConfig,
    enabled: knowledge?.enabled ?? false,
  };
}

/**
 * @summary Serializa la knowledge para enviar a un proveedor externo.
 *
 * Incluye las sucursales activas como contexto adicional que la IA
 * puede usar para responder preguntas sobre ubicaciones.
 */
export function serializeKnowledgeForProvider(
  knowledge: BusinessKnowledge,
  branches: Array<{
    name: string;
    slug: string;
    address: string;
    phone?: string | null;
  }>,
): string {
  const sections: string[] = [];

  sections.push(`# ${knowledge.businessName ?? "Negocio"}`);
  sections.push(`Dirección: ${knowledge.address ?? "No disponible"}`);
  sections.push(`Teléfono: ${knowledge.phone ?? "No disponible"}`);
  sections.push(`Email: ${knowledge.email ?? "No disponible"}`);
  if (knowledge.website) sections.push(`Web: ${knowledge.website}`);

  if (knowledge.openingHoursText) {
    sections.push(`\n## Horarios de atención\n${knowledge.openingHoursText}`);
  }

  if (knowledge.reservationPolicy) {
    sections.push(`\n## Política de reservas\n${knowledge.reservationPolicy}`);
  }

  if (branches.length > 0) {
    sections.push("\n## Sucursales");
    for (const branch of branches) {
      sections.push(
        `- ${branch.name}: ${branch.address} (${branch.phone ?? "sin teléfono"})`,
      );
    }
  }

  if (knowledge.faqs.length > 0) {
    sections.push("\n## Preguntas frecuentes");
    for (const faq of knowledge.faqs) {
      sections.push(`**${faq.question}**\n${faq.answer}`);
    }
  }

  const config = knowledge.assistantConfig;
  sections.push(`\n## Instrucciones para la IA`);
  sections.push(`- Tono: ${config.tone ?? "friendly"}`);
  sections.push(`- Idioma: ${config.language ?? "es"}`);
  if (config.greeting) sections.push(`- Saludo: ${config.greeting}`);
  if (config.farewell) sections.push(`- Despedida: ${config.farewell}`);
  if (config.alwaysHandoffCategories?.length) {
    sections.push(
      `- Siempre transferir a humano: ${config.alwaysHandoffCategories.join(", ")}`,
    );
  }

  return sections.join("\n");
}
