"use client";

import { useEffect, useState } from "react";
import { scopedFetch } from "@/lib/client-routing";

/** @summary Consume una transferencia legacy usando el tenant explícito de la URL visible. */
export function HandoffClient({ token }: { token: string }) {
  const [error, setError] = useState("");
  useEffect(() => {
    scopedFetch("/api/auth/handoff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (response) => {
        const body = (await response.json().catch(() => ({}))) as { redirect?: string; error?: string };
        if (!response.ok || !body.redirect) throw new Error(body.error ?? "No se pudo abrir el administrador");
        window.location.replace(body.redirect);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "No se pudo abrir el administrador"));
  }, [token]);

  return (
    <main className="shell grid min-h-[70vh] place-items-center py-12">
      <section className="card max-w-lg p-8 text-center">
        <h1 className="text-2xl font-black">Abriendo administración…</h1>
        <p className="mt-3 text-zinc-400">{error || "Validando el acceso seguro."}</p>
      </section>
    </main>
  );
}
