"use client";

import { useState } from "react";
import Swal from "sweetalert2";
import { scopedFetch } from "@/lib/client-routing";
import { Icon } from "@/components/admin/ui/icons";

type DriverProfile = {
  id: number;
  name: string;
  phone: string;
  status: string;
  active: boolean;
  vehicleType?: string | null;
  plate?: string | null;
  color?: string | null;
  capacity?: number | null;
  branches?: Array<{ branch?: { id: number; name: string; slug: string } }>;
};

/** @summary Tarjeta del perfil del repartidor con conmutador de disponibilidad. */
export function DriverProfileCard({
  driver,
  deliveredToday,
}: {
  driver: DriverProfile;
  deliveredToday: number;
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
    } finally {
      setSaving(false);
    }
  }

  const available = driver.active && status === "AVAILABLE";

  return (
    <div className="card flex flex-wrap items-center justify-between gap-4 p-4">
      <div>
        <p className="text-lg font-black text-white">{driver.name}</p>
        <p className="flex items-center gap-1.5 text-sm text-zinc-400"><Icon name="phone" className="h-3.5 w-3.5 text-zinc-500" /> {driver.phone}</p>
        {driver.vehicleType && <p className="flex items-center gap-1.5 text-sm text-zinc-400"><Icon name="truck" className="h-3.5 w-3.5 text-zinc-500" /> {driver.vehicleType}{driver.plate ? ` · ${driver.plate}` : ""}</p>}
        <p className="mt-2 text-xs text-zinc-500">
          Entregadas hoy: <span className="font-black text-emerald-300">{deliveredToday}</span>
        </p>
      </div>
      <div className="flex flex-col items-center gap-2">
        <span
          className={`rounded-full px-3 py-1 text-xs font-black ${available ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}
        >
          {available ? "Disponible" : "No disponible"}
        </span>
        <button
          type="button"
          className={`btn ${available ? "bg-amber-500 text-zinc-950 hover:bg-amber-400" : "bg-emerald-600 text-white hover:bg-emerald-500"} py-3 text-sm font-black`}
          disabled={saving || !driver.active}
          onClick={() => toggleAvailability(available ? "UNAVAILABLE" : "AVAILABLE")}
        >
          {available ? "Pausar entregas" : "Disponible para entregas"}
        </button>
      </div>
    </div>
  );
}