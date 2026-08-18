"use client";

import { scopedFetch } from "@/lib/client-routing";
import Swal from "sweetalert2";

/** @summary Ejecuta una petición de API y devuelve el cuerpo parseado o lanza el error del servidor. */
export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await scopedFetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body?.error ?? "No se pudo completar la operación");
  return body;
}

/** @summary Muestra un error de operación en el panel sin romper la pantalla. */
export async function showError(title: string, reason: unknown): Promise<void> {
  await Swal.fire({
    title,
    text: reason instanceof Error ? reason.message : "Intentá nuevamente.",
    icon: "error",
    background: "#18181b",
    color: "#fafafa",
  });
}
