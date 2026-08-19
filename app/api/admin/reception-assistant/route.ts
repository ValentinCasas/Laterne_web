import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * @summary API route para gestionar la base de conocimiento de la recepcionista IA.
 *
 * GET  — Lee la configuración actual del tenant.
 * POST — Crea o actualiza (upsert) la configuración.
 */

const faqItemSchema = z.object({
  question: z.string().trim().min(1).max(500),
  answer: z.string().trim().min(1).max(2000),
  category: z.string().trim().max(100).optional(),
});

const locationInfoSchema = z.object({
  address: z.string().trim().max(300).optional(),
  city: z.string().trim().max(120).optional(),
  province: z.string().trim().max(120).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  googleMapsUrl: z.string().trim().max(500).optional(),
  parkingInfo: z.string().trim().max(500).optional(),
  publicTransport: z.string().trim().max(500).optional(),
});

const assistantConfigSchema = z.object({
  tone: z.enum(["formal", "casual", "friendly"]).optional(),
  language: z.string().trim().max(10).optional(),
  maxMessagesBeforeHandoff: z.number().int().min(1).max(100).optional(),
  alwaysHandoffCategories: z.array(z.string().trim().max(100)).optional(),
  activeHours: z
    .object({
      start: z.string().trim().max(5),
      end: z.string().trim().max(5),
    })
    .nullable()
    .optional(),
  greeting: z.string().trim().max(500).optional(),
  farewell: z.string().trim().max(500).optional(),
});

const knowledgeInput = z.object({
  businessName: z.string().trim().max(160).optional(),
  address: z.string().trim().max(500).optional(),
  phone: z.string().trim().max(60).optional(),
  email: z.string().trim().max(190).optional(),
  website: z.string().trim().max(300).optional(),
  timezone: z.string().trim().max(80).optional(),
  openingHoursText: z.string().trim().max(2000).optional(),
  reservationPolicy: z.string().trim().max(2000).optional(),
  faqs: z.array(faqItemSchema).max(50).optional(),
  locationInfo: locationInfoSchema.optional(),
  assistantConfig: assistantConfigSchema.optional(),
  enabled: z.boolean().optional(),
});

/** @summary GET — Lee la configuración de conocimiento del tenant. */
export async function GET() {
  const auth = await authorize("business.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const knowledge = await prisma.receptionKnowledge.findUnique({
    where: { tenantId: auth.tenant.id },
  });

  return NextResponse.json({
    knowledge: knowledge
      ? {
          ...knowledge,
          faqs: Array.isArray(knowledge.faqs) ? knowledge.faqs : [],
          locationInfo: knowledge.locationInfo ?? null,
          assistantConfig: knowledge.assistantConfig ?? null,
        }
      : null,
  });
}

/** @summary POST — Crea o actualiza la configuración de conocimiento (upsert). */
export async function POST(request: Request) {
  const auth = await authorize("business.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const parsed = knowledgeInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const data = parsed.data;

  const previous = await prisma.receptionKnowledge.findUnique({
    where: { tenantId: auth.tenant.id },
  });

  const knowledge = await prisma.receptionKnowledge.upsert({
    where: { tenantId: auth.tenant.id },
    create: {
      tenantId: auth.tenant.id,
      businessName: data.businessName ?? null,
      address: data.address ?? null,
      phone: data.phone ?? null,
      email: data.email ?? null,
      website: data.website ?? null,
      timezone: data.timezone ?? "America/Argentina/Buenos_Aires",
      openingHoursText: data.openingHoursText ?? null,
      reservationPolicy: data.reservationPolicy ?? null,
      faqs: data.faqs ?? [],
      locationInfo: data.locationInfo ?? undefined,
      assistantConfig: data.assistantConfig ?? undefined,
      enabled: data.enabled ?? false,
    },
    update: {
      ...(data.businessName !== undefined && { businessName: data.businessName }),
      ...(data.address !== undefined && { address: data.address }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.website !== undefined && { website: data.website }),
      ...(data.timezone !== undefined && { timezone: data.timezone }),
      ...(data.openingHoursText !== undefined && { openingHoursText: data.openingHoursText }),
      ...(data.reservationPolicy !== undefined && { reservationPolicy: data.reservationPolicy }),
      ...(data.faqs !== undefined && { faqs: data.faqs }),
      ...(data.locationInfo !== undefined && { locationInfo: data.locationInfo }),
      ...(data.assistantConfig !== undefined && { assistantConfig: data.assistantConfig }),
      ...(data.enabled !== undefined && { enabled: data.enabled }),
    },
  });

  await recordAudit({
    context: { session: auth.session, tenant: auth.tenant },
    action: previous ? "reception_knowledge.updated" : "reception_knowledge.created",
    entityType: "ReceptionKnowledge",
    entityId: knowledge.id,
    oldValues: previous ? toAuditValue(previous) : undefined,
    newValues: toAuditValue(knowledge),
  });

  return NextResponse.json({
    knowledge: {
      ...knowledge,
      faqs: Array.isArray(knowledge.faqs) ? knowledge.faqs : [],
      locationInfo: knowledge.locationInfo ?? null,
      assistantConfig: knowledge.assistantConfig ?? null,
    },
  });
}
