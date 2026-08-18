"use client";

export function RelatedDocuments({ title, items, empty }: { title: string; items: Array<{ href: string; label: string; count?: number; tone?: "default" | "success" | "warning" | "danger" }>; empty?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{title}</p>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">{empty ?? "Sin documentos relacionados."}</p>
      ) : (
        <div className="mt-3 space-y-2">
          {items.map((item, index) => (
            <a
              key={index}
              href={item.href}
              className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-sm transition-colors hover:bg-white/[0.07]"
            >
              <span className="font-semibold text-zinc-200">{item.label}</span>
              {item.count !== undefined && <span className="text-xs text-zinc-500">{item.count}</span>}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
