"use client";

/** @summary Abre el diálogo nativo para imprimir o guardar el comprobante como PDF. */
export function PrintButton() {
  return (
    <button className="btn print:hidden" onClick={() => window.print()}>
      Imprimir o guardar PDF
    </button>
  );
}
