"use client";

import { deliveryStatusMeta } from "@/lib/delivery-drivers";
import { Icon } from "@/components/admin/ui/icons";

type Delivery = {
  id: number;
  number: string;
  status: string;
  createdAt: string | Date;
  assignedAt?: string | Date | null;
  deliveredAt?: string | Date | null;
  customerName: string;
  order?: { id: number; reference: string; customerName: string } | null;
  branch?: { id: number; name: string } | null;
  incidents?: Array<{ id: number; type: string; resolved: boolean; reportedAt: string | Date }>;
  statusLogs?: Array<{ status: string; previousStatus: string | null; changedAt: string | Date }>;
};

function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/** @summary Historial de entregas del repartidor con sus estados y timestamps. */
export function DriverDeliveriesHistory({ deliveries }: { deliveries: Delivery[] }) {
  if (deliveries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-zinc-500">
        Todavía no tenés entregas.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {deliveries.map((delivery) => {
        const meta = deliveryStatusMeta(delivery.status);
        const hasIncident = (delivery.incidents?.length ?? 0) > 0;
        return (
          <div key={delivery.id} className="card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${meta.badge}`}>{meta.label}</span>
                  <span className="text-xs text-zinc-500">{delivery.number}</span>
                  {delivery.branch?.name && <span className="text-xs text-zinc-500">· {delivery.branch.name}</span>}
                </div>
                <p className="mt-1 text-sm font-bold text-white">{delivery.order?.customerName ?? delivery.customerName}</p>
                <p className="text-xs text-zinc-500">{delivery.order?.reference ?? "—"}</p>
              </div>
              {hasIncident && <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-black text-orange-300"><Icon name="warning" className="h-3 w-3" /> Incidencia</span>}
            </div>

            {delivery.statusLogs && delivery.statusLogs.length > 0 && (
              <div className="mt-3 space-y-1 border-t border-white/5 pt-2">
                {delivery.statusLogs.map((log, index) => (
                  <div key={index} className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-300">
                      {deliveryStatusMeta(log.status).label}
                      {log.previousStatus ? ` (desde ${deliveryStatusMeta(log.previousStatus).label.toLowerCase()})` : ""}
                    </span>
                    <span className="tabular-nums text-zinc-500">{formatDateTime(log.changedAt)}</span>
                  </div>
                ))}
              </div>
            )}
            {(!delivery.statusLogs || delivery.statusLogs.length === 0) && (
              <p className="mt-2 text-[11px] text-zinc-500">Creada: {formatDateTime(delivery.createdAt)}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}