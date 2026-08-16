"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Swal from "sweetalert2";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { scopedFetch } from "@/lib/client-routing";
import { scopedApiPath } from "@/lib/routes";

type ValidationResult = {
  ok?: boolean;
  validRows?: number;
  imported?: number;
  errors?: Array<{ row: number; message: string }>;
  error?: string;
};

/** @summary Ofrece exportaciones y una importación de productos con vista previa obligatoria. */
export function DataPortability() {
  const pathname = usePathname();
  const [csv, setCsv] = useState("");
  const [filename, setFilename] = useState("");
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [backup, setBackup] = useState<Record<string, unknown> | null>(null);
  const [backupName, setBackupName] = useState("");

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
    const response = await scopedFetch("/api/admin/data/import", {
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

  /** @summary Lee y valida superficialmente una copia JSON antes de solicitar la restauración controlada. */
  async function chooseBackup(file: File | undefined) {
    if (!file || file.size > 10_000_000) return;
    try {
      const parsed = JSON.parse(await file.text()) as Record<string, unknown>;
      setBackup(parsed);
      setBackupName(file.name);
    } catch {
      setBackup(null);
      await Swal.fire({
        title: "Copia inválida",
        text: "El archivo no contiene JSON válido.",
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
    }
  }

  /** @summary Solicita la frase exacta y fusiona una copia compatible sin eliminar contenido adicional. */
  async function restoreBackup() {
    if (!backup) return;
    const tenantSlug = String(backup.tenantSlug ?? "");
    const confirmation = await Swal.fire({
      title: "Restauración controlada",
      text: `Escribí RESTAURAR ${tenantSlug}. La operación fusiona registros y no borra contenido adicional.`,
      input: "text",
      showCancelButton: true,
      confirmButtonText: "Restaurar",
      cancelButtonText: "Cancelar",
      background: "#18181b",
      color: "#fafafa",
    });
    if (!confirmation.isConfirmed) return;
    const response = await scopedFetch("/api/admin/data/backup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...backup, confirmation: confirmation.value }),
    });
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    await Swal.fire({
      title: response.ok ? "Copia restaurada" : "No se pudo restaurar",
      text: result.error,
      icon: response.ok ? "success" : "error",
      background: "#18181b",
      color: "#fafafa",
    });
  }

  /** @summary Descarga la copia JSON autenticada y conserva el nombre indicado por el servidor. */
  async function downloadBackup() {
    const response = await scopedFetch("/api/admin/data/backup");
    if (!response.ok) {
      await Swal.fire({
        title: "No se pudo descargar",
        text: "Intentá nuevamente en unos instantes.",
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
      return;
    }
    const disposition = response.headers.get("content-disposition") ?? "";
    const name = disposition.match(/filename="([^"]+)"/)?.[1] ?? "laterne-backup.json";
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section>
      <AdminPageHeader
        eyebrow="Portabilidad"
        title="Importar y exportar"
        description="Tus datos pueden salir en formatos abiertos. La importación siempre se valida antes de escribir."
        section="datos"
      />
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
              <a
                className="btn btn-secondary"
                href={scopedApiPath(pathname, `/api/admin/data/export?type=${type}`)}
                key={type}
              >
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
          <Link
            className="mt-3 inline-block text-sm font-bold text-pink-300"
            href={scopedApiPath(pathname, "/api/admin/data/template")}
          >
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
        <section className="card p-5 sm:p-7 xl:col-span-2">
          <h2 className="text-2xl font-black">Copia de seguridad portable</h2>
          <p className="mt-2 text-sm text-zinc-500">
            Exporta categorías, productos, opciones y sucursales. La restauración exige una frase exacta,
            valida el tenant y fusiona sin borrar registros adicionales.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button className="btn" type="button" onClick={() => void downloadBackup()}>
              Descargar copia JSON
            </button>
            <label className="btn btn-secondary cursor-pointer text-center">
              {backupName || "Elegir copia para restaurar"}
              <input
                className="sr-only"
                type="file"
                accept="application/json,.json"
                onChange={(event) => void chooseBackup(event.target.files?.[0])}
              />
            </label>
          </div>
          {backup && (
            <button
              className="mt-4 text-sm font-bold text-amber-300 underline"
              onClick={() => void restoreBackup()}
            >
              Validar y restaurar esta copia
            </button>
          )}
        </section>
      </div>
    </section>
  );
}
