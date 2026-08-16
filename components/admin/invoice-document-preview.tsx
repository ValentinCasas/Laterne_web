"use client";

import { useMemo } from "react";
import { apiPath } from "@/lib/client-routing";

/**
 * @summary Renderiza una vista previa compacta de un comprobante.
 */
export function InvoiceDocumentPreview({
  invoiceId,
  number,
  pdfStatus,
  conversionMessage,
}: {
  invoiceId: number;
  number: string;
  pdfStatus: string;
  conversionMessage: string | null;
}) {
  const docxUrl = useMemo(
    () => apiPath(`/api/admin/invoices/${invoiceId}/document?format=docx`),
    [invoiceId],
  );
  const pdfUrl = useMemo(() => apiPath(`/api/admin/invoices/${invoiceId}/document?format=pdf`), [invoiceId]);
  const pdfDownloadUrl = useMemo(
    () => apiPath(`/api/admin/invoices/${invoiceId}/document?format=pdf&download=1`),
    [invoiceId],
  );
  const hasPdf = pdfStatus === "ready";

  return (
    <section className="min-w-0">
      <header className="mb-5 flex min-w-0 flex-wrap items-start justify-between gap-4 rounded-2xl border border-white/10 bg-zinc-950 p-4 sm:p-5 print:hidden">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-widest text-pink-300">
            Comprobante interno no fiscal
          </p>
          <h1 className="mt-2 break-words text-2xl font-black sm:text-3xl">{number}</h1>
          <p className="mt-2 text-sm text-zinc-400">
            La vista previa y la impresión usan el PDF convertido desde la misma plantilla Word.
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <a className="btn btn-secondary flex-1 sm:flex-none" href={docxUrl}>
            Descargar DOCX
          </a>
          {hasPdf && (
            <a className="btn btn-secondary flex-1 sm:flex-none" href={pdfDownloadUrl}>
              Descargar PDF
            </a>
          )}
          {hasPdf && (
            <a className="btn flex-1 sm:flex-none" href={pdfUrl} target="_blank" rel="noreferrer">
              Abrir / imprimir
            </a>
          )}
        </div>
      </header>

      {hasPdf ? (
        <div className="document-pdf-frame min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-zinc-800">
          <object
            className="block h-[72dvh] min-h-[32rem] w-full max-w-full bg-white"
            data={pdfUrl}
            type="application/pdf"
            aria-label={`Vista previa de ${number}`}
          >
            <div className="grid min-h-80 place-items-center p-6 text-center text-zinc-900">
              <p>
                Tu navegador no puede mostrar el PDF embebido.{" "}
                <a className="font-bold underline" href={pdfUrl} target="_blank" rel="noreferrer">
                  Abrir PDF
                </a>
              </p>
            </div>
          </object>
        </div>
      ) : (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-6 text-amber-100">
          <h2 className="text-xl font-black text-amber-300">PDF no disponible en este entorno</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed">
            {conversionMessage ||
              "No hay un conversor DOCX a PDF configurado. El documento Word se generó correctamente y se puede descargar."}
          </p>
          <a className="btn mt-5" href={docxUrl}>
            Descargar el DOCX generado
          </a>
        </div>
      )}
    </section>
  );
}
