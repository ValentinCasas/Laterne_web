"use client";

import { useMemo, useState } from "react";

type ErrorEntry = {
  id: string;
  source: string;
  message: string;
  path: string | null;
  fingerprint: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

/** @summary Permite buscar, distinguir y resolver incidentes técnicos informados por la aplicación. */
export function ErrorLogManager({ initialErrors }: { initialErrors: ErrorEntry[] }) {
  const [errors, setErrors] = useState(initialErrors);
  const [query, setQuery] = useState("");
  const [pendingOnly, setPendingOnly] = useState(true);
  const visible = useMemo(
    () =>
      errors.filter(
        (error) =>
          (!pendingOnly || !error.resolvedAt) &&
          `${error.source} ${error.message} ${error.path ?? ""}`
            .toLocaleLowerCase("es")
            .includes(query.trim().toLocaleLowerCase("es")),
      ),
    [errors, pendingOnly, query],
  );

  /** @summary Confirma en el servidor que un incidente ya fue revisado. */
  async function resolve(id: string) {
    const response = await fetch(`/api/admin/errors/${id}`, { method: "PATCH" });
    const body = (await response.json().catch(() => ({}))) as { error?: ErrorEntry };
    if (response.ok && body.error)
      setErrors((current) => current.map((item) => (item.id === id ? body.error! : item)));
  }

  return (
    <section>
      <header className="admin-hero">
        <div>
          <p className="section-eyebrow">Observabilidad</p>
          <h1 className="mt-2 text-4xl font-black sm:text-5xl">Errores técnicos</h1>
          <p className="mt-3 max-w-2xl text-zinc-500">
            Incidentes reducidos y agrupables, sin trazas privadas ni datos personales enviados desde el
            navegador.
          </p>
        </div>
      </header>
      <div className="card mt-6 grid gap-3 p-4 sm:grid-cols-[1fr_auto]">
        <input
          className="input"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar mensaje, origen o ruta…"
        />
        <label className="flex items-center gap-2 px-3 text-sm">
          <input
            type="checkbox"
            checked={pendingOnly}
            onChange={(event) => setPendingOnly(event.target.checked)}
          />{" "}
          Solo pendientes
        </label>
      </div>
      <div className="mt-5 space-y-3">
        {visible.map((entry) => (
          <article className="card p-5" key={entry.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <strong>{entry.source}</strong>
                <p className="mt-1 break-words text-sm text-zinc-400">{entry.message}</p>
                <p className="mt-2 text-xs text-zinc-600">
                  {entry.path || "Sin ruta"} · {new Date(entry.createdAt).toLocaleString("es-AR")}
                </p>
              </div>
              {entry.resolvedAt ? (
                <span className="text-sm text-emerald-300">Resuelto</span>
              ) : (
                <button className="btn btn-secondary py-2" onClick={() => void resolve(entry.id)}>
                  Marcar resuelto
                </button>
              )}
            </div>
          </article>
        ))}
        {!visible.length && (
          <p className="card p-10 text-center text-zinc-500">No hay incidentes con esos filtros.</p>
        )}
      </div>
    </section>
  );
}
