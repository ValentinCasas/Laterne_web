"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { useState } from "react";
import { switchAdminBranchPath } from "@/lib/routes";

type BranchOption = {
  id: number;
  name: string;
  slug: string;
  isPrimary: boolean;
};

/** @summary Selector URL-driven: cambiar sucursal nunca modifica la sesión ni otra pestaña. */
export function BranchSwitcher({
  branches,
  activeBranchId,
  activeBranchName,
  consolidatedAvailable = false,
}: {
  branches: BranchOption[];
  activeBranchId?: number;
  activeBranchName?: string;
  consolidatedAvailable?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  function navigate(branchSlug?: string) {
    const destination = switchAdminBranchPath(pathname, branchSlug);
    const query = new URLSearchParams(searchParams.toString());
    // branchId era la identidad legacy de la sucursal; ya no debe sobrevivir en la URL.
    query.delete("branchId");
    const suffix = query.size ? `?${query.toString()}` : "";
    setOpen(false);
    router.push(`${destination}${suffix}` as Route);
  }

  if (!branches || branches.length === 0) return null;
  const consolidated = activeBranchId === 0 || activeBranchId === undefined;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm font-bold text-zinc-200 hover:border-white/25"
      >
        <span className="min-w-0 truncate">
          {consolidated
            ? consolidatedAvailable
              ? "Todas las sucursales"
              : "Elegí sucursal"
            : activeBranchName ?? branches.find((b) => b.id === activeBranchId)?.name ?? "Elegí sucursal"}
        </span>
        <span className="shrink-0 text-[10px] text-zinc-500">▼</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-full min-w-56 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl">
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
