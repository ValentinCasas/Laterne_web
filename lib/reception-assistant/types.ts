/**
 * @summary Tipos y contratos para la futura recepcionista IA.
 *
 * Este módulo define la arquitectura de intents, eventos, sesiones de
 * conversación y resultados de acciones. NO contiene lógica de IA real;
 * sirve como contrato para futuras implementaciones de proveedores
 * (OpenAI, Copilot, WhatsApp, Telegram, etc.).
 */

/* ================================================================
   INTENTS — Clasificación de la intención del usuario
   ================================================================ */

/**
 * Intents conocidos que la recepcionista IA debe poder manejar.
 * Cada intent se mapea a una acción concreta en el sistema.
 */
export const RECEPTION_INTENTS = [
  /** El usuario quiere saber horarios de atención. */
  "check_hours",
  /** El usuario quiere saber la dirección / ubicación. */
  "check_location",
  /** El usuario quiere consultar disponibilidad de una fecha/horario. */
  "check_availability",
  /** El usuario quiere crear una reserva nueva. */
  "create_reservation",
  /** El usuario quiere modificar una reserva existente. */
  "modify_reservation",
  /** El usuario quiere cancelar una reserva existente. */
  "cancel_reservation",
  /** El usuario tiene una pregunta general (menú, eventos, etc.). */
  "general_question",
  /** El usuario quiere hablar con una persona. */
  "request_human",
  /** No se pudo clasificar la intención. */
  "unknown",
] as const;

export type ReceptionIntent = (typeof RECEPTION_INTENTS)[number];

/* ================================================================
   ACCIONES — Resultado que la IA propone o ejecuta
   ================================================================ */

/** Acción propuesta o confirmada por la IA. */
export type ReceptionAction =
  | { type: "reply"; message: string }
  | {
      type: "check_availability";
      input: {
        date: string;
        partySize: number;
        branchSlug?: string;
        sector?: string;
      };
    }
  | {
      type: "create_reservation";
      input: ReservationInput;
    }
  | {
      type: "modify_reservation";
      reservationId: number;
      input: Partial<ReservationInput>;
    }
  | {
      type: "cancel_reservation";
      reservationId: number;
      reason?: string;
    }
  | {
      type: "handoff";
      reason: string;
      /** Contexto que el humano debe ver al atender. */
      context?: string;
    };

/* ================================================================
   ENTRADA DE RESERVA — Datos necesarios para crear/modificar
   ================================================================ */

/** Datos de entrada para una reserva, reutiliza validación del servicio real. */
export interface ReservationInput {
  customerName: string;
  phone: string;
  email: string;
  date: string;
  time: string;
  partySize: number;
  sector?: string;
  reason?: string;
  notes?: string;
  branchSlug?: string;
}

/* ================================================================
   SESIÓN DE CONVERSACIÓN
   ================================================================ */

/** Estado de una sesión de conversación externa. */
export type ConversationStatus = "active" | "expired" | "closed" | "handed_off";

/** Canal de origen de la conversación. */
export type ConversationChannel = "web" | "whatsapp" | "telegram" | "sms" | "phone";

/** Representación de una sesión de conversación (sin datos sensibles innecesarios). */
export interface ConversationSession {
  id: number;
  tenantId: number;
  branchId?: number | null;
  externalId: string;
  channel: ConversationChannel;
  customerName?: string | null;
  status: ConversationStatus;
  lastActivityAt: Date;
  handoffPending: boolean;
  handoffReason?: string | null;
  createdAt: Date;
}

/** Rol de un mensaje en la conversación. */
export type MessageRole = "user" | "assistant" | "system" | "handoff";

/** Mensaje de una conversación. */
export interface ConversationMessage {
  id: number;
  sessionId: number;
  role: MessageRole;
  content: string;
  intent?: ReceptionIntent | null;
  actionType?: string | null;
  reservationId?: number | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
}

/* ================================================================
   CONOCIMIENTO DEL NEGOCIO (Knowledge Base)
   ================================================================ */

