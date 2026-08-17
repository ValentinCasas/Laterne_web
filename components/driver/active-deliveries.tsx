"use client";

import { useState } from "react";
import Swal from "sweetalert2";
import { scopedFetch } from "@/lib/client-routing";
import { deliveryStatusMeta, nextDriverStatus } from "@/lib/delivery-drivers";

type Delivery = {
  id: number;
  number: string;
  status: string;
  customerName: string;
  deliveryAddress?: string | null;
  contactPhone?: string | null;
  createdAt: string | Date;
  order?: {
    id: number;
    reference: string;
    status: string;
    customerName: string;
    phone?: string | null;
    deliveryAddress?: string | null;
    notes?: string | null;
  } | null;
  branch?: { id: number; name: string; address?: string | null; phone?: string | null } | null;
  items?: Array<{ id: number; productName: string; quantityDelivered: number; unitPrice: string | number | object }>;
  incidents?: Array<{ id: number; type: string; description: string; resolved: boolean; reportedAt: string | Date }>;
  statusLogs?: Array<{ status: string; previousStatus: string | null; changedAt: string | Date }>;
};

const SWAL_THEME = { background: "#18181b", color: "#fafafa" };

/** @summary Entregas activas del repartidor con botones grandes de acción y reporte de incidencias. */
export function DriverActiveDeliveries({ deliveries }: { deliveries: Delivery[] }) {
  const [workingId, setWorkingId] = useState<number | null>(null);

  async function advance(delivery: Delivery) {
    const next = nextDriverStatus(delivery.status);
    if (!next) return;
    const confirmed = await Swal.fire({
      title: "Avanzar entrega",
      text: `¿Marcar como "${deliveryStatusMeta(next).label}"?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, avanzar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#16a34a",
      ...SWAL_THEME,
    });
    if (!confirmed.isConfirmed) return;
    setWorkingId(delivery.id);
    try {
      const response = await scopedFetch(`/api/driver/deliveries/${delivery.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        await Swal.fire({ title: "No se pudo avanzar", text: body.error ?? "Intentá de nuevo.", icon: "error", ...SWAL_THEME });
        return;
      }
      await Swal.fire({ title: `Entrega ${deliveryStatusMeta(next).label.toLowerCase()}`, icon: "success", timer: 1200, showConfirmButton: false, ...SWAL_THEME });
      window.location.reload();
    } finally {
      setWorkingId(null);
    }
  }

  async function reportIncident(delivery: Delivery) {
    const { value: formValues, isConfirmed } = await Swal.fire<{ type: string; description: string }>({
      title: "Reportar incidencia",
      html: `
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
        const type = (document.getElementById("swal-inc-type") as HTMLSelectElement)?.value ?? "otro";
        const description = (document.getElementById("swal-inc-desc") as HTMLTextAreaElement)?.value?.trim() ?? "";
        if (!description) {
          Swal.showValidationMessage("Describí la incidencia");
          return false;
        }
        return { type, description };
      },
      ...SWAL_THEME,
    });
    if (!isConfirmed || !formValues) return;

    setWorkingId(delivery.id);
    try {
      const response = await scopedFetch("/api/driver/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryId: delivery.id, ...formValues }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        await Swal.fire({ title: "No se pudo reportar", text: body.error ?? "Intentá de nuevo.", icon: "error", ...SWAL_THEME });
        return;
      }
      await Swal.fire({ title: "Incidencia reportada", icon: "success", timer: 1200, showConfirmButton: false, ...SWAL_THEME });
      window.location.reload();
    } finally {
      setWorkingId(null);
    }
  }

  if (deliveries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-zinc-500">
        No tenés entregas activas ahora mismo.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {deliveries.map((delivery) => {
        const meta = deliveryStatusMeta(delivery.status);
        const next = nextDriverStatus(delivery.status);
        return (
          <div key={delivery.id} className="card overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${meta.badge}`}>{meta.label}</span>
                  <span className="text-xs text-zinc-500">{delivery.number}</span>
                  {delivery.branch?.name && <span className="text-xs text-zinc-500">· {delivery.branch.name}</span>}
                </div>
                <p className="mt-1 text-base font-black text-white">{delivery.customerName}</p>
                <p className="text-xs text-zinc-400">{delivery.order?.reference ?? "—"}</p>
                {(delivery.order?.deliveryAddress ?? delivery.deliveryAddress) && (
                  <p className="mt-1 text-sm text-zinc-300">📍 {(delivery.order?.deliveryAddress ?? delivery.deliveryAddress)}</p>
                )}
                {(delivery.order?.phone ?? delivery.contactPhone) && (
                  <p className="text-sm text-zinc-400">📞 {(delivery.order?.phone ?? delivery.contactPhone)}</p>
                )}
              </div>
            </div>

            {delivery.items && delivery.items.length > 0 && (
              <div className="border-t border-white/5 px-4 py-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Items</p>
                <ul className="mt-1 space-y-0.5">
                  {delivery.items.map((item) => (
                    <li key={item.id} className="flex justify-between text-sm">
                      <span className="text-zinc-200">{item.productName}</span>
                      <span className="text-zinc-500">x{item.quantityDelivered}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {delivery.incidents && delivery.incidents.length > 0 && (
              <div className="border-t border-white/5 px-4 py-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-orange-400">Incidencias</p>
                {delivery.incidents.map((incident) => (
                  <p key={incident.id} className="text-xs text-orange-300">
                    {incident.type}: {incident.description}
                  </p>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 border-t border-white/5 p-3">
              {next && (
                <button
                  type="button"
                  className="btn col-span-1 bg-emerald-600 py-4 text-base font-black text-white hover:bg-emerald-500"
                  disabled={workingId === delivery.id}
                  onClick={() => advance(delivery)}
                >
                  ✅ Marcar {deliveryStatusMeta(next).label}
                </button>
              )}
              <button
                type="button"
                className={`btn bg-orange-600/90 py-4 text-base font-black text-white hover:bg-orange-500 ${next ? "" : "col-span-1"}`}
                disabled={workingId === delivery.id}
                onClick={() => reportIncident(delivery)}
              >
                ⚠️ Reportar incidencia
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}