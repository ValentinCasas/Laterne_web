"use client";

import { useCallback, useEffect, useState } from "react";

export type ViewMode = "list" | "cards";

/** @summary Persiste la preferencia de vista (Lista/Tarjetas) por pantalla en localStorage. */
export function useViewMode(key: string): [ViewMode, (next: ViewMode) => void] {
  const [mode, setMode] = useState<ViewMode>("list");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(`viewmode:${key}`) as ViewMode | null;
      if (stored === "list" || stored === "cards") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMode(stored);
      }
    } catch {
      /* almacenamiento no disponible */
    } finally {
      setHydrated(true);
    }
  }, [key]);

  const apply = useCallback(
    (next: ViewMode) => {
      setMode(next);
      try {
        window.localStorage.setItem(`viewmode:${key}`, next);
      } catch {
        /* almacenamiento no disponible */
      }
    },
    [key],
  );

  return [hydrated ? mode : "list", apply];
}

/** @summary Selector Lista/Tarjetas reutilizable para colecciones. */
export function ViewModeToggle({ value, onChange }: { value: ViewMode; onChange: (next: ViewMode) => void }) {
  return (
    <div className="flex rounded-xl bg-white/5 p-1" role="group" aria-label="Vista de la lista">
      {(["list", "cards"] as const).map((option) => (
        <button
          className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
            value === option ? "bg-pink-500 text-white" : "text-zinc-500 hover:text-zinc-300"
          }`}
          key={option}
          onClick={() => onChange(option)}
          type="button"
        >
          {option === "list" ? "Lista" : "Tarjetas"}
        </button>
      ))}
    </div>
  );
}
