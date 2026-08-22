"use client";

export function SearchBox({
  value,
  onChange,
  placeholder = "Buscar...",
  className,
  onKeyDown,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className={`relative ${className ?? ""}`}>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        onKeyDown={onKeyDown}
        className="admin-control h-9 w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-elevated)] py-2 pl-9 pr-3 text-sm text-zinc-200 outline-none placeholder:text-zinc-500 focus:border-[var(--admin-primary)]/55"
      />
      <svg
        className="pointer-events-none absolute inset-y-0 left-0 h-full w-4 pl-3 text-zinc-500"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.25}
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
    </div>
  );
}
