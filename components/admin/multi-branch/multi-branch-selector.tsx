"use client";

import { useMemo, useState } from "react";

/** @summary Selector multi-sucursal con opción global "Todas". */
export function MultiBranchSelector({
  branches,
  selectedBranchIds,
  onChange,
}: {
  branches: Array<{ id: number; name: string }>;
  selectedBranchIds: number[];
  onChange: (branchIds: number[]) => void;
}) {
  const [open, setOpen] = useState(false);

  const allSelected = selectedBranchIds.length === 0;
  const selectedNames = useMemo(
    () =>
      branches
        .filter((branch) => selectedBranchIds.includes(branch.id))
        .map((branch) => branch.name),
    [branches, selectedBranchIds],
  );

  function toggleBranch(branchId: number) {
    if (selectedBranchIds.includes(branchId)) {
      onChange(selectedBranchIds.filter((id) => id !== branchId));
    } else {
      onChange([...selectedBranchIds, branchId]);
    }
  }

  function selectAll() {
    onChange([]);
    setOpen(false);
  }

  function clearSelection() {
    onChange([]);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/10"
      >
        <span className="truncate">
          {allSelected
            ? "Todas las sucursales"
            : `${selectedNames.length} seleccionada${selectedNames.length === 1 ? "" : "s"}`}
        </span>
        <span className="text-xs text-zinc-500">▼</span>
      </button>
      {open && (
        <div className="absolute z-20 mt-2 w-72 rounded-xl border border-white/10 bg-zinc-900 p-2 shadow-xl">
          <div className="flex items-center justify-between border-b border-white/10 px-2 py-1.5">
            <span className="text-xs font-bold text-zinc-400">Sucursales</span>
            <button
              type="button"
              onClick={selectAll}
              className="text-xs font-semibold text-pink-300 hover:text-pink-200"
            >
              Seleccionar todas
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-white/5">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={selectAll}
                className="h-4 w-4 rounded border-white/20 bg-white/5 text-pink-500 focus:ring-pink-500"
              />
              <span className="text-sm text-zinc-300">Todas</span>
            </label>
            {branches.map((branch) => (
              <label key={branch.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-white/5">
                <input
                  type="checkbox"
                  checked={selectedBranchIds.includes(branch.id)}
                  onChange={() => toggleBranch(branch.id)}
                  className="h-4 w-4 rounded border-white/20 bg-white/5 text-pink-500 focus:ring-pink-500"
                />
                <span className="text-sm text-zinc-300">{branch.name}</span>
              </label>
            ))}
          </div>
          {!allSelected && (
            <div className="border-t border-white/10 px-2 py-1.5">
              <button
                type="button"
                onClick={clearSelection}
                className="text-xs font-semibold text-zinc-400 hover:text-zinc-200"
              >
                Limpiar selección
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
