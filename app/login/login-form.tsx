"use client";
import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

type BranchOption = { id: number; name: string; slug: string; isPrimary: boolean };

/** @summary Gestiona el formulario de acceso y redirige al panel correcto con credenciales válidas. */
export function LoginForm({ redirectTo = "/admin", initialTenantId, initialTenantSlug }: { redirectTo?: string; initialTenantId?: string; initialTenantSlug?: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [tenantOptions, setTenantOptions] = useState<Array<{ id: number; name: string; slug: string }>>([]);
  const [selectedTenantId, setSelectedTenantId] = useState(initialTenantId ?? "");
  const [branchOptions, setBranchOptions] = useState<BranchOption[]>([]);
  const [consolidatedAvailable, setConsolidatedAvailable] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [pending, setPending] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function doLogin(extra?: Record<string, unknown>) {
    setPending(true);
    setError("");
    const body = {
      email,
      password,
      ...(selectedTenantId ? { tenantId: Number(selectedTenantId) } : initialTenantSlug ? { tenantSlug: initialTenantSlug } : {}),
      ...(selectedBranchId ? { branchId: Number(selectedBranchId) } : {}),
      ...extra,
    };
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setPending(false);
    if (!response.ok) {
      const data = (await response.json()) as {
        error?: string;
        requiresTenantSelection?: boolean;
        tenants?: Array<{ id: number; name: string; slug: string }>;
        requiresBranchSelection?: boolean;
        consolidatedAvailable?: boolean;
        branches?: BranchOption[];
      };
      if (data.requiresTenantSelection && data.tenants?.length) {
        setTenantOptions(data.tenants);
        setSelectedTenantId(String(data.tenants[0].id));
        setError("");
        return;
      }
      if (data.requiresBranchSelection && data.branches?.length) {
        setBranchOptions(data.branches);
        setConsolidatedAvailable(data.consolidatedAvailable === true);
        setSelectedBranchId("");
        setError("");
        return;
      }
      setError(data.error ?? "No se pudo ingresar");
      return;
    }
    router.push(redirectTo as Route);
    router.refresh();
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await doLogin();
  }

  function selectBranch(branchId: number) {
    void doLogin({ branchId });
  }

  function selectConsolidated() {
    void doLogin({ branchId: 0 });
  }

  if (branchOptions.length > 0) {
    return (
      <div className="mt-8 space-y-3">
        <p className="text-sm text-neutral-400">Elegí a qué sucursal querés entrar:</p>
        {consolidatedAvailable && (
          <button
            type="button"
            onClick={selectConsolidated}
            className="btn w-full border border-neutral-700 bg-neutral-800 hover:bg-neutral-700"
          >
            Ver todas las sucursales
          </button>
        )}
        {branchOptions.map((branch) => (
          <button
            key={branch.id}
            type="button"
            onClick={() => selectBranch(branch.id)}
            className="btn w-full"
            disabled={pending}
          >
            {branch.name}
            {branch.isPrimary ? " · Principal" : ""}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setBranchOptions([])}
          className="text-sm text-neutral-400 hover:underline"
        >
          ← Volver
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-4">
      <label className="block text-sm">
        Email
        <input
          className="input mt-2"
          name="email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <label className="block text-sm">
        Contraseña
        <input
          className="input mt-2"
          name="password"
          type="password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
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
