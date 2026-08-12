"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { scopedFetch } from "@/lib/client-routing";
import { parseCanonicalPath, tenantPublicPath } from "@/lib/routes";

/** @summary Gestiona la solicitud y el uso de enlaces privados para recuperar una cuenta administrativa. */
export function PasswordRecovery({ reset = false }: { reset?: boolean }) {
  const pathname = usePathname();
  const route = parseCanonicalPath(pathname);
  const loginHref = route.surface === "platform-admin"
    ? "/platform/login"
    : route.tenantSlug
      ? tenantPublicPath(route.tenantSlug, "/login")
      : "/login";
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  /** @summary Envía la solicitud o la nueva contraseña según el paso de recuperación activo. */
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await scopedFetch("/api/auth/password-reset", {
      method: reset ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        reset
          ? { token, password: form.get("password") }
          : { email: form.get("email"), website: form.get("website") },
      ),
    });
    const body = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
    setLoading(false);
    if (!response.ok) {
      setError(body.error ?? "No se pudo continuar");
      return;
    }
    setMessage(
      reset ? "Contraseña actualizada. Ya podés iniciar sesión." : (body.message ?? "Revisá tu correo."),
    );
    event.currentTarget.reset();
  }

  return (
    <form className="card mx-auto max-w-lg p-7 sm:p-10" onSubmit={submit}>
      <p className="section-eyebrow">Seguridad</p>
      <h1 className="mt-3 text-4xl font-black">
        {reset ? "Creá una nueva contraseña" : "Recuperá tu acceso"}
      </h1>
      <p className="mt-3 text-zinc-400">
        {reset
          ? "El enlace funciona una sola vez y cierra las sesiones anteriores."
          : "Te enviaremos un enlace si el correo pertenece a una cuenta activa."}
      </p>
      {reset ? (
        <label className="mt-6 block">
          <span className="label">Nueva contraseña</span>
          <input
            className="input"
            name="password"
            type="password"
            minLength={10}
            required
            autoComplete="new-password"
          />
        </label>
      ) : (
        <>
          <label className="mt-6 block">
            <span className="label">Correo</span>
            <input className="input" name="email" type="email" required autoComplete="email" />
          </label>
          <input className="hidden" name="website" tabIndex={-1} autoComplete="off" />
        </>
      )}
      {error && (
        <p className="mt-4 text-red-300" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="mt-4 text-emerald-300" role="status">
          {message}
        </p>
      )}
      <button className="btn mt-6 w-full" disabled={loading || (reset && !token)}>
        {loading ? "Procesando…" : reset ? "Guardar contraseña" : "Enviar instrucciones"}
      </button>
      <Link className="mt-5 block text-center text-sm text-pink-300" href={loginHref}>
        Volver al acceso
      </Link>
    </form>
  );
}
