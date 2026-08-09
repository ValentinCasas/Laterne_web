"use client";

import { useFormStatus } from "react-dom";

/** @summary Renderiza un botón que informa el estado pendiente de un formulario. */
export function SubmitButton({ children = "Guardar" }: { children?: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn disabled:opacity-50" disabled={pending}>
      {pending ? "Procesando…" : children}
    </button>
  );
}
