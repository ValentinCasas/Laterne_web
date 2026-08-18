"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/admin/ui/icons";

export type ViewMode = "cards" | "cards-compact" | "list" | "list-compact";

const VIEW_LABELS: Record<ViewMode, string> = {
  cards: "Tarjetas",
  "cards-compact": "Tarjetas compactas",
  list: "Lista",
  "list-compact": "Lista compacta",
};

const VIEW_ICONS: Record<ViewMode, IconName> = {
  cards: "cards",
  "cards-compact": "grid",
  list: "list",
  "list-compact": "menu",
};

/** @summary Persiste la preferencia de vista (Tarjetas / Tarjetas compactas / Lista / Lista compacta) por pantalla. */
export function useViewMode(key: string): [ViewMode, (next: ViewMode) => void] {
  const [mode, setMode] = useState<ViewMode>("list");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(`viewmode:${key}`) as ViewMode | null;
      if (stored && stored in VIEW_LABELS) {
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

/** @summary Selector de las cuatro vistas (tarjeta, tarjeta compacta, lista, lista compacta). */
export function ViewModeToggle({ value, onChange }: { value: ViewMode; onChange: (next: ViewMode) => void }) {
  return (
    <div className="flex rounded-xl bg-white/5 p-1" role="group" aria-label="Vista de la lista">
      {(["cards", "cards-compact", "list", "list-compact"] as const).map((option) => (
        <button
          className={`rounded-lg px-2.5 py-2 text-xs font-bold transition ${
            value === option ? "bg-pink-500 text-white" : "text-zinc-500 hover:text-zinc-300"
          }`}
          key={option}
          onClick={() => onChange(option)}
          type="button"
          title={VIEW_LABELS[option]}
          aria-label={VIEW_LABELS[option]}
        >
          <Icon name={VIEW_ICONS[option]} className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}