"use client";

import { useState } from "react";
import Swal from "sweetalert2";
import { PageHeader, StatusBadge } from "@/components/admin/ui";
import { scopedFetch } from "@/lib/client-routing";

type Integration = {
  provider: "mercado_pago" | "email" | "whatsapp" | "web_push" | "storage";
  enabled: boolean;
  mode: string;
  status: string;
  secretConfigured: boolean;
  publicConfig: Record<string, string | null> | null;
  lastCheckAt: string | null;
};

type MapProvider = {
  provider: "openfreemap";
  enabled: boolean;
  status: string;
  lastCheckAt: string | null;
  persisted: boolean;
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
export function IntegrationManager({
  initialIntegrations,
  initialMapProvider,
}: {
  initialIntegrations: Integration[];
  initialMapProvider: MapProvider;
}) {
  const [integrations, setIntegrations] = useState(initialIntegrations);
  const [mapProvider, setMapProvider] = useState(initialMapProvider);
  const [savingMap, setSavingMap] = useState(false);

  /** @summary Persiste la preferencia del mapa; OpenFreeMap no requiere ni almacena una API key. */
  async function saveMapProvider(enabled: boolean) {
    setSavingMap(true);
    try {
      const response = await scopedFetch("/api/admin/delivery/provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "openfreemap", enabled }),
      });
      const body = (await response.json().catch(() => ({}))) as { provider?: MapProvider; error?: string };
      if (!response.ok || !body.provider) {
        await Swal.fire({
          title: "No se pudo guardar",
          text: body.error ?? "Intentá nuevamente.",
          icon: "error",
          background: "#18181b",
          color: "#fafafa",
        });
        return;
      }
      setMapProvider(body.provider);
      await Swal.fire({
        title: enabled ? "Mapa habilitado" : "Mapa pausado",
        icon: "success",
        timer: 1200,
        showConfirmButton: false,
        background: "#18181b",
        color: "#fafafa",
      });
    } finally {
      setSavingMap(false);
    }
  }

  /** @summary Persiste el modo y los identificadores públicos después de verificar la credencial del servidor. */
  async function save(event: React.FormEvent<HTMLFormElement>, integration: Integration) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await scopedFetch("/api/admin/integrations", {
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
      <PageHeader
        eyebrow="Conexiones"
        title="Integraciones"
        description="Las claves privadas se configuran únicamente en el servidor. Nunca se guardan ni se muestran en el panel."
        section="integraciones"
      />
      <div className="mt-6">
        <section id="delivery-map" className="card min-w-0 scroll-mt-24 space-y-4 p-4 sm:p-5">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-black">OpenFreeMap</h2>
              <p className="mt-1 text-sm leading-relaxed text-zinc-500">
                Mapa de Delivery con estilo Liberty. Es el proveedor predeterminado y no requiere API key.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!mapProvider.persisted && <StatusBadge status="Predeterminado" tone="info" />}
              <StatusBadge
                status={mapProvider.enabled ? "Activo" : "Inactivo"}
                tone={mapProvider.enabled ? "success" : "default"}
              />
            </div>
          </div>
          <div className="rounded-lg bg-white/[.03] px-3 py-2 text-xs text-zinc-400">
            Sin credenciales · Sin variable de entorno · Tiles vectoriales de OpenStreetMap
          </div>
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-4">
            <div>
              <p className="text-sm font-bold text-white">Vista geográfica de Delivery</p>
              <p className="text-xs text-zinc-500">
                {mapProvider.enabled ? "Visible para administradores autorizados." : "Oculta por decisión del tenant."}
              </p>
            </div>
            <button
              type="button"
              className={mapProvider.enabled ? "admin-button-secondary" : "btn bg-emerald-600 text-white hover:bg-emerald-500"}
              disabled={savingMap}
              onClick={() => void saveMapProvider(!mapProvider.enabled)}
            >
              {savingMap ? "Guardando…" : mapProvider.enabled ? "Desactivar" : "Activar OpenFreeMap"}
            </button>
          </div>
        </section>
      </div>
      <div className="mt-6 grid min-w-0 gap-5 xl:grid-cols-2">
        {integrations.map((integration) => {
          const details = providerDetails[integration.provider];
          const payment = integration.provider === "mercado_pago";
          const upcoming = integration.provider !== "storage";
          return (
            <form
              className="card min-w-0 space-y-4 p-4 sm:p-5"
              key={integration.provider}
              onSubmit={(event) => void save(event, integration)}
            >
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-black">{details.name}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-500">{details.description}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {upcoming && <StatusBadge status="Próximamente" tone="default" />}
                  <StatusBadge
                    status={integration.secretConfigured ? "Credencial detectada" : "Falta credencial"}
                    tone={integration.secretConfigured ? "success" : "warning"}
                  />
                </div>
              </div>
              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <label className="min-w-0">
                  <span className="label">Modo</span>
                  <select className="input" name="mode" defaultValue={integration.mode} disabled={payment}>
                    <option value="disabled">Desactivado</option>
                    <option value="sandbox">Pruebas</option>
                    <option value="live">Producción</option>
                  </select>
                </label>
                <label className="min-w-0">
                  <span className="label">Cuenta visible</span>
                  <input
                    className="input"
                    name="accountLabel"
                    defaultValue={integration.publicConfig?.accountLabel ?? ""}
                    placeholder="Nombre interno"
                  />
                </label>
                <label className="min-w-0 sm:col-span-2">
                  <span className="label">Identificador público</span>
                  <input
                    className="input"
                    name="publicIdentifier"
                    defaultValue={integration.publicConfig?.publicIdentifier ?? ""}
                    placeholder="ID o número de cuenta"
                  />
                </label>
              </div>
              <p className="min-w-0 break-words rounded-lg bg-white/[.03] px-3 py-2 font-mono text-xs text-zinc-500">
                Variable requerida: {details.env}
              </p>
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-4">
                <label className="flex items-center gap-2 text-sm font-bold">
                  <input
                    name="enabled"
                    type="checkbox"
                    defaultChecked={integration.enabled}
                    disabled={payment || upcoming || !integration.secretConfigured}
                  />{" "}
                  Habilitada
                </label>
                <button className="btn" disabled={payment || upcoming || !integration.secretConfigured}>
                  Guardar
                </button>
              </div>
              {(payment || upcoming) && (
                <p className="-mt-1 text-xs text-amber-300">
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
