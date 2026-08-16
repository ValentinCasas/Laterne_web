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

/** @summary Ícono de local/sucursal monocromo para el selector compacto. */
function StoreIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-4 w-4 shrink-0"
      aria-hidden="true"
    >
      <path d="M4 10h16l-1-5H5l-1 5Z" strokeLinejoin="round" />
      <path d="M5 10v9h14v-9" strokeLinejoin="round" />
      <path d="M9 19v-4h6v4" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * @summary Selector URL-driven: cambiar sucursal nunca modifica la sesión ni otra pestaña.
 * `compact` lo adapta a la barra superior (ícono + nombre abreviado, menú alineado a la derecha).
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
     * @summary Cierra el selector al interactuar fuera de él o con Escape.
     */
    function handlePointer(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointer);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handlePointer);
      document.removeEventListener("keydown", handleEscape);
    };
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
  const selectedBranch = branches.find((b) => b.id === activeBranchId);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Cambiar sucursal"
        title={currentLabel}
        className={
          compact
            ? "flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm font-medium text-zinc-400 transition-colors duration-150 hover:bg-white/[.05] hover:text-zinc-100"
            : "flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm font-bold text-zinc-200 hover:border-white/25"
        }
      >
        <StoreIcon />{" "}
        <span className={`min-w-0 truncate ${compact ? "hidden max-w-32 2xl:inline" : ""}`}>
          {currentLabel}
        </span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`h-3 w-3 shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div
          className={`absolute top-full z-50 mt-2 min-w-56 overflow-hidden rounded-xl border border-white/10 bg-zinc-900/95 p-1.5 shadow-xl shadow-black/25 backdrop-blur-xl ${
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
              className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-zinc-300 transition-colors duration-150 hover:bg-white/[.06] hover:text-white"
            >
              <span className="min-w-0 truncate">{branch.name}</span>
              {selectedBranch?.id === branch.id ? (
                <span className="text-pink-300" aria-label="Sucursal actual">
                  ✓
                </span>
              ) : branch.isPrimary ? (
                <small className="shrink-0 text-[10px] text-zinc-500">Principal</small>
              ) : null}
            </button>
          ))}
          {consolidatedAvailable && (
            <button
              type="button"
              onClick={() => navigate(undefined)}
              className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors duration-150 hover:bg-white/[.06] ${
                consolidated ? "text-pink-300" : "text-zinc-300 hover:text-white"
              }`}
            >
              <span>Ver todas las sucursales</span>
              {consolidated && <span className="text-pink-300">✓</span>}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