/** FAQ configurada por el tenant. */
export interface BusinessFAQ {
  question: string;
  answer: string;
  category?: string;
}

/** Información de ubicación para la IA. */
export interface LocationInfo {
  address?: string;
  city?: string;
  province?: string;
  latitude?: number;
  longitude?: number;
  googleMapsUrl?: string;
  parkingInfo?: string;
  publicTransport?: string;
}

/** Configuración de comportamiento de la IA. */
export interface AssistantConfig {
  /** Tono de la IA: formal, casual, friendly. */
  tone?: "formal" | "casual" | "friendly";
  /** Idioma preferido de respuesta. */
  language?: string;
  /** Límite máximo de mensajes antes de sugerir handoff. */
  maxMessagesBeforeHandoff?: number;
  /** Categorías de preguntas que siempre transfieren a humano. */
  alwaysHandoffCategories?: string[];
  /** Horario en que la IA está activa (null = siempre). */
  activeHours?: { start: string; end: string } | null;
  /** Mensaje de saludo inicial. */
  greeting?: string;
  /** Mensaje de despedida. */
  farewell?: string;
}

/** Base de conocimiento completa del negocio para la IA. */
export interface BusinessKnowledge {
  tenantId: number;
  businessName?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  timezone: string;
  openingHoursText?: string | null;
  reservationPolicy?: string | null;
  faqs: BusinessFAQ[];
  locationInfo?: LocationInfo | null;
  assistantConfig: AssistantConfig;
  enabled: boolean;
}

/* ================================================================
   RESULTADO DE PROCESAMIENTO
   ================================================================ */

/** Resultado de procesar un mensaje del usuario. */
export interface ReceptionResponse {
  /** Intent clasificado. */
  intent: ReceptionIntent;
  /** Confianza de la clasificación (0-1). */
  confidence: number;
  /** Acciones propuestas (pueden requerir confirmación humana). */
  actions: ReceptionAction[];
  /** Mensaje de respuesta para el usuario. */
  reply: string;
  /** Si se requiere confirmación del usuario antes de ejecutar. */
  requiresConfirmation: boolean;
  /** Si la sesión debe transferirse a humano. */
  shouldHandoff: boolean;
  handoffReason?: string;
}

/* ================================================================
   AUDITORÍA
   ================================================================ */

/** Tipos de acción auditables para la recepcionista IA. */
export const RECEPTION_AUDIT_ACTIONS = [
  /** Mensaje recibido del usuario. */
  "reception.message_received",
  /** Intent clasificado. */
  "reception.intent_classified",
  /** Acción propuesta (pendiente de confirmación). */
  "reception.action_proposed",
  /** Acción confirmada por el usuario. */
  "reception.action_confirmed",
  /** Acción ejecutada exitosamente. */
  "reception.action_executed",
  /** Acción rechazada por el usuario. */
  "reception.action_rejected",
  /** Handoff a humano iniciado. */
  "reception.handoff_initiated",
  /** Sesión expirada. */
  "reception.session_expired",
] as const;

export type ReceptionAuditAction = (typeof RECEPTION_AUDIT_ACTIONS)[number];

/* ================================================================
   CONTRATO DE PROVEEDOR (Provider)
   ================================================================ */

/**
 * Contrato que debe implementar cualquier proveedor de IA futuro.
 * Cada proveedor (OpenAI, Copilot, Claude, etc.) implementará
 * esta interfaz para procesar mensajes y generar respuestas.
 */
export interface ReceptionAssistantProvider {
  /** Identificador único del proveedor. */
  readonly id: string;

  /** Nombre legible del proveedor. */
  readonly name: string;

  /**
   * Procesa un mensaje del usuario y devuelve una respuesta con intents,
   * acciones propuestas y reply.
   */
  processMessage(params: {
    session: ConversationSession;
    message: string;
    knowledge: BusinessKnowledge;
    conversationHistory: ConversationMessage[];
  }): Promise<ReceptionResponse>;

  /**
   * Valida si el proveedor está configurado y disponible.
   */
  isAvailable(): Promise<boolean>;
}
