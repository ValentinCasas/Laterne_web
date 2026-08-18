"use client";

import type { ReactNode } from "react";

/** @summary Panel de filtros avanzados para usar dentro de drawers o popovers. */
export function FilterPanel({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-black uppercase tracking-widest text-zinc-300">{title}</p>
        {actions}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
