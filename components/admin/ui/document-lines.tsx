"use client";

import type { ReactNode } from "react";

/** @summary Líneas de documento en tabla compacta con densidad configurable. */
export function DocumentLines({ headers, children, density = "normal" }: { headers: string[]; children: ReactNode; density?: "compact" | "normal" | "comfortable" }) {
  const headerClass = density === "compact" ? "px-3 py-2.5 text-[10px]" : density === "comfortable" ? "px-6 py-3.5 text-xs" : "px-5 py-3 text-[11px]";
  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm">
      <table className="w-full text-left">
        <thead>
          <tr className={`border-b border-[var(--admin-border)] bg-white/[0.03] uppercase tracking-wider text-[var(--admin-muted)] ${headerClass}`}>
            {headers.map((header, index) => (
              <th key={index} className="font-bold first:pl-5 last:pr-5">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--admin-border)]/50">{children}</tbody>
      </table>
    </div>
  );
}
