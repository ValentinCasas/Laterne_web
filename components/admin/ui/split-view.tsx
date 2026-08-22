"use client";

import type { ReactNode } from "react";

/** @summary Vista dividida con panel principal y lateral ajustable. */
export function SplitView({
  primary,
  sidebar,
  sidebarWidth = "320px",
}: {
  primary: ReactNode;
  sidebar: ReactNode;
  sidebarWidth?: string;
}) {
  return (
    <div
      className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_var(--tw-sidebar-width)]"
      style={{ "--tw-sidebar-width": sidebarWidth } as React.CSSProperties}
    >
      <section className="min-w-0 space-y-5">{primary}</section>
      <aside className="min-w-0 space-y-5 lg:sticky lg:top-5 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto">
        {sidebar}
      </aside>
    </div>
  );
}
