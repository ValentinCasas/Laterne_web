"use client";

import { useState } from "react";
import Swal from "sweetalert2";
import { AdminPageHeader } from "@/components/admin/admin-page-header";

type Integration = {
  provider: "mercado_pago" | "email" | "whatsapp" | "web_push" | "storage";
  enabled: boolean;
  mode: string;
  status: string;
  secretConfigured: boolean;
  publicConfig: Record<string, string | null> | null;
  lastCheckAt: string | null;
};

const providerDetails: Record<Integration["provider"], { name: string; description: string; env: string }> = {
  mercado_pago: {
    name: "Mercado Pago",
    description: "Base preparada para pagos. Permanece desactivada en esta etapa.",
    env: "MERCADOPAGO_ACCESS_TOKEN",
  },
  email: {
    name: "Email transaccional",
    description: "Confirmaciones, recuperación de acceso y avisos operativos.",
    env: "EMAIL_API_KEY",
  },
  whatsapp: {
    name: "WhatsApp autorizado",
    description: "Mensajes mediante una cuenta y proveedor aprobados.",
    env: "WHATSAPP_ACCESS_TOKEN",
  },
  web_push: {
    name: "Notificaciones web push",
    description: "Avisos instalables con claves VAPID propias.",
    env: "VAPID_PRIVATE_KEY",
  },
  storage: {
    name: "Almacenamiento externo",
    description: "Archivos y modelos fuera del disco local del despliegue.",
    env: "STORAGE_SECRET_KEY",
  },
};

/** @summary Expone el estado de cada integración sin solicitar ni mostrar credenciales privadas. */
export function IntegrationManager({ initialIntegrations }: { initialIntegrations: Integration[] }) {
  const [integrations, setIntegrations] = useState(initialIntegrations);

  /** @summary Persiste el modo y los identificadores públicos después de verificar la credencial del servidor. */
  async function save(event: React.FormEvent<HTMLFormElement>, integration: Integration) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: integration.provider,
        enabled: form.get("enabled") === "on",
        mode: form.get("mode"),
        accountLabel: form.get("accountLabel"),
        publicIdentifier: form.get("publicIdentifier"),
      }),
    });
    const body = (await response.json().catch(() => ({}))) as { integration?: Integration; error?: string };
    if (!response.ok || !body.integration) {
      await Swal.fire({
        title: "No se pudo guardar",
        text: body.error,
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
      return;
    }
    setIntegrations((current) =>
      current.map((item) =>
        item.provider === integration.provider ? { ...item, ...body.integration } : item,
      ),
    );
    await Swal.fire({
      title: "Integración actualizada",
      icon: "success",
      timer: 1200,
      showConfirmButton: false,
      background: "#18181b",
      color: "#fafafa",
    });
  }

  return (
    <section>
      <AdminPageHeader
        eyebrow="Conexiones"
        title="Integraciones"
        description="Las claves privadas se configuran únicamente en el servidor. Nunca se guardan ni se muestran en el panel."
        section="integraciones"
      />
      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        {integrations.map((integration) => {
          const details = providerDetails[integration.provider];
          const payment = integration.provider === "mercado_pago";
          const upcoming = integration.provider !== "storage";
          return (
            <form
              className="card p-6"
              key={integration.provider}
              onSubmit={(event) => void save(event, integration)}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black">{details.name}</h2>
                  <p className="mt-2 text-sm text-zinc-500">{details.description}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-black ${integration.secretConfigured ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}
                >
                  {integration.secretConfigured ? "Credencial detectada" : "Falta credencial"}
                </span>
                {upcoming && (
                  <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-black uppercase text-zinc-400">
                    Próximamente
                  </span>
                )}
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="label">Modo</span>
                  <select className="input" name="mode" defaultValue={integration.mode} disabled={payment}>
                    <option value="disabled">Desactivado</option>
                    <option value="sandbox">Pruebas</option>
                    <option value="live">Producción</option>
                  </select>
                </label>
                <label>
                  <span className="label">Cuenta visible</span>
                  <input
                    className="input"
                    name="accountLabel"
                    defaultValue={integration.publicConfig?.accountLabel ?? ""}
                    placeholder="Nombre interno"
                  />
                </label>
                <label className="sm:col-span-2">
                  <span className="label">Identificador público</span>
                  <input
                    className="input"
                    name="publicIdentifier"
                    defaultValue={integration.publicConfig?.publicIdentifier ?? ""}
                  />
                </label>
              </div>
              <p className="mt-3 rounded-xl bg-white/[.03] p-3 font-mono text-xs text-zinc-500">
                Variable requerida: {details.env}
              </p>
              <div className="mt-5 flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm font-bold">
                  <input
                    name="enabled"
                    type="checkbox"
                    defaultChecked={integration.enabled}
                    disabled={payment || upcoming || !integration.secretConfigured}
                  />{" "}
                  Habilitada
                </label>
                <button className="btn">Guardar</button>
              </div>
              {(payment || upcoming) && (
                <p className="mt-3 text-xs text-amber-300">
                  Disponible próximamente. Esta integración todavía no envía ni recibe información.
                </p>
              )}
            </form>
          );
        })}
      </div>
    </section>
  );
}
