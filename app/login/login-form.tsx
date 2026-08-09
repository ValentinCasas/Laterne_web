"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/** @summary Gestiona el formulario de acceso y redirige al panel con credenciales válidas. */
export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  /** @summary Envía las credenciales al servidor y muestra cualquier error de autenticación. */
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(Object.fromEntries(data)),
    });
    setPending(false);
    if (!response.ok) {
      const body = await response.json();
      setError(body.error ?? "No se pudo ingresar");
      return;
    }
    router.push("/admin");
    router.refresh();
  }
  return (
    <form onSubmit={submit} className="mt-8 space-y-4">
      <label className="block text-sm">
        Email
        <input className="input mt-2" name="email" type="email" required />
      </label>
      <label className="block text-sm">
        Contraseña
        <input className="input mt-2" name="password" type="password" required />
      </label>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button className="btn w-full" disabled={pending}>
        {pending ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}
