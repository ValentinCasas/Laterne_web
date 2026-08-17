"use client";

import { useState } from "react";
import Swal from "sweetalert2";
import { scopedFetch } from "@/lib/client-routing";

type Incident = {
  id: number;
  type: string;
  description: string;
  resolved: boolean;
  reportedAt: string | Date;
  delivery?: { id: number; number: string; customerName: string } | null;
};

type ActiveDelivery = { id: number; number: string; customerName: string };

const SWAL_THEME = { background: "#18181b", color: "#fafafa" };

function formatDateTime(value: string | Date) {
  return new Date(value).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/** @summary Incidencias del repartidor: listado y formulario de reporte. */
export function DriverIncidentsPanel({
  incidents,
  activeDeliveries,
}: {
  incidents: Incident[];
  activeDeliveries: ActiveDelivery[];
}) {
  const [saving, setSaving] = useState(false);

  async function reportIncident() {
    if (activeDeliveries.length === 0) {
      await Swal.fire({ title: "Sin entregas activas", text: "Reportá incidencias sobre una entrega en curso.", icon: "info", ...SWAL_THEME });
      return;
    }
    const deliveryOptions = activeDeliveries
      .map((d) => `<option value="${d.id}">${d.number} · ${d.customerName}</option>`)
      .join("");
    const { value: formValues, isConfirmed } = await Swal.fire<{ deliveryId: number; type: string; description: string }>({
      title: "Reportar incidencia",
      html: `
        <label class="block text-left text-xs text-zinc-400 mb-1">Entrega</label>
        <select id="swal-inc-delivery" class="input w-full mb-3">${deliveryOptions}</select>
        <label class="block text-left text-xs text-zinc-400 mb-1">Tipo</label>
        <select id="swal-inc-type" class="input w-full mb-3">
          <option value="cliente ausente">Cliente ausente</option>
          <option value="dirección incorrecta">Dirección incorrecta</option>
          <option value="rechazó el pedido">Rechazó el pedido</option>
          <option value="problema de tránsito">Problema de tránsito</option>
          <option value="problema del vehículo">Problema del vehículo</option>
          <option value="otro">Otro</option>
        </select>
        <label class="block text-left text-xs text-zinc-400 mb-1">Descripción</label>
        <textarea id="swal-inc-desc" class="input w-full" rows="3" placeholder="Contanos qué pasó…"></textarea>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: "Reportar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#f97316",
      preConfirm: () => {
        const deliveryId = Number((document.getElementById("swal-inc-delivery") as HTMLSelectElement)?.value);
        const type = (document.getElementById("swal-inc-type") as HTMLSelectElement)?.value ?? "otro";
        const description = (document.getElementById("swal-inc-desc") as HTMLTextAreaElement)?.value?.trim() ?? "";
        if (!description) {
          Swal.showValidationMessage("Describí la incidencia");
          return false;
        }
        return { deliveryId, type, description };
      },
      ...SWAL_THEME,
    });
    if (!isConfirmed || !formValues) return;

    setSaving(true);
    try {
      const response = await scopedFetch("/api/driver/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formValues),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        await Swal.fire({ title: "No se pudo reportar", text: body.error ?? "Intentá de nuevo.", icon: "error", ...SWAL_THEME });
        return;
      }
      await Swal.fire({ title: "Incidencia reportada", icon: "success", timer: 1200, showConfirmButton: false, ...SWAL_THEME });
      window.location.reload();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black">Incidencias</h1>
        <button type="button" className="btn bg-orange-600 px-4 py-3 text-sm font-black text-white hover:bg-orange-500" disabled={saving} onClick={reportIncident}>
          ⚠️ Reportar incidencia
        </button>
      </div>

      {incidents.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-zinc-500">
          No reportaste incidencias.
        </div>
      )}

      <div className="space-y-2">
        {incidents.map((incident) => (
          <div key={incident.id} className="card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${incident.resolved ? "bg-emerald-500/15 text-emerald-300" : "bg-orange-500/15 text-orange-300"}`}>
                  {incident.resolved ? "Resuelta" : "Abierta"}
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">{incident.type}</span>
              </div>
              <span className="tabular-nums text-[11px] text-zinc-500">{formatDateTime(incident.reportedAt)}</span>
            </div>
            <p className="mt-2 text-sm text-zinc-200">{incident.description}</p>
            {incident.delivery && (
              <p className="mt-1 text-xs text-zinc-500">
                Entrega: {incident.delivery.number} · {incident.delivery.customerName}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}