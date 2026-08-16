"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import Swal from "sweetalert2";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { scopedFetch } from "@/lib/client-routing";
import { adminHrefFromPathname, parseCanonicalPath, publicHrefForContext } from "@/lib/routes";

const steps = [
  [1, "Datos del negocio", "Dirección, contacto y redes", "/admin/negocio"],
  [2, "Logo y colores", "Identidad visual centralizada", "/admin/marca"],
  [3, "Ubicación", "Punto exacto en el mapa", "/admin/negocio"],
  [4, "Horarios", "Días y turnos de atención", "/admin/horarios"],
  [5, "Categorías", "Estructura de la carta", "/admin/categorias"],
  [6, "Productos", "Precios, imágenes y opciones", "/admin/productos"],
  [7, "Medios de pedido", "WhatsApp, retiro, mesa y delivery", "/admin/pedidos"],
  [8, "Reservas", "Capacidad, sectores y políticas", "/admin/reservas"],
  [9, "Dominio", "URL propia y presencia digital", "/admin/marca"],
  [10, "Publicación", "Revisión final y salida online", "/carta"],
] as const;

/** @summary Guía la puesta en marcha, muestra avance y guarda cada paso completado. */
export function OnboardingWizard({
  initialCompleted,
  automaticCompleted,
  publishedAt,
}: {
  initialCompleted: number[];
  automaticCompleted: number[];
  publishedAt: string | null;
}) {
  const pathname = usePathname();
  const route = parseCanonicalPath(pathname);
  const stepHref = (href: string) =>
    href === "/carta" && route.tenantSlug
      ? publicHrefForContext(route.tenantSlug, href, route.branchSlug)
      : adminHrefFromPathname(pathname, href);
  const [completed, setCompleted] = useState([...new Set([...initialCompleted, ...automaticCompleted])]);
  const percentage = completed.length * 10;

  /** @summary Alterna un paso y persiste inmediatamente el nuevo porcentaje de avance. */
  async function toggle(step: number) {
    const next = completed.includes(step) ? completed.filter((item) => item !== step) : [...completed, step];
    setCompleted(next);
    await scopedFetch("/api/admin/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completedSteps: next, currentStep: step }),
    });
  }

  /** @summary Confirma la revisión final y marca el negocio como publicado en el asistente. */
  async function publish() {
    const response = await scopedFetch("/api/admin/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completedSteps: completed, currentStep: 10, publish: true }),
    });
    await Swal.fire({
      title: response.ok ? "Configuración publicada" : "No se pudo publicar",
      text: response.ok
        ? "El checklist quedó registrado. La carta pública ya puede compartirse."
        : "Revisá la conexión e intentá nuevamente.",
      icon: response.ok ? "success" : "error",
      background: "#18181b",
      color: "#fafafa",
    });
  }

  return (
    <section>
      <AdminPageHeader
        eyebrow="Puesta en marcha"
        title="Tu negocio, paso a paso"
        description="Podés salir, volver y continuar. Los pasos con información real se reconocen automáticamente."
        section="onboarding"
      >
        <div className="mt-6 flex items-end gap-4">
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/10">
            <span
              className="block h-full rounded-full bg-pink-500 transition-all"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <strong className="text-3xl text-pink-300">{percentage}%</strong>
        </div>
        {publishedAt && (
          <p className="mt-3 text-sm text-emerald-300">
            Última publicación: {new Date(publishedAt).toLocaleString("es-AR")}
          </p>
        )}
      </AdminPageHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        {steps.map(([number, title, description, href]) => {
          const done = completed.includes(number);
          const automatic = automaticCompleted.includes(number);
          return (
            <article
              className={`rounded-3xl border p-5 ${done ? "border-emerald-500/30 bg-emerald-500/5" : "border-white/10 bg-white/5"}`}
              key={number}
            >
              <div className="flex items-start gap-4">
                <button
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl font-black ${done ? "bg-emerald-500 text-black" : "bg-white/10"}`}
                  onClick={() => toggle(number)}
                  type="button"
                  aria-pressed={done}
                >
                  {done ? "✓" : number}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-black">{title}</h2>
                    {automatic && (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-black text-emerald-300">
                        Detectado
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-zinc-500">{description}</p>
                  <Link className="mt-3 inline-block text-sm font-bold text-pink-300" href={stepHref(href)}>
                    Abrir configuración →
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <div className="mt-6 flex justify-end">
        <button className="btn min-w-52" onClick={publish} disabled={percentage < 70}>
          Revisar y publicar
        </button>
      </div>
      {percentage < 70 && (
        <p className="mt-2 text-right text-xs text-zinc-500">Completá al menos 7 pasos para publicar.</p>
      )}
    </section>
  );
}
