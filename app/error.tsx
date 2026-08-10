"use client";

import { useEffect } from "react";

/** @summary Presenta una recuperación accesible cuando falla una ruta sin perder toda la aplicación. */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void fetch("/api/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "client-boundary",
        message: error.message || "Error de ruta",
        path: window.location.pathname,
        digest: error.digest,
      }),
    });
  }, [error]);
  return (
    <main className="shell grid min-h-[72vh] place-items-center py-12">
      <section className="card max-w-xl p-8 text-center">
        <p className="section-eyebrow">Error inesperado</p>
        <h1 className="mt-3 text-4xl font-black">No pudimos completar esta operación.</h1>
        <p className="mt-4 text-zinc-400">
          Tus datos no fueron descartados. Podés reintentar de forma segura.
        </p>
        <button className="btn mt-6" onClick={reset}>
          Reintentar
        </button>
      </section>
    </main>
  );
}
