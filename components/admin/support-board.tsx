"use client";

import { useState } from "react";
import Swal from "sweetalert2";

export type SupportTicketData = {
  id: number;
  reference: string;
  status: string;
  category: string;
  customerName: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  adminNotes: string | null;
  createdAt: string;
};
const statuses = [
  ["open", "Abiertas"],
  ["in_progress", "En curso"],
  ["resolved", "Resueltas"],
  ["closed", "Cerradas"],
] as const;

/** @summary Escapa contenido recibido antes de insertarlo dentro de un diálogo HTML. */
function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character,
  );
}

/** @summary Organiza consultas de soporte y conserva notas internas de seguimiento. */
export function SupportBoard({ initialTickets }: { initialTickets: SupportTicketData[] }) {
  const [tickets, setTickets] = useState(initialTickets);

  /** @summary Abre el detalle de una consulta y permite actualizar estado y notas internas. */
  async function edit(ticket: SupportTicketData) {
    const result = await Swal.fire({
      title: ticket.reference,
      html: `<div style="text-align:left"><strong>${escapeHtml(ticket.subject)}</strong><p style="margin:.5rem 0;color:#a1a1aa">${escapeHtml(ticket.customerName)} · ${escapeHtml(ticket.email)}</p><p style="white-space:pre-wrap">${escapeHtml(ticket.message)}</p><label style="display:block;margin-top:1rem">Estado<select id="ticket-status" class="swal2-select" style="display:block;width:100%;margin:.5rem 0">${statuses.map(([value, label]) => `<option value="${value}" ${ticket.status === value ? "selected" : ""}>${label}</option>`).join("")}</select></label><textarea id="ticket-notes" class="swal2-textarea" placeholder="Notas internas">${escapeHtml(ticket.adminNotes ?? "")}</textarea></div>`,
      showCancelButton: true,
      confirmButtonText: "Guardar",
      cancelButtonText: "Cancelar",
      width: 700,
      background: "#18181b",
      color: "#fafafa",
      preConfirm: () => ({
        status: (document.querySelector("#ticket-status") as HTMLSelectElement).value,
        adminNotes: (document.querySelector("#ticket-notes") as HTMLTextAreaElement).value,
      }),
    });
    if (!result.isConfirmed || !result.value) return;
    const response = await fetch(`/api/admin/support/${ticket.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result.value),
    });
    const body = (await response.json().catch(() => ({}))) as { ticket?: SupportTicketData; error?: string };
    if (!response.ok || !body.ticket) {
      await Swal.fire({
        title: "No se pudo actualizar",
        text: body.error ?? "Intentá nuevamente.",
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
      return;
    }
    setTickets((current) => current.map((item) => (item.id === ticket.id ? body.ticket! : item)));
  }

  return (
    <section>
      <header className="mb-6 rounded-3xl border border-white/10 bg-zinc-950/80 p-5 sm:p-7">
        <p className="section-eyebrow">Atención registrada</p>
        <h1 className="mt-2 text-3xl font-black sm:text-5xl">Soporte</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Consultas enviadas desde el centro de ayuda con estado y notas internas.
        </p>
      </header>
      <div className="flex gap-4 overflow-x-auto pb-5">
        {statuses.map(([status, label]) => {
          const items = tickets.filter((ticket) => ticket.status === status);
          return (
            <section
              className="w-[min(86vw,320px)] shrink-0 rounded-3xl border border-white/10 bg-white/5 p-3"
              key={status}
            >
              <header className="flex justify-between p-2">
                <h2 className="font-black">{label}</h2>
                <span>{items.length}</span>
              </header>
              <div className="max-h-[65vh] space-y-3 overflow-y-auto">
                {items.map((ticket) => (
                  <button
                    className="block w-full rounded-2xl border border-white/10 bg-zinc-950 p-4 text-left"
                    onClick={() => edit(ticket)}
                    key={ticket.id}
                  >
                    <span className="text-xs font-black text-pink-300">
                      {ticket.reference} · {ticket.category}
                    </span>
                    <strong className="mt-1 block">{ticket.subject}</strong>
                    <p className="mt-1 text-xs text-zinc-500">
                      {ticket.customerName} · {new Date(ticket.createdAt).toLocaleString("es-AR")}
                    </p>
                  </button>
                ))}
                {!items.length && <p className="p-6 text-center text-xs text-zinc-600">Sin consultas</p>}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}
