"use client";

import { useEffect, useState } from "react";

/** @summary Indicador visual de disponibilidad en el header con transición suave. */
export function DriverAvailabilityPill({ initialAvailable }: { initialAvailable: boolean }) {
  const [available, setAvailable] = useState(initialAvailable);
  useEffect(() => {
    const update = (event: Event) => setAvailable(Boolean((event as CustomEvent<{ available: boolean }>).detail?.available));
    window.addEventListener("driver-availability-changed", update);
    return () => window.removeEventListener("driver-availability-changed", update);
  }, []);
  return (
    <span className={`relative shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-black transition-all duration-300 ${available ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${available ? "bg-emerald-400" : "bg-amber-400"}`} />
      {available ? "Activo" : "Pausado"}
    </span>
  );
}
