"use client";

export function ActiveFilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-zinc-300">
      {label}
      <button type="button" onClick={onRemove} className="ml-0.5 text-zinc-500 transition-colors hover:text-white" aria-label={`Quitar filtro ${label}`}>
        ×
      </button>
    </span>
  );
}
