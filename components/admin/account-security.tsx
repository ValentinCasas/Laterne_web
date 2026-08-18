"use client";

import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { PageHeader, StatusBadge, FormSection } from "@/components/admin/ui";
import { scopedFetch } from "@/lib/client-routing";

type SessionData = {
  id: number;
  createdAt: string;
  expiresAt: string;
  membership: { tenant: { name: string } };
};

/** @summary Permite cambiar la contraseña y revisar o cerrar sesiones activas. */
export function AccountSecurity() {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [currentId, setCurrentId] = useState<number | null>(null);
  useEffect(() => {
    scopedFetch("/api/auth/sessions")
      .then((response) => response.json())
      .then((result: { sessions?: SessionData[]; currentId?: number }) => {
        setSessions(result.sessions ?? []);
        setCurrentId(result.currentId ?? null);
      });
  }, []);

  /** @summary Valida y solicita el cambio de contraseña del usuario actual. */
  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    if (form.get("newPassword") !== form.get("confirmation")) {
      await Swal.fire({
        title: "Las contraseñas no coinciden",
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
      return;
    }
    const response = await scopedFetch("/api/auth/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: form.get("currentPassword"),
        newPassword: form.get("newPassword"),
      }),
    });
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    await Swal.fire({
      title: response.ok ? "Contraseña actualizada" : "No se pudo actualizar",
      text: result.error,
      icon: response.ok ? "success" : "error",
      background: "#18181b",
      color: "#fafafa",
    });
    if (response.ok) formElement.reset();
  }

  /** @summary Cierra una sesión remota y la retira de la lista visible. */
  async function revoke(id: number) {
    const response = await scopedFetch("/api/auth/sessions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (response.ok) setSessions((current) => current.filter((session) => session.id !== id));
  }

  return (
    <section>
      <PageHeader
        eyebrow="Cuenta"
        title="Seguridad personal"
        description="Contraseña robusta y control de sesiones abiertas."
        section="cuenta"
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <form className="max-w-4xl" onSubmit={changePassword}>
          <FormSection title="Cambiar contraseña" description="Actualizá tu credencial de acceso. Se cerrarán las demás sesiones abiertas.">
            <div className="space-y-4">
              <label>
                <span className="label">Contraseña actual</span>
                <input className="input" name="currentPassword" type="password" required />
                <p className="mt-1 text-xs text-zinc-500">Ingresá tu contraseña actual para confirmar el cambio.</p>
              </label>
              <label>
                <span className="label">Nueva contraseña</span>
                <input className="input" name="newPassword" type="password" minLength={10} required />
                <p className="mt-1 text-xs text-zinc-500">Mínimo 10 caracteres, mayúscula, minúscula y número.</p>
              </label>
              <label>
                <span className="label">Repetir contraseña</span>
                <input className="input" name="confirmation" type="password" minLength={10} required />
                <p className="mt-1 text-xs text-zinc-500">Repetí la nueva contraseña para verificar.</p>
              </label>
            </div>
            <button className="btn mt-5 w-full">Actualizar contraseña</button>
          </FormSection>
        </form>
        <section className="max-w-4xl">
          <FormSection title="Sesiones activas" description="Dispositivos conectados a tu cuenta.">
            <div className="space-y-3">
              {sessions.map((session) => (
                <article
                  className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 p-4"
                  key={session.id}
                >
                  <div>
                    <StatusBadge status={session.id === currentId ? "Esta sesión" : session.membership.tenant.name} tone={session.id === currentId ? "success" : "default"} />
                    <p className="text-xs text-zinc-500">
                    Iniciada {new Date(session.createdAt).toLocaleString("es-AR")} · vence{" "}
                    {new Date(session.expiresAt).toLocaleString("es-AR")}
                  </p>
                  </div>
                  {session.id !== currentId && (
                    <button className="text-sm font-bold text-red-300" onClick={() => revoke(session.id)}>
                      Cerrar
                    </button>
                  )}
                </article>
              ))}
            </div>
          </FormSection>
        </section>
      </div>
    </section>
  );
}
