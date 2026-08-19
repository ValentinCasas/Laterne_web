import { NextResponse } from "next/server";
import { z } from "zod";
import { getDefaultTenant } from "@/lib/tenant";
import { loadBusinessKnowledge } from "@/lib/reception-assistant/knowledge";
import { buildDefaultResponse } from "@/lib/reception-assistant/intents";

/**
 * @summary API route para la recepcionista IA (placeholder).
 *
 * Actualmente procesa mensajes usando clasificación por patrones (regex).
 * Cuando se implemente un proveedor de IA real, este endpoint se conectará
 * al provider configurado para el tenant.
 *
 * Flujo futuro:
 * 1. Recibe mensaje del usuario
 * 2. Carga knowledge base del tenant
 * 3. Procesa con el provider configurado (o fallback a regex)
 * 4. Registra intent y acción en auditoría
 * 5. Retorna respuesta al cliente
 */

const messageInput = z.object({
  sessionId: z.string().trim().min(1).max(128),
  message: z.string().trim().min(1).max(2000),
  channel: z.enum(["web", "whatsapp", "telegram", "sms", "phone"]).default("web"),
  customerName: z.string().trim().max(160).optional(),
  branchSlug: z.string().trim().max(120).optional(),
});

export async function POST(request: Request) {
  const parsed = messageInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos para la conversación" },
      { status: 400 },
    );
  }

  const tenant = await getDefaultTenant();
  const knowledge = await loadBusinessKnowledge(tenant.id);

  if (!knowledge?.enabled) {
    return NextResponse.json(
      {
        error: "La asistente virtual no está habilitada para este negocio",
        reply: "El servicio de asistencia virtual no está disponible en este momento.",
      },
      { status: 503 },
    );
  }

  // TODO: Cuando se implemente un proveedor de IA real:
  // 1. Buscar sesión existente o crear nueva
  // 2. Cargar historial de conversación
  // 3. Llamar al provider con el mensaje y el historial
  // 4. Registrar intent y acción en ConversationMessage
  // 5. Si hay acción propuesta, registrar en AuditLog
  // 6. Si shouldHandoff, marcar sesión con handoffPending

  // Por ahora: procesar con clasificador por patrones
  const response = buildDefaultResponse(parsed.data.message);

  // TODO: Persistir en ConversationMessage cuando exista la sesión en DB
  // await prisma.conversationMessage.create({
  //   data: {
  //     sessionId: session.id,
  //     role: "user",
  //     content: parsed.data.message,
  //     intent: response.intent,
  //   },
  // });

  // TODO: Registrar en AuditLog
  // await prisma.auditLog.create({
  //   data: {
  //     tenantId: tenant.id,
  //     action: "reception.intent_classified",
  //     entityType: "ConversationSession",
  //     entityId: parsed.data.sessionId,
  //     newValues: { intent: response.intent, confidence: response.confidence },
  //   },
  // });

  return NextResponse.json({
    reply: response.reply,
    intent: response.intent,
    confidence: response.confidence,
    requiresConfirmation: response.requiresConfirmation,
    shouldHandoff: response.shouldHandoff,
    handoffReason: response.handoffReason,
    actions: response.actions,
  });
}
