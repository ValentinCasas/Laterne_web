"use client";

import type { ReactNode } from "react";

/** @summary Vista dividida con panel principal y lateral ajustable. */
export function SplitView({ primary, sidebar, sidebarWidth = "320px" }: { primary: ReactNode; sidebar: ReactNode; sidebarWidth?: string }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_var(--tw-sidebar-width)]" style={{ "--tw-sidebar-width": sidebarWidth } as React.CSSProperties}>
      <section className="min-w-0 space-y-6">{primary}</section>
      <aside className="min-w-0 space-y-6 lg:sticky lg:top-6 lg:h-fit">{sidebar}</aside>
    </div>
  );
}
