"use client";

import { useEffect, useState } from "react";

/** @summary Refleja en el header los cambios de disponibilidad sin refrescar el layout. */
export function DriverAvailabilityPill({ initialAvailable }: { initialAvailable: boolean }) {
  const [available, setAvailable] = useState(initialAvailable);
  useEffect(() => {
    const update = (event: Event) => setAvailable(Boolean((event as CustomEvent<{ available: boolean }>).detail?.available));
    window.addEventListener("driver-availability-changed", update);
    return () => window.removeEventListener("driver-availability-changed", update);
  }, []);
  return <span className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-black transition-all duration-300 ${available ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>{available ? "Disponible" : "Pausado"}</span>;
}
