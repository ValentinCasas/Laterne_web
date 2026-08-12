"use client";

import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
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
    const form = new FormData(event.currentTarget);
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
    if (response.ok) event.currentTarget.reset();
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
      <AdminPageHeader
        eyebrow="Cuenta"
        title="Seguridad personal"
        description="Contraseña robusta y control de sesiones abiertas."
        section="cuenta"
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <form className="card p-5 sm:p-7" onSubmit={changePassword}>
          <h2 className="text-2xl font-black">Cambiar contraseña</h2>
          <div className="mt-5 space-y-4">
            <label>
              <span className="label">Contraseña actual</span>
              <input className="input" name="currentPassword" type="password" required />
            </label>
            <label>
              <span className="label">Nueva contraseña</span>
              <input className="input" name="newPassword" type="password" minLength={10} required />
            </label>
            <label>
              <span className="label">Repetir contraseña</span>
              <input className="input" name="confirmation" type="password" minLength={10} required />
            </label>
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            Mínimo 10 caracteres, mayúscula, minúscula y número. Se cerrarán las demás sesiones.
          </p>
          <button className="btn mt-5 w-full">Actualizar contraseña</button>
        </form>
        <section className="card p-5 sm:p-7">
          <h2 className="text-2xl font-black">Sesiones activas</h2>
          <div className="mt-5 space-y-3">
            {sessions.map((session) => (
              <article
                className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 p-4"
                key={session.id}
              >
                <div>
                  <strong>{session.id === currentId ? "Esta sesión" : session.membership.tenant.name}</strong>
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
        </section>
      </div>
    </section>
  );
}
