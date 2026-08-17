"use client";

import type { Route } from "next";
import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MultiBranchSelector } from "./multi-branch-selector";
import { ReportsFilters } from "@/components/admin/reports/reports-filters";

export type ConsolidadoTab = "resumen" | "evolucion" | "origen" | "stock" | "productos" | "promociones" | "usuarios" | "licencias";

const TABS: Array<{ key: ConsolidadoTab; label: string }> = [
  { key: "resumen", label: "Resumen" },
  { key: "evolucion", label: "Evolución" },
  { key: "origen", label: "Origen" },
  { key: "stock", label: "Stock crítico" },
  { key: "productos", label: "Productos y precios" },
  { key: "promociones", label: "Promociones" },
  { key: "usuarios", label: "Usuarios y acceso" },
  { key: "licencias", label: "Licencias" },
];

/** @summary Layout del dashboard consolidado multi-sucursal: tabs, selector de sucursales y período. */
export function ConsolidadoShell({
  children,
  branches,
  defaultFrom,
  defaultTo,
  periodPreset,
  defaultBranchIds,
}: {
  children: (params: {
    tab: ConsolidadoTab;
    branchIds: number[];
    from: string | undefined;
    to: string | undefined;
    period: string | undefined;
  }) => React.ReactNode;
  branches: Array<{ id: number; name: string }>;
  defaultFrom?: string;
  defaultTo?: string;
  periodPreset?: string;
  defaultBranchIds?: number[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [tab, setTab] = useState<ConsolidadoTab>(
    (searchParams.get("tab") as ConsolidadoTab) || "resumen",
  );

  const branchIds = useMemo(() => {
    const raw = searchParams.get("branchIds");
    if (!raw) return defaultBranchIds || [];
    return raw.split(",").map((id) => Number(id)).filter((id) => Number.isFinite(id));
  }, [searchParams, defaultBranchIds]);

  const period = useMemo(
    () => ({
      from: searchParams.get("from") || defaultFrom || undefined,
      to: searchParams.get("to") || defaultTo || undefined,
      period: searchParams.get("period") || periodPreset || undefined,
    }),
    [searchParams, defaultFrom, defaultTo, periodPreset],
  );

  function updatePatch(patch: Record<string, unknown>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "" || value === undefined) {
        params.delete(key);
      } else {
        params.set(key, String(value));
      }
    }
    const query = params.toString();
    const url = query ? `${pathname}?${query}` : pathname;
    router.replace(url as Route);
  }

  function handleBranchChange(next: number[]) {
    updatePatch({ branchIds: next.length > 0 ? next.join(",") : null });
  }

  function handleFilterChange(patch: Record<string, unknown>) {
    updatePatch(patch);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <MultiBranchSelector branches={branches} selectedBranchIds={branchIds} onChange={handleBranchChange} />
        <ReportsFilters
          filters={{
            from: period.from,
            to: period.to,
            branchId: branchIds.length === 1 ? branchIds[0] : null,
            categoryId: null,
            productId: null,
            supplierId: null,
            userId: null,
            paymentMethod: null,
            channel: null,
            source: null,
            period: period.period,
          }}
          onChange={handleFilterChange}
          branches={branches}
          categories={[]}
          products={[]}
          suppliers={[]}
          users={[]}
          paymentMethods={[]}
          channels={[]}
          sources={[]}
          periodPreset={period.period}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              setTab(item.key);
              updatePatch({ tab: item.key });
            }}
            className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
              tab === item.key
                ? "bg-pink-500/15 text-pink-300 ring-1 ring-pink-500/30"
                : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {children({ tab, branchIds, from: period.from, to: period.to, period: period.period })}
    </div>
  );
}
