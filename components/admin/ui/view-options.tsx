"use client";

import { useMemo, useState } from "react";

export type Density = "compact" | "normal" | "comfortable";

const DENSITY_CLASSES: Record<Density, string> = {
  compact: "text-xs",
  normal: "text-sm",
  comfortable: "text-base",
};

const DENSITY_CELL_CLASSES: Record<Density, string> = {
  compact: "px-3 py-2",
  normal: "px-5 py-3.5",
  comfortable: "px-6 py-4",
};

const STORAGE_KEY = "admin-view-options";

type ViewOptions<T extends string> = {
  density: Density;
  pageSize: number;
  visibleColumns: T[];
  columnOrder: T[];
};

type ViewOptionsProps<T extends string> = {
  storageKey: string;
  columns: Array<{ key: T; label: string; hideOnMobile?: boolean }>;
  onChange?: (options: ViewOptions<T>) => void;
};

function loadOptions<T extends string>(storageKey: string, columns: Array<{ key: T; label: string }>): ViewOptions<T> {
  try {
    const stored = window.localStorage.getItem(`${STORAGE_KEY}:${storageKey}`);
    if (!stored) {
      return {
        density: "normal",
        pageSize: 20,
        visibleColumns: columns.map((c) => c.key),
        columnOrder: columns.map((c) => c.key),
      };
    }
    const parsed = JSON.parse(stored) as Partial<ViewOptions<T>>;
    return {
      density: parsed.density ?? "normal",
      pageSize: parsed.pageSize ?? 20,
      visibleColumns: parsed.visibleColumns ?? columns.map((c) => c.key),
      columnOrder: parsed.columnOrder ?? columns.map((c) => c.key),
    };
  } catch {
    return {
      density: "normal",
      pageSize: 20,
      visibleColumns: columns.map((c) => c.key),
      columnOrder: columns.map((c) => c.key),
    };
  }
}

function saveOptions(storageKey: string, options: ViewOptions<string>) {
  try {
    window.localStorage.setItem(`${STORAGE_KEY}:${storageKey}`, JSON.stringify(options));
  } catch {
    /* storage unavailable */
  }
}

/** @summary Opciones de vista persistidas: densidad, columnas visibles/orden, cantidad por página. */
export function ViewOptions<T extends string>({ storageKey, columns, onChange }: ViewOptionsProps<T>) {
  const [options, setOptions] = useState<ViewOptions<T>>(() => loadOptions(storageKey, columns));
  const [open, setOpen] = useState(false);

  const visibleColumnKeys = useMemo(() => new Set(options.visibleColumns), [options.visibleColumns]);

  function update(patch: Partial<ViewOptions<T>>) {
    const next = { ...options, ...patch };
    setOptions(next);
    saveOptions(storageKey, next as ViewOptions<string>);
    onChange?.(next);
  }

  function toggleColumn(key: T) {
    const next = visibleColumnKeys.has(key)
      ? options.visibleColumns.filter((c) => c !== key)
      : [...options.visibleColumns, key];
    update({ visibleColumns: next });
  }

  function moveColumn(key: T, direction: "up" | "down") {
    const order = [...options.columnOrder];
    const idx = order.indexOf(key);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= order.length) return;
    [order[idx], order[swapIdx]] = [order[swapIdx], order[idx]];
    update({ columnOrder: order });
  }

  function resetColumns() {
    update({ visibleColumns: columns.map((c) => c.key), columnOrder: columns.map((c) => c.key) });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-zinc-300 transition-colors hover:bg-white/10"
      >
        <span>Columnas / Vista</span>
        <span className="text-xs text-zinc-500">▼</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-xl border border-white/10 bg-zinc-900 p-4 shadow-xl">
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Densidad</label>
              <div className="mt-2 flex rounded-lg bg-white/5 p-1">
                {(["compact", "normal", "comfortable"] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => update({ density: d })}
                    className={`flex-1 rounded-md px-2 py-1.5 text-xs font-bold transition-colors ${
                      options.density === d ? "bg-pink-500 text-white" : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {d === "compact" ? "Compacta" : d === "normal" ? "Normal" : "Cómoda"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Filas por página</label>
              <select
                value={options.pageSize}
                onChange={(e) => update({ pageSize: Number(e.target.value) })}
                className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-300 outline-none focus:border-pink-500/50"
              >
                {[10, 20, 50, 100].map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Columnas</label>
                <button type="button" onClick={resetColumns} className="text-[10px] font-semibold text-pink-300 hover:text-pink-200">Restablecer</button>
              </div>
              <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
                {options.columnOrder.map((key) => {
                  const column = columns.find((c) => c.key === key);
                  if (!column) return null;
                  const visible = visibleColumnKeys.has(key);
                  return (
                    <div key={key} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5">
                      <input
                        type="checkbox"
                        checked={visible}
                        onChange={() => toggleColumn(key)}
                        className="h-4 w-4 rounded border-white/20 bg-white/5 text-pink-500 focus:ring-pink-500"
                      />
                      <span className={`flex-1 text-sm ${visible ? "text-zinc-200" : "text-zinc-500"}`}>{column.label}</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveColumn(key, "up")}
                          className="rounded p-1 text-zinc-500 hover:text-zinc-200"
                          aria-label="Mover arriba"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => moveColumn(key, "down")}
                          className="rounded p-1 text-zinc-500 hover:text-zinc-200"
                          aria-label="Mover abajo"
                        >
                          ↓
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { DENSITY_CLASSES, DENSITY_CELL_CLASSES };
