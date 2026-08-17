"use client";

import type { MenuEngineeringItem } from "@/lib/reports";
import { useMemo, useState } from "react";
import type { Route } from "next";
import Link from "next/link";

function SortIcon({ sortKey, column, sortDir }: { sortKey: keyof MenuEngineeringItem; column: keyof MenuEngineeringItem; sortDir: "asc" | "desc" }) {
  if (sortKey !== column) return <span className="ml-1 text-zinc-600">↕</span>;
  return <span className="ml-1 text-pink-400">{sortDir === "asc" ? "↑" : "↓"}</span>;
}

function TrendIcon({ trend }: { trend: "up" | "down" | "stable" }) {
  if (trend === "up") return <span className="text-emerald-400">↑</span>;
  if (trend === "down") return <span className="text-red-400">↓</span>;
  return <span className="text-zinc-500">→</span>;
}

const quadrantLabels: Record<string, string> = {
  potenciar: "Potenciar / Mantener",
  revisar: "Revisar precio/receta",
  promocionar: "Promocionar / Combinar",
  reformular: "Reformular / Evaluar retirar",
  sin_datos: "Sin datos",
};

const quadrantColors: Record<string, string> = {
  potenciar: "text-emerald-300",
  revisar: "text-amber-300",
  promocionar: "text-sky-300",
  reformular: "text-red-300",
  sin_datos: "text-zinc-400",
};

/** @summary Tabla de ingeniería de menú con ordenar, buscar y navegación. */
export function MenuEngineeringTable({ data }: { data: MenuEngineeringItem[] }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<keyof MenuEngineeringItem>("units");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(
      (item) =>
        item.productName.toLowerCase().includes(q) ||
        (item.categoryName ?? "").toLowerCase().includes(q) ||
        item.quadrant.toLowerCase().includes(q),
    );
  }, [data, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  function handleSort(key: keyof MenuEngineeringItem) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-zinc-400">
          {sorted.length} productos · {data.filter((d) => d.costAvailable).length} con costo · {data.filter((d) => !d.costAvailable).length} sin costo
        </p>
        <input
          type="text"
          placeholder="Buscar producto, categoría o clasificación..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-300 outline-none focus:border-pink-500/50"
        />
      </div>
      <div className="overflow-x-auto rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--admin-border)] bg-white/[0.02] text-xs uppercase tracking-wider text-[var(--admin-muted)]">
              <th className="px-4 py-3 font-bold cursor-pointer" onClick={() => handleSort("productName")}>
                Producto <SortIcon sortKey={sortKey} column="productName" sortDir={sortDir} />
              </th>
              <th className="px-4 py-3 font-bold cursor-pointer" onClick={() => handleSort("categoryName")}>
                Categoría <SortIcon sortKey={sortKey} column="categoryName" sortDir={sortDir} />
              </th>
              <th className="px-4 py-3 font-bold text-right cursor-pointer" onClick={() => handleSort("units")}>
                Unidades <SortIcon sortKey={sortKey} column="units" sortDir={sortDir} />
              </th>
              <th className="px-4 py-3 font-bold text-right cursor-pointer" onClick={() => handleSort("sales")}>
                Ventas <SortIcon sortKey={sortKey} column="sales" sortDir={sortDir} />
              </th>
              <th className="px-4 py-3 font-bold text-right">Costo</th>
              <th className="px-4 py-3 font-bold text-right">CMV %</th>
              <th className="px-4 py-3 font-bold text-right">Margen</th>
              <th className="px-4 py-3 font-bold text-right cursor-pointer" onClick={() => handleSort("marginPercent")}>
                Margen % <SortIcon sortKey={sortKey} column="marginPercent" sortDir={sortDir} />
              </th>
              <th className="px-4 py-3 font-bold text-right">Markup</th>
              <th className="px-4 py-3 font-bold text-center">Tendencia</th>
              <th className="px-4 py-3 font-bold">Clasificación</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--admin-border)]">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-5 py-12 text-center text-[var(--admin-muted)]">
                  No hay productos para este período.
                </td>
              </tr>
            ) : (
              sorted.map((row) => (
                <tr key={row.productId} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <Link href={`/admin/productos?productId=${row.productId}` as Route} className="font-medium text-pink-300 hover:underline">
                      {row.productName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{row.categoryName || "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {row.units} <TrendIcon trend={row.unitsTrend} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    ${row.sales.toLocaleString("es-AR")} <TrendIcon trend={row.salesTrend} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-red-300">
                    {row.cmv !== null ? `$${row.cmv.toLocaleString("es-AR")}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {row.cmvPercent !== null ? `${row.cmvPercent.toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-emerald-300">
                    {row.margin !== null ? `$${row.margin.toLocaleString("es-AR")}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {row.marginPercent !== null ? `${row.marginPercent.toFixed(1)}%` : "—"} <TrendIcon trend={row.marginTrend} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {row.markup !== null ? `${row.markup.toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-4 py-3 text-center text-xs">
                    <div className="flex flex-col gap-0.5">
                      <span className={row.unitsTrend === "up" ? "text-emerald-400" : row.unitsTrend === "down" ? "text-red-400" : "text-zinc-500"}>
                        U {row.unitsTrend === "up" ? "↑" : row.unitsTrend === "down" ? "↓" : "→"}
                      </span>
                      <span className={row.salesTrend === "up" ? "text-emerald-400" : row.salesTrend === "down" ? "text-red-400" : "text-zinc-500"}>
                        V {row.salesTrend === "up" ? "↑" : row.salesTrend === "down" ? "↓" : "→"}
                      </span>
                      <span className={row.marginTrend === "up" ? "text-emerald-400" : row.marginTrend === "down" ? "text-red-400" : "text-zinc-500"}>
                        M {row.marginTrend === "up" ? "↑" : row.marginTrend === "down" ? "↓" : "→"}
                      </span>
                    </div>
                  </td>
                  <td className={`px-4 py-3 text-xs font-bold uppercase ${quadrantColors[row.quadrant]}`}>
                    {quadrantLabels[row.quadrant]}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
