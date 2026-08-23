"use client";

import { useState } from "react";
import Swal from "sweetalert2";
import { scopedFetch } from "@/lib/client-routing";
import { Icon } from "@/components/admin/ui/icons";
import { NumberFlow } from "@/components/admin/ui/number-flow";

type DriverProfile = {
  id: number;
  name: string;
  status: string;
  active: boolean;
  locationSharingEnabled: boolean;
  vehicleType?: string | null;
  plate?: string | null;
  branches?: Array<{ branch?: { id: number; name: string; slug: string } }>;
};

/** @summary Panel de disponibilidad del repartidor con segmented control elegante y contexto de trabajo. */
export function DriverProfileCard({
  driver,
  activeDeliveries,
}: {
  driver: DriverProfile;
  activeDeliveries: number;
}) {
  const [status, setStatus] = useState(driver.status);
  const [saving, setSaving] = useState(false);

  async function toggleAvailability(nextStatus: string) {
    setSaving(true);
    try {
      const response = await scopedFetch("/api/driver/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const body = (await response.json().catch(() => ({}))) as { driver?: DriverProfile; error?: string };
      if (!response.ok || !body.driver) {
        await Swal.fire({ title: "No se pudo cambiar el estado", text: body.error ?? "Intentá de nuevo.", icon: "error", background: "#18181b", color: "#fafafa" });
        return;
      }
      setStatus(body.driver.status);
      window.dispatchEvent(new CustomEvent("driver-availability-changed", { detail: { available: body.driver.active && body.driver.status === "AVAILABLE" } }));
    } finally {
      setSaving(false);
    }
  }

  const available = driver.active && status === "AVAILABLE";
  const busy = status === "IN_DELIVERY";
  const branchName = driver.branches?.[0]?.branch?.name ?? "Sin sucursal";
  const vehicle = driver.vehicleType ? `${driver.vehicleType}${driver.plate ? ` · ${driver.plate}` : ""}` : "Sin vehículo";

  return (
    <section className={`overflow-hidden rounded-3xl border shadow-xl transition-all duration-500 min-w-0 ${available ? "border-emerald-400/20 bg-gradient-to-br from-emerald-500/10 via-zinc-900 to-zinc-950" : busy ? "border-sky-400/20 bg-gradient-to-br from-sky-500/10 via-zinc-900 to-zinc-950" : "border-amber-400/20 bg-gradient-to-br from-amber-500/10 via-zinc-900 to-zinc-950"}`}>
      {/* Header con estado */}
      <div className="flex items-start justify-between gap-3 p-5 pb-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-zinc-500">Estado laboral</p>
          <div className="mt-1.5 flex items-center gap-2.5">
            <span className={`relative flex h-3 w-3`}>
              {available && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
              <span className={`relative inline-flex h-3 w-3 rounded-full ${available ? "bg-emerald-400" : busy ? "bg-sky-400" : "bg-amber-400"}`} />
            </span>
            <h2 className="text-lg font-black text-white">{available ? "Recibiendo entregas" : busy ? "En entrega" : "Pausado"}</h2>
          </div>
        </div>
        <span className={`rounded-full px-3 py-1.5 text-[10px] font-black ${available ? "bg-emerald-500/15 text-emerald-300" : busy ? "bg-sky-500/15 text-sky-300" : "bg-amber-500/15 text-amber-300"}`}>
          {available ? "Activo" : busy ? "Ocupado" : "Inactivo"}
        </span>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 gap-2 px-5 pb-4">
        <div className="rounded-xl border border-white/5 bg-black/20 px-3 py-2.5">
          <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-600">Vehículo</p>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs font-bold text-zinc-200">
            <Icon name="truck" className="h-3 w-3 text-zinc-500" />
            {vehicle}
          </p>
        </div>
        <div className="rounded-xl border border-white/5 bg-black/20 px-3 py-2.5">
          <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-600">Sucursal</p>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs font-bold text-zinc-200">
            <Icon name="map-pin" className="h-3 w-3 text-zinc-500" />
            {branchName}
          </p>
        </div>
      </div>

      {/* Entregas activas */}
      <div className="mx-5 mb-4 flex items-center justify-between rounded-xl border border-white/5 bg-black/20 px-4 py-3">
        <span className="text-xs font-bold text-zinc-400">Entregas activas</span>
        <span className="text-xl font-black text-white"><NumberFlow value={activeDeliveries} /></span>
      </div>

      {/* Toggle de disponibilidad */}
      <div className="border-t border-white/5 px-5 py-4">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className={`min-h-12 rounded-xl text-sm font-black transition-all duration-200 active:scale-[.98] ${available ? "bg-emerald-500 text-white shadow-lg shadow-emerald-950/30" : "border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"}`}
            disabled={saving || !driver.active}
            onClick={() => void toggleAvailability("AVAILABLE")}
          >
            <span className="flex items-center justify-center gap-1.5">
              {saving && !available ? <Icon name="loader" className="h-4 w-4 animate-spin" /> : <Icon name="check-circle" className="h-4 w-4" />}
              Disponible
            </span>
          </button>
          <button
            type="button"
            className={`min-h-12 rounded-xl text-sm font-black transition-all duration-200 active:scale-[.98] ${!available ? "bg-amber-500 text-white shadow-lg shadow-amber-950/30" : "border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"}`}
            disabled={saving || !driver.active}
            onClick={() => void toggleAvailability("UNAVAILABLE")}
          >
            <span className="flex items-center justify-center gap-1.5">
              {saving && available ? <Icon name="loader" className="h-4 w-4 animate-spin" /> : <Icon name="x" className="h-4 w-4" />}
              Pausar
            </span>
          </button>
        </div>
        {!driver.active && <p className="mt-2 text-center text-[11px] font-medium text-red-300">Tu perfil está desactivado. Contactá a un administrador.</p>}
      </div>
    </section>
  );
}
