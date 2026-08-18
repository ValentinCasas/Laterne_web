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
    <div className="flex flex-wrap gap-2 border-b border-[var(--admin-border)] pb-1">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          disabled={tab.disabled}
          onClick={() => handleSelect(tab.key)}
          className={`rounded-t-lg px-4 py-2 text-sm font-bold transition-colors ${
            active === tab.key
              ? "border-b-2 border-pink-500 text-pink-300"
              : "text-zinc-400 hover:text-zinc-200"
          } ${tab.disabled ? "opacity-50" : ""}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
