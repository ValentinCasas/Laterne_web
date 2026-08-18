"use client";

import type { ReactNode } from "react";

/** @summary Panel lateral tipo FactBox para contextualizar fichas y documentos. */
export function FactBox({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <aside className={`rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 ${className ?? ""}`}>
      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{title}</p>
      <div className="mt-3 space-y-3 text-sm">{children}</div>
    </aside>
  );
}
