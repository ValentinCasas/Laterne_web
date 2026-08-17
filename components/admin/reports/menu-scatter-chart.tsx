"use client";

import type { MenuEngineeringItem } from "@/lib/reports";
import { useMemo, useState } from "react";

/** @summary Gráfico de dispersión interactivo para ingeniería de menú. */
export function MenuScatterChart({ data, popularityMedian, marginMedian }: { data: MenuEngineeringItem[]; popularityMedian: number; marginMedian: number }) {
  const [hovered, setHovered] = useState<MenuEngineeringItem | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const width = 800;
  const height = 500;
  const padding = { top: 20, right: 30, bottom: 50, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxUnits = useMemo(() => Math.max(1, ...data.map((d) => d.units)), [data]);
  const maxMargin = useMemo(() => {
    const margins = data.filter((d) => d.marginPercent !== null).map((d) => d.marginPercent!);
    if (margins.length === 0) return 100;
    return Math.max(100, ...margins);
  }, [data]);

  const quadrantColors: Record<string, string> = {
    potenciar: "#34d399",
    revisar: "#fbbf24",
    promocionar: "#60a5fa",
    reformular: "#f87171",
    sin_datos: "#6b7280",
  };

  function xFor(units: number) {
    return padding.left + (units / maxUnits) * chartWidth;
  }

  function yFor(margin: number | null) {
    if (margin === null) return padding.top + chartHeight / 2;
    return padding.top + chartHeight - (margin / maxMargin) * chartHeight;
  }

  function handleMouseEnter(item: MenuEngineeringItem, event: React.MouseEvent) {
    setHovered(item);
    setMousePos({ x: event.clientX, y: event.clientY });
  }

  function handleMouseMove(event: React.MouseEvent) {
    setMousePos({ x: event.clientX, y: event.clientY });
  }

  const visibleData = data.filter((d) => d.costAvailable && d.marginPercent !== null);

  return (
    <div className="relative w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full max-w-4xl">
        <defs>
          <linearGradient id="quadrantPotenciar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="quadrantRevisar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="quadrantPromocionar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="quadrantReformular" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f87171" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#f87171" stopOpacity="0" />
          </linearGradient>
        </defs>

        <line x1={padding.left} y1={yFor(marginMedian)} x2={width - padding.right} y2={yFor(marginMedian)} stroke="#71717a" strokeDasharray="4 4" />
        <line x1={xFor(popularityMedian)} y1={padding.top} x2={xFor(popularityMedian)} y2={height - padding.bottom} stroke="#71717a" strokeDasharray="4 4" />

        <rect x={padding.left} y={padding.top} width={xFor(popularityMedian) - padding.left} height={yFor(marginMedian) - padding.top} fill="url(#quadrantPotenciar)" />
        <rect x={xFor(popularityMedian)} y={padding.top} width={width - padding.right - xFor(popularityMedian)} height={yFor(marginMedian) - padding.top} fill="url(#quadrantRevisar)" />
        <rect x={padding.left} y={yFor(marginMedian)} width={xFor(popularityMedian) - padding.left} height={height - padding.bottom - yFor(marginMedian)} fill="url(#quadrantPromocionar)" />
        <rect x={xFor(popularityMedian)} y={yFor(marginMedian)} width={width - padding.right - xFor(popularityMedian)} height={height - padding.bottom - yFor(marginMedian)} fill="url(#quadrantReformular)" />

        <text x={padding.left + (xFor(popularityMedian) - padding.left) / 2} y={padding.top + (yFor(marginMedian) - padding.top) / 2} textAnchor="middle" fill="#34d399" fontSize="12" fontWeight="bold">
          POTENCIAR
        </text>
        <text x={xFor(popularityMedian) + (width - padding.right - xFor(popularityMedian)) / 2} y={padding.top + (yFor(marginMedian) - padding.top) / 2} textAnchor="middle" fill="#fbbf24" fontSize="12" fontWeight="bold">
          REVISAR
        </text>
        <text x={padding.left + (xFor(popularityMedian) - padding.left) / 2} y={yFor(marginMedian) + (height - padding.bottom - yFor(marginMedian)) / 2} textAnchor="middle" fill="#60a5fa" fontSize="12" fontWeight="bold">
          PROMOCIONAR
        </text>
        <text x={xFor(popularityMedian) + (width - padding.right - xFor(popularityMedian)) / 2} y={yFor(marginMedian) + (height - padding.bottom - yFor(marginMedian)) / 2} textAnchor="middle" fill="#f87171" fontSize="12" fontWeight="bold">
          REFORMULAR
        </text>

        {visibleData.map((item) => (
          <circle
            key={item.productId}
            cx={xFor(item.units)}
            cy={yFor(item.marginPercent)}
            r={6}
            fill={quadrantColors[item.quadrant]}
            stroke="#09090b"
            strokeWidth={1.5}
            className="cursor-pointer transition-all hover:r-8"
            onMouseEnter={(e) => handleMouseEnter(item, e)}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHovered(null)}
          />
        ))}

        <text x={width / 2} y={height - 10} textAnchor="middle" fill="#a1a1aa" fontSize="12">
          Popularidad (unidades vendidas)
        </text>
        <text x={15} y={height / 2} textAnchor="middle" fill="#a1a1aa" fontSize="12" transform={`rotate(-90 15 ${height / 2})`}>
          Margen %
        </text>

        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const value = Math.round((tick * maxUnits) / 10) * 10 || 0;
          return (
            <g key={`x-${tick}`}>
              <line x1={xFor(value)} y1={height - padding.bottom} x2={xFor(value)} y2={height - padding.bottom + 6} stroke="#71717a" />
              <text x={xFor(value)} y={height - padding.bottom + 20} textAnchor="middle" fill="#a1a1aa" fontSize="10">
                {value}
              </text>
            </g>
          );
        })}
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const value = Math.round((tick * maxMargin) / 10) * 10 || 0;
          return (
            <g key={`y-${tick}`}>
              <line x1={padding.left - 6} y1={yFor(value)} x2={padding.left} y2={yFor(value)} stroke="#71717a" />
              <text x={padding.left - 10} y={yFor(value)} textAnchor="end" fill="#a1a1aa" fontSize="10" dominantBaseline="middle">
                {value.toFixed(0)}%
              </text>
            </g>
          );
        })}
      </svg>

      {hovered && (
        <div
          className="fixed z-50 rounded-lg border border-white/10 bg-[#18181b] p-3 shadow-xl"
          style={{ left: mousePos.x + 12, top: mousePos.y - 12 }}
        >
          <p className="text-sm font-black text-white">{hovered.productName}</p>
          <p className="text-xs text-zinc-400">{hovered.categoryName || "Sin categoría"}</p>
          <div className="mt-2 space-y-1 text-xs">
            <p className="text-zinc-300">Unidades: <span className="font-bold">{hovered.units}</span></p>
            <p className="text-zinc-300">Ventas: <span className="font-bold">${hovered.sales.toLocaleString("es-AR")}</span></p>
            <p className="text-zinc-300">CMV: <span className="font-bold">{hovered.cmvPercent !== null ? `${hovered.cmvPercent.toFixed(1)}%` : "—"}</span></p>
            <p className="text-zinc-300">Margen: <span className="font-bold">{hovered.marginPercent !== null ? `${hovered.marginPercent.toFixed(1)}%` : "—"}</span></p>
            <p className="text-zinc-300">Clasificación: <span className="font-bold" style={{ color: quadrantColors[hovered.quadrant] }}>{hovered.quadrant.replace("_", " ").toUpperCase()}</span></p>
          </div>
        </div>
      )}
    </div>
  );
}
