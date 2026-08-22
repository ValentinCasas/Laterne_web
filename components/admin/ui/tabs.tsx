"use client";

import { useState } from "react";

/** @summary Tabs consistentes para secciones dentro de una página. */
export function Tabs({
  tabs,
  defaultTab,
  onChange,
}: {
  tabs: Array<{ key: string; label: string; disabled?: boolean }>;
  defaultTab?: string;
  onChange?: (key: string) => void;
}) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.key);

  function handleSelect(key: string) {
    setActive(key);
    onChange?.(key);
  }

  return (
    <div
      className="flex max-w-full gap-1 overflow-x-auto rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-1"
      role="tablist"
    >
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          disabled={tab.disabled}
          onClick={() => handleSelect(tab.key)}
          role="tab"
          aria-selected={active === tab.key}
          className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
            active === tab.key
              ? "bg-[var(--admin-surface-elevated)] text-white shadow-[var(--admin-shadow-sm)]"
              : "text-zinc-400 hover:bg-white/[.03] hover:text-zinc-200"
          } ${tab.disabled ? "opacity-50" : ""}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
