"use client";

import { useState } from "react";
import Link from "next/link";
import Swal from "sweetalert2";

type ValidationResult = {
  ok?: boolean;
  validRows?: number;
  imported?: number;
  errors?: Array<{ row: number; message: string }>;
  error?: string;
};

/** @summary Ofrece exportaciones y una importación de productos con vista previa obligatoria. */
export function DataPortability() {
  const [csv, setCsv] = useState("");
  const [filename, setFilename] = useState("");
  const [validation, setValidation] = useState<ValidationResult | null>(null);

  /** @summary Lee un CSV local de tamaño acotado sin enviarlo hasta solicitar validación. */
  async function choose(file: File | undefined) {
    if (!file) return;
    if (file.size > 2_000_000) {
      await Swal.fire({
        title: "Archivo demasiado grande",
        text: "El máximo para esta importación es 2 MB.",
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
      return;
    }
    setCsv(await file.text());
    setFilename(file.name);
    setValidation(null);
  }

  /** @summary Solicita validación o aplicación definitiva del archivo seleccionado. */
  async function processFile(apply: boolean) {
    const response = await fetch("/api/admin/data/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv, apply }),
    });
    const result = (await response.json().catch(() => ({}))) as ValidationResult;
    setValidation(result);
    if (apply && response.ok) {
      await Swal.fire({
        title: "Importación completada",
        text: `${result.imported ?? 0} filas procesadas.`,
        icon: "success",
        background: "#18181b",
        color: "#fafafa",
      });
      setCsv("");
      setFilename("");
    }
  }

  return (
    <section>
      <header className="mb-6 rounded-3xl border border-white/10 bg-zinc-950/80 p-5 sm:p-7">
        <p className="section-eyebrow">Portabilidad</p>
        <h1 className="mt-2 text-3xl font-black sm:text-5xl">Importar y exportar</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Tus datos pueden salir en formatos abiertos. La importación siempre se valida antes de escribir.
        </p>
      </header>
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card p-5 sm:p-7">
          <h2 className="text-2xl font-black">Exportaciones CSV</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              ["products", "Productos"],
              ["orders", "Pedidos"],
              ["reservations", "Reservas"],
              ["customers", "Clientes frecuentes"],
            ].map(([type, label]) => (
              <a className="btn btn-secondary" href={`/api/admin/data/export?type=${type}`} key={type}>
                {label}
              </a>
            ))}
          </div>
          <p className="mt-4 text-xs text-zinc-500">
            Incluyen UTF-8 y neutralización de fórmulas para Excel o Google Sheets.
          </p>
        </section>
        <section className="card p-5 sm:p-7">
          <h2 className="text-2xl font-black">Importar productos</h2>
          <Link className="mt-3 inline-block text-sm font-bold text-pink-300" href="/api/admin/data/template">
            Descargar plantilla
          </Link>
          <label className="mt-5 grid min-h-32 cursor-pointer place-items-center rounded-2xl border border-dashed border-white/15 p-5 text-center">
            <span>{filename || "Elegir archivo CSV de hasta 2 MB"}</span>
            <input
              className="sr-only"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => choose(event.target.files?.[0])}
            />
          </label>
          {csv && (
            <button className="btn btn-secondary mt-4 w-full" onClick={() => processFile(false)}>
              Validar archivo
            </button>
          )}
          {validation && (
            <div
              className={`mt-4 rounded-2xl p-4 ${
                validation.errors?.length
                  ? "bg-red-500/10 text-red-200"
                  : "bg-emerald-500/10 text-emerald-200"
              }`}
            >
              <strong>
                {validation.errors?.length
                  ? `${validation.errors.length} errores`
                  : `${validation.validRows ?? 0} filas válidas`}
              </strong>
              {validation.error && <p className="mt-1 text-sm">{validation.error}</p>}
              {validation.errors?.slice(0, 10).map((error) => (
                <p className="mt-1 text-sm" key={`${error.row}-${error.message}`}>
                  Fila {error.row}: {error.message}
                </p>
              ))}
              {validation.ok && csv && (
                <button className="btn mt-4 w-full" onClick={() => processFile(true)}>
                  Confirmar importación
                </button>
              )}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
