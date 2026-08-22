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

/** @summary Tarjeta operativa de disponibilidad con transición visual y contexto de trabajo. */
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
  const branchName = driver.branches?.[0]?.branch?.name ?? "Sin sucursal";
  const vehicle = driver.vehicleType ? `${driver.vehicleType}${driver.plate ? ` · ${driver.plate}` : ""}` : "Sin vehículo asignado";

  return (
    <section className={`rounded-3xl border p-5 shadow-xl transition-all duration-300 ${available ? "border-emerald-400/20 bg-gradient-to-br from-emerald-500/10 via-zinc-900 to-zinc-950" : "border-amber-400/20 bg-gradient-to-br from-amber-500/10 via-zinc-900 to-zinc-950"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-zinc-500">Disponibilidad</p>
          <h2 className="mt-1 text-xl font-black text-white">{available ? "Listo para recibir entregas" : "Recepción pausada"}</h2>
        </div>
        <span className={`relative inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black ${available ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>
          <span className={`h-2 w-2 rounded-full ${available ? "animate-pulse bg-emerald-400" : "bg-amber-400"}`} />
          {available ? "Disponible" : "Pausado"}
        </span>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-white/5 bg-black/15 p-3">
          <dt className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Vehículo</dt>
          <dd className="mt-1 flex items-center gap-1.5 truncate text-sm font-bold text-zinc-100"><Icon name="truck" className="h-3.5 w-3.5 text-zinc-500" />{vehicle}</dd>
        </div>
        <div className="rounded-2xl border border-white/5 bg-black/15 p-3">
          <dt className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Sucursal</dt>
          <dd className="mt-1 flex items-center gap-1.5 truncate text-sm font-bold text-zinc-100"><Icon name="map-pin" className="h-3.5 w-3.5 text-zinc-500" />{branchName}</dd>
        </div>
        <div className="col-span-2 flex items-center justify-between rounded-2xl border border-white/5 bg-black/15 px-3 py-3">
          <dt className="text-xs font-bold text-zinc-400">Entregas activas</dt>
          <dd className="text-lg font-black text-white"><NumberFlow value={activeDeliveries} /></dd>
        </div>
      </dl>

      <button
        type="button"
        className={`mt-4 min-h-13 w-full rounded-2xl px-5 py-3.5 text-sm font-black transition-all active:scale-[.99] ${available ? "border border-white/10 bg-white/5 text-white hover:bg-white/10" : "bg-emerald-600 text-white hover:bg-emerald-500"}`}
        disabled={saving || !driver.active}
        onClick={() => void toggleAvailability(available ? "UNAVAILABLE" : "AVAILABLE")}
      >
        {saving ? "Guardando…" : available ? "Pausar entregas" : "Volver a estar disponible"}
      </button>
    </section>
  );
}
