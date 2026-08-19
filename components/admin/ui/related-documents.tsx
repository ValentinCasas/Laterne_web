"use client";

import type { Route } from "next";
import Link from "next/link";

const toneClasses: Record<string, string> = {
  default: "",
  success: "text-emerald-300",
  warning: "text-amber-300",
  danger: "text-rose-300",
};

/** @summary Panel de documentos relacionados con drill-down a documentos padre/hijo. */
export function RelatedDocuments({ title, items, empty }: { title: string; items: Array<{ href: string; label: string; count?: number; tone?: "default" | "success" | "warning" | "danger" }>; empty?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{title}</p>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">{empty ?? "Sin documentos relacionados."}</p>
      ) : (
        <div className="mt-3 space-y-1.5">
          {items.map((item, index) => (
            <Link
              key={index}
              href={item.href as Route}
              className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.03] px-4 py-2.5 text-sm transition-colors hover:bg-white/[0.06] hover:border-white/10"
            >
              <span className="font-semibold text-zinc-200">{item.label}</span>
              {item.count !== undefined && (
                <span className={`text-xs font-bold tabular-nums ${toneClasses[item.tone ?? "default"] ?? "text-zinc-500"}`}>
                  {item.count}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
