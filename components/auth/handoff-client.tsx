"use client";

import { useEffect, useState } from "react";

/** @summary Completa automáticamente el traspaso seguro al host administrativo específico. */
export function HandoffClient({ token }: { token: string }) {
  const [error, setError] = useState("");
  useEffect(() => { fetch("/api/auth/handoff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) }).then(async (response) => { const body = await response.json().catch(() => ({})) as { redirect?: string; error?: string }; if (!response.ok || !body.redirect) throw new Error(body.error ?? "No se pudo abrir el administrador"); window.location.replace(body.redirect); }).catch((reason) => setError(reason instanceof Error ? reason.message : "No se pudo abrir el administrador")); }, [token]);
  return <main className="shell grid min-h-screen place-items-center py-16"><section className="card max-w-md p-8 text-center"><p className="section-eyebrow">Acceso seguro</p><h1 className="mt-3 text-2xl font-black">Abriendo el administrador…</h1>{error && <p className="mt-4 text-sm text-red-400">{error}</p>}</section></main>;
}
