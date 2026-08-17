"use client";

/** @summary Barra simple de evolución temporal. */
export function EvolutionBarChart({ data, height = 120 }: { data: Array<{ label: string; value: number }>; height?: number }) {
  if (!data.length) return null;
  const max = Math.max(1, ...data.map((item) => item.value));
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {data.map((item, index) => (
        <div key={index} className="flex flex-1 flex-col items-center gap-1">
          <div
            className="w-full rounded-t bg-pink-500/80 transition-all duration-150 hover:bg-pink-400"
            style={{ height: `${Math.max(2, (item.value / max) * 100)}%` }}
            title={item.value.toLocaleString("es-AR")}
          />
          <span className="truncate text-[10px] text-zinc-500">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

/** @summary Sparkline SVG simple. */
export function Sparkline({ data, color = "#ec4899" }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const width = 200;
  const height = 40;
  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-10 w-full max-w-xs">
      <polyline fill="none" stroke={color} strokeWidth="2" points={points} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** @summary Barras horizontales simples para distribución. */
export function HorizontalBarList({ data, maxKey = "value" }: { data: Array<{ label: string; [key: string]: unknown }>; maxKey?: string }) {
  if (!data.length) return null;
  const max = Math.max(1, ...data.map((item) => Number(item[maxKey]) || 0));
  return (
    <div className="space-y-2">
      {data.map((item, index) => (
        <div key={index} className="flex items-center gap-3">
          <span className="w-28 truncate text-xs text-zinc-400">{item.label}</span>
          <div className="flex-1 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-2 rounded-full bg-pink-500/80"
              style={{ width: `${Math.max(2, (Number(item[maxKey]) / max) * 100)}%` }}
            />
          </div>
          <span className="w-16 text-right text-xs font-bold tabular-nums text-zinc-300">
            {typeof item.value === "number" ? item.value.toLocaleString("es-AR") : String(item.value)}
          </span>
        </div>
      ))}
    </div>
  );
}
