"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { useEffect, useRef, useState } from "react";
import { switchAdminBranchPath } from "@/lib/routes";

type BranchOption = {
  id: number;
  name: string;
  slug: string;
  isPrimary: boolean;
};

/**
 * @summary Selector URL-driven: cambiar sucursal nunca modifica la sesión ni otra pestaña.
 * `compact` lo adapta a la barra superior (botón angosto con menú alineado a la derecha).
 */
export function BranchSwitcher({
  branches,
  activeBranchId,
  activeBranchName,
  consolidatedAvailable = false,
  compact = false,
}: {
  branches: BranchOption[];
  activeBranchId?: number;
  activeBranchName?: string;
  consolidatedAvailable?: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    /**
     * @summary Cierra el selector al interactuar fuera de él.
     */
    function handlePointer(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointer);
    return () => document.removeEventListener("pointerdown", handlePointer);
  }, [open]);

  /**
   * @summary Navega a la misma sección con la sucursal seleccionada.
   */
  function navigate(branchSlug?: string) {
    const destination = switchAdminBranchPath(pathname, branchSlug);
    const query = new URLSearchParams(searchParams.toString());
    // branchId era la identidad heredada de la sucursal; ya no debe sobrevivir en la URL.
    query.delete("branchId");
    const suffix = query.size ? `?${query.toString()}` : "";
    setOpen(false);
    router.push(`${destination}${suffix}` as Route);
  }

  if (!branches || branches.length === 0) return null;
  const consolidated = activeBranchId === 0 || activeBranchId === undefined;
  const currentLabel = consolidated
    ? consolidatedAvailable
      ? "Todas las sucursales"
      : "Elegí sucursal"
    : (activeBranchName ?? branches.find((b) => b.id === activeBranchId)?.name ?? "Elegí sucursal");

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={
          compact
            ? "inline-flex h-10 max-w-48 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-bold text-zinc-200 hover:border-white/25"
            : "flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm font-bold text-zinc-200 hover:border-white/25"
        }
      >
        <span className="min-w-0 truncate">{currentLabel}</span>
        <span className="shrink-0 text-[10px] text-zinc-500" aria-hidden="true">
          ▼
        </span>
      </button>
      {open && (
        <div
          className={`absolute top-full z-50 mt-2 min-w-56 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl ${
            compact ? "right-0" : "left-0 w-full"
          }`}
          role="listbox"
          aria-label="Sucursales"
        >
          {branches.map((branch) => (
            <button
              key={branch.id}
              type="button"
              onClick={() => navigate(branch.slug)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-white/10"
            >
              <span>{branch.name}</span>
              {branch.isPrimary && <small className="text-[10px] text-zinc-500">Principal</small>}
            </button>
          ))}
          {consolidatedAvailable && (
            <button
              type="button"
              onClick={() => navigate(undefined)}
              className="w-full border-t border-white/10 px-3 py-2.5 text-left text-sm text-pink-300 hover:bg-white/10"
            >
              Ver todas las sucursales
            </button>
          )}
        </div>
      )}
    </div>
  );
}
