"use client";

import { useState } from "react";
import Swal from "sweetalert2";
import { PageHeader, FormSection } from "@/components/admin/ui";
import { scopedFetch } from "@/lib/client-routing";

type FaqItem = { question: string; answer: string; category?: string };

type AssistantConfig = {
  tone?: "formal" | "casual" | "friendly";
  language?: string;
  maxMessagesBeforeHandoff?: number;
  alwaysHandoffCategories?: string[];
  activeHours?: { start: string; end: string } | null;
  greeting?: string;
  farewell?: string;
};

type KnowledgeData = {
  id: number;
  businessName: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  timezone: string;
  openingHoursText: string | null;
  reservationPolicy: string | null;
  faqs: FaqItem[];
  locationInfo: Record<string, unknown> | null;
  assistantConfig: AssistantConfig | null;
  enabled: boolean;
};

type BranchInfo = { id: number; name: string; slug: string };

/** @summary Defaults vacíos cuando no existe configuración para el tenant. */
const EMPTY_KNOWLEDGE: KnowledgeData = {
  id: 0,
  businessName: null,
  address: null,
  phone: null,
  email: null,
  website: null,
  timezone: "America/Argentina/Buenos_Aires",
  openingHoursText: null,
  reservationPolicy: null,
  faqs: [],
  locationInfo: null,
  assistantConfig: null,
  enabled: false,
};

/**
 * @summary Componente client para configurar la base de conocimiento de la recepcionista IA.
 *
 * Permite editar información del negocio, horarios, políticas de reserva,
 * FAQs, configuración del asistente y activar/desactivar la asistente.
 * Si no hay configuración previa (initialKnowledge null), muestra defaults vacíos.
 * El registro se crea en la base únicamente cuando el usuario guarda.
 * NO implementa IA real ni muestra chat funcional.
 */
