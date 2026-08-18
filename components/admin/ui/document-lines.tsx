"use client";

import type { ReactNode } from "react";

/** @summary Líneas de documento en tabla compacta con densidad configurable. */
export function DocumentLines({ headers, children, density = "normal" }: { headers: string[]; children: ReactNode; density?: "compact" | "normal" | "comfortable" }) {
  const cellClass = density === "compact" ? "px-3 py-2 text-xs" : density === "comfortable" ? "px-5 py-4 text-base" : "px-4 py-3 text-sm";
  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
      <table className="w-full text-left">
        <thead>
          <tr className={`border-b border-[var(--admin-border)] bg-white/[0.02] text-xs uppercase tracking-wider text-[var(--admin-muted)] ${cellClass}`}>
            {headers.map((header, index) => (
              <th key={index} className="font-bold">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--admin-border)]">{children}</tbody>
      </table>
    </div>
  );
}
