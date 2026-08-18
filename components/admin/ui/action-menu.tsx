"use client";

export function ActionMenu({ items, align = "right" }: { items: Array<{ label: string; tone?: "default" | "danger" | "primary"; onClick: () => void }>; align?: "left" | "right" }) {
  return (
    <div className={`relative ${align === "right" ? "ml-auto" : ""}`}>
      <details className="group">
        <summary className="list-none flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-white/5 text-xs font-black text-zinc-300 transition-colors hover:bg-white/10">
          ⋯
        </summary>
        <div className="absolute z-50 mt-1 w-44 overflow-hidden rounded-xl border border-white/10 bg-zinc-900 p-1 shadow-xl">
          {items.map((item, index) => (
            <button
              key={index}
              type="button"
              onClick={item.onClick}
              className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors ${
                item.tone === "danger" ? "text-red-300 hover:bg-red-500/10" : item.tone === "primary" ? "text-pink-300 hover:bg-pink-500/10" : "text-zinc-300 hover:bg-white/5"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}