export function ReceptionAssistantConfig({
  initialKnowledge,
  branches,
}: {
  initialKnowledge: KnowledgeData | null;
  branches: BranchInfo[];
}) {
  const [knowledge, setKnowledge] = useState<KnowledgeData>(
    initialKnowledge ?? EMPTY_KNOWLEDGE,
  );
  const [saving, setSaving] = useState(false);

  const config = knowledge.assistantConfig ?? {};

  /** @summary Guarda toda la configuración de conocimiento en un solo POST. */
  async function handleSave() {
    setSaving(true);
    try {
      const response = await scopedFetch("/api/admin/reception-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: knowledge.businessName,
          address: knowledge.address,
          phone: knowledge.phone,
          email: knowledge.email,
          website: knowledge.website,
          timezone: knowledge.timezone,
          openingHoursText: knowledge.openingHoursText,
          reservationPolicy: knowledge.reservationPolicy,
          faqs: knowledge.faqs,
          locationInfo: knowledge.locationInfo,
          assistantConfig: knowledge.assistantConfig,
          enabled: knowledge.enabled,
        }),
      });
      await Swal.fire({
        title: response.ok ? "Configuración guardada" : "No se pudo guardar",
        icon: response.ok ? "success" : "error",
        timer: response.ok ? 1600 : undefined,
        showConfirmButton: !response.ok,
        background: "#18181b",
        color: "#fafafa",
      });
    } finally {
      setSaving(false);
    }
  }

  /** @summary Agrega una FAQ vacía al formulario. */
  function addFaq() {
    setKnowledge((prev) => ({
      ...prev,
      faqs: [...prev.faqs, { question: "", answer: "", category: "" }],
    }));
  }

  /** @summary Elimina una FAQ por índice. */
  function removeFaq(index: number) {
    setKnowledge((prev) => ({
      ...prev,
      faqs: prev.faqs.filter((_, i) => i !== index),
    }));
  }

  /** @summary Actualiza un campo de una FAQ específica. */
  function updateFaq(index: number, field: keyof FaqItem, value: string) {
    setKnowledge((prev) => ({
      ...prev,
      faqs: prev.faqs.map((faq, i) =>
        i === index ? { ...faq, [field]: value } : faq,
      ),
    }));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSave();
      }}
    >
      <PageHeader
        eyebrow="IA"
        title="Recepcionista IA"
        description="Base de conocimiento y comportamiento de la asistente virtual. Estos datos se usarán cuando se conecte un proveedor de IA."
        section="recepcionista-ia"
      />

      <div className="mb-6 flex items-center gap-4">
        <label className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2">
          <input
            type="checkbox"
            checked={knowledge.enabled}
            onChange={(e) =>
              setKnowledge((prev) => ({ ...prev, enabled: e.target.checked }))
            }
          />
          <span className="font-medium">Habilitar asistente virtual</span>
        </label>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* ── Información del negocio ────────────────────────────────── */}
        <FormSection title="Información del negocio">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-zinc-400">Nombre comercial</label>
              <input
                type="text"
                className="input"
                value={knowledge.businessName ?? ""}
                onChange={(e) =>
                  setKnowledge((prev) => ({ ...prev, businessName: e.target.value || null }))
                }
                placeholder="Ej: Pizzería Don Carlo"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-zinc-400">Dirección</label>
              <input
                type="text"
                className="input"
                value={knowledge.address ?? ""}
                onChange={(e) =>
                  setKnowledge((prev) => ({ ...prev, address: e.target.value || null }))
                }
                placeholder="Av. Principal 1234, Buenos Aires"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Teléfono</label>
                <input
                  type="text"
                  className="input"
                  value={knowledge.phone ?? ""}
                  onChange={(e) =>
                    setKnowledge((prev) => ({ ...prev, phone: e.target.value || null }))
                  }
                  placeholder="+54 11 1234-5678"
                />
              </div>
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  className="input"
                  value={knowledge.email ?? ""}
                  onChange={(e) =>
                    setKnowledge((prev) => ({ ...prev, email: e.target.value || null }))
                  }
                  placeholder="info@doncarlo.com"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Sitio web</label>
                <input
                  type="url"
                  className="input"
                  value={knowledge.website ?? ""}
                  onChange={(e) =>
                    setKnowledge((prev) => ({ ...prev, website: e.target.value || null }))
                  }
                  placeholder="https://doncarlo.com"
                />
              </div>
              <div>
                <label className="label">Zona horaria</label>
                <input
                  type="text"
                  className="input"
                  value={knowledge.timezone}
                  onChange={(e) =>
                    setKnowledge((prev) => ({
                      ...prev,
                      timezone: e.target.value || "America/Argentina/Buenos_Aires",
                    }))
                  }
                  placeholder="America/Argentina/Buenos_Aires"
                />
              </div>
            </div>
          </div>
        </FormSection>

        {/* ── Configuración del asistente ────────────────────────────── */}
        <FormSection title="Comportamiento de la IA">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-zinc-400">Tono</label>
              <select
                className="input"
                value={config.tone ?? "friendly"}
                onChange={(e) =>
                  setKnowledge((prev) => ({
                    ...prev,
                    assistantConfig: {
                      ...prev.assistantConfig,
                      tone: e.target.value as AssistantConfig["tone"],
                    },
                  }))
                }
              >
                <option value="friendly">Amigable</option>
                <option value="casual">Casual</option>
                <option value="formal">Formal</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Idioma</label>
                <input
                  type="text"
                  className="input"
                  value={config.language ?? "es"}
                  onChange={(e) =>
                    setKnowledge((prev) => ({
                      ...prev,
                      assistantConfig: {
                        ...prev.assistantConfig,
                        language: e.target.value || "es",
                      },
                    }))
                  }
                  placeholder="es"
                />
              </div>
              <div>
                <label className="label">Máx. mensajes antes de handoff</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  className="input"
                  value={config.maxMessagesBeforeHandoff ?? 10}
                  onChange={(e) =>
                    setKnowledge((prev) => ({
                      ...prev,
                      assistantConfig: {
                        ...prev.assistantConfig,
                        maxMessagesBeforeHandoff: Number(e.target.value) || 10,
                      },
                    }))
                  }
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm text-zinc-400">Mensaje de saludo</label>
              <input
                type="text"
                className="input"
                value={config.greeting ?? ""}
                onChange={(e) =>
                  setKnowledge((prev) => ({
                    ...prev,
                    assistantConfig: {
                      ...prev.assistantConfig,
                      greeting: e.target.value || undefined,
                    },
                  }))
                }
                placeholder="¡Hola! ¿En qué puedo ayudarte?"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-zinc-400">Mensaje de despedida</label>
              <input
                type="text"
                className="input"
                value={config.farewell ?? ""}
                onChange={(e) =>
                  setKnowledge((prev) => ({
                    ...prev,
                    assistantConfig: {
                      ...prev.assistantConfig,
                      farewell: e.target.value || undefined,
                    },
                  }))
                }
                placeholder="¡Gracias por escribirnos! ¡Hasta pronto!"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-zinc-400">
                Categorías que siempre transfieren a humano (separadas por coma)
              </label>
              <input
                type="text"
                className="input"
                value={(config.alwaysHandoffCategories ?? []).join(", ")}
                onChange={(e) =>
                  setKnowledge((prev) => ({
                    ...prev,
                    assistantConfig: {
                      ...prev.assistantConfig,
                      alwaysHandoffCategories: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    },
                  }))
                }
                placeholder="queja, reclamo, legal"
              />
            </div>
          </div>
        </FormSection>
      </div>

      {/* ── Horarios de atención ─────────────────────────────────────── */}
      <div className="mt-6">
        <FormSection title="Horarios de atención">
          <textarea
            rows={4}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2"
            value={knowledge.openingHoursText ?? ""}
            onChange={(e) =>
              setKnowledge((prev) => ({
                ...prev,
                openingHoursText: e.target.value || null,
              }))
            }
            placeholder={"Lunes a Viernes: 11:00 - 23:00\nSábados: 11:00 - 01:00\nDomingos: 12:00 - 22:00"}
          />
          <p className="mt-1 text-xs text-zinc-500">
            Texto libre que la IA usará para responder consultas de horarios.
          </p>
        </FormSection>
      </div>

      {/* ── Política de reservas ─────────────────────────────────────── */}
      <div className="mt-6">
        <FormSection title="Política de reservas">
          <textarea
            rows={4}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2"
            value={knowledge.reservationPolicy ?? ""}
            onChange={(e) =>
              setKnowledge((prev) => ({
                ...prev,
                reservationPolicy: e.target.value || null,
              }))
            }
            placeholder="Ej: Reservas para grupos de hasta 20 personas. Se requiere 24h de anticipación. No se-guardan mesas por más de 15 minutos."
          />
          <p className="mt-1 text-xs text-zinc-500">
            Política pública que la IA usará para informar sobre reservas.
          </p>
        </FormSection>
      </div>

      {/* ── Sucursales ──────────────────────────────────────────────── */}
      {branches.length > 0 && (
        <div className="mt-6">
          <FormSection title="Sucursales disponibles">
            <div className="space-y-2">
              {branches.map((branch) => (
                <div
                  key={branch.id}
                  className="flex items-center gap-3 rounded-xl border border-white/10 px-4 py-2"
                >
                  <span className="font-medium">{branch.name}</span>
                  <span className="text-xs text-zinc-500">/{branch.slug}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              La IA conocerá las sucursales activas para responder consultas de ubicación y disponibilidad.
            </p>
          </FormSection>
        </div>
      )}

      {/* ── FAQs ────────────────────────────────────────────────────── */}
      <div className="mt-6">
        <FormSection title="Preguntas frecuentes">
          <div className="space-y-4">
            {knowledge.faqs.map((faq, index) => (
              <div
                key={index}
                className="rounded-xl border border-white/10 p-4"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <input
                    type="text"
                    className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
                    value={faq.question}
                    onChange={(e) => updateFaq(index, "question", e.target.value)}
                    placeholder="Pregunta"
                  />
                  <button
                    type="button"
                    onClick={() => removeFaq(index)}
                    className="shrink-0 rounded-lg border border-red-500/30 px-2 py-1 text-xs text-red-400 hover:bg-red-500/10"
                  >
                    Quitar
                  </button>
                </div>
                <textarea
                  rows={2}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
                  value={faq.answer}
                  onChange={(e) => updateFaq(index, "answer", e.target.value)}
                  placeholder="Respuesta"
                />
                <input
                  type="text"
                  className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs"
                  value={faq.category ?? ""}
                  onChange={(e) => updateFaq(index, "category", e.target.value)}
                  placeholder="Categoría (opcional)"
                />
              </div>
            ))}
            <button
              type="button"
              onClick={addFaq}
              className="rounded-xl border border-dashed border-white/20 px-4 py-2 text-sm text-zinc-400 hover:border-white/40 hover:text-zinc-200"
            >
              + Agregar pregunta frecuente
            </button>
          </div>
        </FormSection>
      </div>

      {/* ── Guardar ─────────────────────────────────────────────────── */}
      <div className="mt-8 flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="btn min-w-48"
        >
          {saving ? "Guardando..." : "Guardar configuración"}
        </button>
      </div>
    </form>
  );
}
