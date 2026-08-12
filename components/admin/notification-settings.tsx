"use client";

import { useState } from "react";
import Swal from "sweetalert2";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { scopedFetch } from "@/lib/client-routing";

export type NotificationSettingsData = {
  panel: boolean;
  email: boolean;
  whatsapp: boolean;
  webPush: boolean;
  events: unknown;
};
const eventOptions = [
  ["order.new", "Pedido nuevo"],
  ["order.status", "Cambio de pedido"],
  ["reservation.new", "Reserva nueva"],
  ["reservation.status", "Cambio de reserva"],
  ["product.sold_out", "Producto agotado"],
  ["testimonial.pending", "Testimonio pendiente"],
  ["lead.new", "Consulta comercial"],
  ["promotion.expiring", "Promoción por vencer"],
  ["support.new", "Consulta de soporte"],
] as const;

/** @summary Configura eventos y canales, distinguiendo los disponibles de futuras integraciones. */
export function NotificationSettings({ initialSettings }: { initialSettings: NotificationSettingsData }) {
  const [events, setEvents] = useState<string[]>(
    Array.isArray(initialSettings.events)
      ? initialSettings.events.filter((item): item is string => typeof item === "string")
      : eventOptions.map(([value]) => value),
  );

  /** @summary Guarda canales y tipos de aviso seleccionados por el negocio. */
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await scopedFetch("/api/admin/notifications/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        panel: form.get("panel") === "on",
        email: form.get("email") === "on",
        whatsapp: form.get("whatsapp") === "on",
        webPush: form.get("webPush") === "on",
        events,
      }),
    });
    await Swal.fire({
      title: response.ok ? "Preferencias guardadas" : "No se pudo guardar",
      icon: response.ok ? "success" : "error",
      timer: response.ok ? 1600 : undefined,
      showConfirmButton: !response.ok,
      background: "#18181b",
      color: "#fafafa",
    });
  }

  return (
    <form onSubmit={save}>
      <AdminPageHeader
        eyebrow="Avisos"
        title="Notificaciones"
        description="Elegí qué eventos se muestran en el panel. Los canales externos estarán disponibles próximamente."
        section="notificaciones"
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card p-5 sm:p-7">
          <h2 className="text-2xl font-black">Canales</h2>
          <div className="mt-5 space-y-3">
            <label className="flex justify-between rounded-2xl border border-white/10 p-4">
              <span>
                <strong>Panel</strong>
                <small className="block text-zinc-500">Disponible ahora</small>
              </span>
              <input name="panel" type="checkbox" defaultChecked={initialSettings.panel} />
            </label>
            <label className="flex justify-between rounded-2xl border border-white/10 p-4 opacity-70">
              <span>
                <strong>Email</strong>
                <small className="block text-zinc-500">Próximamente · requiere proveedor de correo transaccional</small>
              </span>
              <span className="flex items-center gap-3">
                <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-zinc-400">
                  Próximamente
                </span>
                <input name="email" type="checkbox" disabled />
              </span>
            </label>
            <label className="flex justify-between rounded-2xl border border-white/10 p-4 opacity-70">
              <span>
                <strong>WhatsApp</strong>
                <small className="block text-zinc-500">Próximamente · requiere API oficial autorizada</small>
              </span>
              <span className="flex items-center gap-3">
                <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-zinc-400">
                  Próximamente
                </span>
                <input name="whatsapp" type="checkbox" disabled />
              </span>
            </label>
            <label className="flex justify-between rounded-2xl border border-white/10 p-4 opacity-70">
              <span>
                <strong>Web push</strong>
                <small className="block text-zinc-500">Próximamente · requiere claves VAPID</small>
              </span>
              <span className="flex items-center gap-3">
                <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-zinc-400">
                  Próximamente
                </span>
                <input name="webPush" type="checkbox" disabled />
              </span>
            </label>
          </div>
        </section>
        <section className="card p-5 sm:p-7">
          <h2 className="text-2xl font-black">Eventos</h2>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {eventOptions.map(([value, label]) => (
              <label
                className="flex items-center gap-3 rounded-2xl border border-white/10 p-3 text-sm"
                key={value}
              >
                <input
                  type="checkbox"
                  checked={events.includes(value)}
                  onChange={(event) =>
                    setEvents((current) =>
                      event.target.checked ? [...current, value] : current.filter((item) => item !== value),
                    )
                  }
                />
                {label}
              </label>
            ))}
          </div>
        </section>
      </div>
      <div className="mt-6 flex justify-end">
        <button className="btn min-w-48">Guardar preferencias</button>
      </div>
    </form>
  );
}
