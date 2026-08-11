"use client";
import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

/** @summary Gestiona el formulario de acceso y redirige al panel correcto con credenciales válidas. */
export function LoginForm({ redirectTo = "/admin" }: { redirectTo?: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [tenantOptions, setTenantOptions] = useState<Array<{ id: number; name: string; slug: string }>>([]);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [pending, setPending] = useState(false);
  /** @summary Envía las credenciales al servidor y muestra cualquier error de autenticación. */
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const data = new FormData(event.currentTarget);
    if (selectedTenantId) data.set("tenantId", selectedTenantId);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(Object.fromEntries(data)),
    });
    setPending(false);
    if (!response.ok) {
      const body = (await response.json()) as {
        error?: string;
        requiresTenantSelection?: boolean;
        tenants?: Array<{ id: number; name: string; slug: string }>;
      };
      if (body.requiresTenantSelection && body.tenants?.length) {
        setTenantOptions(body.tenants);
        setSelectedTenantId(String(body.tenants[0].id));
        setError("");
        return;
      }
      setError(body.error ?? "No se pudo ingresar");
      return;
    }
    router.push(redirectTo as Route);
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
      {tenantOptions.length > 0 && (
        <label className="block text-sm">
          Negocio
          <select
            className="input mt-2"
            value={selectedTenantId}
            onChange={(event) => setSelectedTenantId(event.target.value)}
            required
          >
            {tenantOptions.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name} · {tenant.slug}
              </option>
            ))}
          </select>
        </label>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button className="btn w-full" disabled={pending}>
        {pending ? "Ingresando…" : "Ingresar"}
      </button>
      <Link className="block text-center text-sm text-pink-300 hover:underline" href="/recuperar-acceso">
        ¿Olvidaste tu contraseña?
      </Link>
    </form>
  );
}
