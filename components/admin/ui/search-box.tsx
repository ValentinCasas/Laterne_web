"use client";

export function SearchBox({ value, onChange, placeholder = "Buscar...", className, onKeyDown }: { value: string; onChange: (value: string) => void; placeholder?: string; className?: string; onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void }) {
  return (
    <div className={`relative ${className ?? ""}`}>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        onKeyDown={onKeyDown}
        className="w-full rounded-lg border border-white/10 bg-white/5 pl-9 pr-3 py-2 text-sm text-zinc-300 outline-none transition-colors placeholder:text-zinc-500 focus:border-pink-500/50 focus:bg-white/10"
      />
      <svg className="pointer-events-none absolute inset-y-0 left-0 h-full w-4 pl-3 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
    </div>
  );
}
