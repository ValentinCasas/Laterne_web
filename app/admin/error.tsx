"use client";

import { useEffect } from "react";
import { EmptyState } from "@/components/admin/ui/empty-state";

/** @summary Presenta un estado recuperable cuando falla la carga de una vista administrativa. */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[AdminErrorBoundary] Falló una vista administrativa", error);
    void fetch("/api/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "admin-boundary",
        message: error.message || "Error administrativo",
        path: window.location.pathname,
        digest: error.digest,
      }),
    });
  }, [error]);

  return (
    <EmptyState
      title="No pudimos cargar esta sección"
      description="La aplicación sigue disponible. Reintentá la carga y, si el problema continúa, revisá el registro del servidor."
      action={
        <button
          type="button"
          onClick={reset}
          className="rounded-xl bg-[var(--admin-primary-strong)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Reintentar
        </button>
      }
    />
  );
}
