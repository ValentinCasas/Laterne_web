"use client";

import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useState } from "react";

type BranchOption = {
  id: number;
  name: string;
  isPrimary: boolean;
};

/** @summary Selector de sucursal activa para paneles multi-sucursal. */
export function BranchSwitcher({
  branches,
  activeBranchId,
  activeBranchName,
}: {
  branches: BranchOption[];
  activeBranchId?: number;
  activeBranchName?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function switchTo(branchId: number) {
    if (branchId === activeBranchId) {
      setOpen(false);
      return;
    }
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/admin/branch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ branchId }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? "No se pudo cambiar de sucursal");
        setPending(false);
        return;
      }
       setOpen(false);
       const url = new URL(window.location.href);
       if (branchId === 0) url.searchParams.set("branchId", "all");
       else url.searchParams.set("branchId", String(branchId));
       router.push(`${url.pathname}${url.search}` as Route);
       router.refresh();
    } catch {
      setError("No se pudo cambiar de sucursal");
      setPending(false);
    }
  }

  if (!branches || branches.length === 0) return null;
  const consolidated = activeBranchId === 0;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm font-bold text-zinc-200 hover:border-white/25"
        disabled={pending}
      >
        <span className="min-w-0 truncate">
          {consolidated ? "Todas las sucursales" : (activeBranchName ?? branches.find((b) => b.id === activeBranchId)?.name ?? "Elegí sucursal")}
        </span>
        <span className="shrink-0 text-[10px] text-zinc-500">▼</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-full min-w-56 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl">
          {branches.map((branch) => (
            <button
              key={branch.id}
              type="button"
              onClick={() => void switchTo(branch.id)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-white/10"
            >
              <span>{branch.name}</span>
              {branch.isPrimary && <small className="text-[10px] text-zinc-500">Principal</small>}
            </button>
          ))}
          <button
            type="button"
            onClick={() => void switchTo(0)}
            className="w-full border-t border-white/10 px-3 py-2.5 text-left text-sm text-pink-300 hover:bg-white/10"
          >
            Ver todas las sucursales
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
