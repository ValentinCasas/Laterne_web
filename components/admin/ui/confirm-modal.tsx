"use client";

import Swal from "sweetalert2";

/** @summary Modal de confirmación consistente para acciones destructivas. */
export async function confirmModal({
  title = "¿Estás seguro?",
  text = "Esta acción no se puede deshacer.",
  confirmText = "Sí, confirmar",
  cancelText = "Cancelar",
  confirmButtonColor = "#ec4899",
}: {
  title?: string;
  text?: string;
  confirmText?: string;
  cancelText?: string;
  confirmButtonColor?: string;
} = {}): Promise<boolean> {
  const result = await Swal.fire({
    title,
    text,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    confirmButtonColor,
    cancelButtonColor: "#27272a",
    buttonsStyling: true,
    customClass: {
      popup: "rounded-2xl border border-white/10 bg-zinc-900 text-zinc-100",
      title: "text-lg font-black text-white",
      htmlContainer: "text-sm text-[var(--admin-muted)]",
      confirmButton: "rounded-lg px-4 py-2 text-sm font-bold",
      cancelButton: "rounded-lg border border-white/10 px-4 py-2 text-sm font-bold text-zinc-300 hover:bg-white/5",
    },
  });
  return result.isConfirmed;
}
