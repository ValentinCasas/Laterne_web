"use client";

import type { ReactNode } from "react";

/** @summary Cabecera de documento con referencia, estado y acciones principales. */
export function DocumentHeader({ reference, title, status, actions, children }: { reference: string; title: string; status?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return (
    <header className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-widest text-pink-300">{reference}</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">{title}</h1>
          {status && <div className="mt-2">{status}</div>}
          {children}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
