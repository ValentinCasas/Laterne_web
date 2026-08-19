import type { ReceptionIntent, ReceptionAction, ReceptionResponse } from "./types";

/**
 * @summary Patrones de clasificación de intents por keyword.
 *
 * Cada patrone asocia palabras clave a un intent. Cuando se implemente
 * un proveedor de IA real, estos patrones se usarán como fallback o
 * validación del clasificador externo.
 */
const INTENT_PATTERNS: Array<{
  intent: ReceptionIntent;
  patterns: RegExp[];
  priority: number;
}> = [
  {
    intent: "check_availability",
    patterns: [
      /disponib(?:ilidad|le)/i,
      /horario(?:s)?\s+(?:libre|disponible)/i,
      /fecha\s+(?:libre|disponible)/i,
      /cuándo\s+(?:hay|tienen|hay\s+espacio)/i,
      /quer(?:eo?)\s+(?:reservar|una\s+mesa)/i,
      /reserv(?:ar?|a)\s+(?:mesa|fecha|horario)/i,
    ],
    priority: 10,
  },
  {
    intent: "create_reservation",
    patterns: [
      /hacer(?:me)?\s+una?\s+reserva/i,
      /reserv(?:ar?|a)\s+(?:mesa|para|ahora)/i,
      /quiero\s+reservar/i,
      /necesito\s+una?\s+reserva/i,
      / booking/i,
    ],
    priority: 15,
  },
  {
    intent: "modify_reservation",
    patterns: [
      /modific(?:ar?|o)\s+(?:mi\s+)?reserva/i,
      /cambi(?:ar?|o)\s+(?:mi\s+)?reserva/i,
      /editar?\s+(?:mi\s+)?reserva/i,
      /mover(?:me)?\s+(?:mi\s+)?reserva/i,
      /cambiar?\s+(?:la\s+)?fecha/i,
      /cambiar?\s+(?:la\s+)?hora/i,
    ],
    priority: 12,
  },
  {
    intent: "cancel_reservation",
    patterns: [
      /cancel(?:ar?|o)\s+(?:mi\s+)?reserva/i,
      /anul(?:ar?|o)\s+(?:mi\s+)?reserva/i,
      /no\s+(?:voy|asistir|ir)\s+a\s+la\s+reserva/i,
    ],
    priority: 12,
  },
  {
    intent: "request_human",
    patterns: [
      /hablar?\s+(?:con|un)\s+(?:humano|persona|alguien|empleado|encargado)/i,
      /quiero?\s+(?:hablar|verme)\s+con/i,
      /transfer(?:ir?|ime)/i,
      /no\s+me\s+respond(?:e|é)/i,
      /soporte/i,
    ],
    priority: 8,
  },
  {
    intent: "check_hours",
    patterns: [
      /horario(?:s)?\s+de\s+(?:atención|apertura|funcionamiento)/i,
      /a?\s+qu[eé]\s+hora\s+(?:abren|cierran|abre|cierra)/i,
      /cuándo\s+(?:abren|cierran|abre|cierra)/i,
      /abierto/i,
    ],
    priority: 5,
  },
  {
    intent: "check_location",
    patterns: [
      /dónde\s+(?:están|está|quedan|queda)/i,
      /dirección/i,
      /ubicación/i,
      /cómo\s+llego/i,
      /google\s+maps/i,
      /mapa/i,
    ],
    priority: 5,
  },
  {
    intent: "general_question",
    patterns: [
      /menú/i,
      /carta/i,
      /platos?/i,
      /bebida/i,
      /precio/i,
      /evento/i,
      /especial/i,
      /promoción/i,
    ],
    priority: 3,
  },
];

/**
 * @summary Clasifica el intent de un mensaje del usuario usando patrones de regex.
 *
 * Retorna el intent con mayor prioridad que coincida, o "unknown" si ninguno matchea.
 * Cuando se implemente un proveedor de IA real, esta función se usa como fallback.
 */
export function classifyIntent(message: string): {
  intent: ReceptionIntent;
  confidence: number;
} {
  const normalized = message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

  let bestIntent: ReceptionIntent = "unknown";
  let bestPriority = -1;
  let confidence = 0;

  for (const { intent, patterns, priority } of INTENT_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(normalized) && priority > bestPriority) {
        bestIntent = intent;
        bestPriority = priority;
        // Confianza base por matching de keyword (será reemplazada por IA real)
        confidence = Math.min(0.95, 0.6 + priority * 0.03);
      }
    }
  }

  // Si el mensaje es muy corto (< 5 chars), reducir confianza
  if (normalized.length < 5 && bestIntent !== "unknown") {
    confidence *= 0.5;
  }

  return { intent: bestIntent, confidence };
}

/**
 * @summary Mapea un intent a las acciones iniciales que la IA puede proponer.
 *
 * Para intents de reserva, reutiliza el servicio real de disponibilidad.
 * Para intents de información, genera respuestas con la knowledge base.
 */
export function intentToActions(
  intent: ReceptionIntent,
  _knowledge?: unknown,
): ReceptionAction[] {
  switch (intent) {
    case "check_hours":
      return [
        {
          type: "reply",
          message:
            "Consultá los horarios de atención en la información del negocio.",
        },
      ];
    case "check_location":
      return [
        {
          type: "reply",
          message:
            "Encontrá nuestra dirección y cómo llegar en la sección de ubicación.",
        },
      ];
    case "check_availability":
      // La IA necesitará llamar a getReservationAvailability para responder
      return [
        {
          type: "reply",
          message:
            "Para consultar disponibilidad necesito la fecha, cantidad de personas y sucursal.",
        },
      ];
    case "create_reservation":
      // La IA necesitará recopilar datos y luego llamar al servicio real
      return [
        {
          type: "reply",
          message:
            "¡Perfecto! Para hacer tu reserva necesito: nombre, teléfono, email, fecha, hora y cantidad de personas.",
        },
      ];
    case "request_human":
      return [
        {
          type: "handoff",
          reason: "El usuario solicitó hablar con una persona.",
        },
      ];
    case "general_question":
      return [
        {
          type: "reply",
          message:
            "Dejame consultar esa información para responderte.",
        },
      ];
    case "unknown":
      return [
        {
          type: "reply",
          message:
            "No estoy seguro de entender tu consulta. ¿Podés reformularla o querés que te transfiera con alguien?",
        },
      ];
    default:
      return [
        {
          type: "reply",
          message: "Procesando tu consulta...",
        },
      ];
  }
}

/**
 * @summary Construye una respuesta completa a partir de un intent clasificado.
 *
 * Esta función orquesta la clasificación, generación de acciones y reply.
 * Será reemplazada por la implementación del proveedor de IA real.
 */
export function buildDefaultResponse(
  message: string,
  _sessionHistory?: unknown[],
): ReceptionResponse {
  const { intent, confidence } = classifyIntent(message);
  const actions = intentToActions(intent);

  const reply =
    actions.find((a) => a.type === "reply")?.type === "reply"
      ? (actions.find((a) => a.type === "reply") as { type: "reply"; message: string }).message
      : "Procesando tu consulta...";

  return {
    intent,
    confidence,
    actions,
    reply,
    requiresConfirmation: [
      "create_reservation",
      "modify_reservation",
      "cancel_reservation",
    ].includes(intent),
    shouldHandoff: intent === "request_human",
    handoffReason:
      intent === "request_human" ? "El usuario solicitó hablar con una persona." : undefined,
  };
}
