import type { ReactNode } from "react";
import { AdminPageHelp } from "@/components/admin/admin-page-help";

/** @summary Cabecera unificada de las secciones administrativas con ayuda contextual. */
export function AdminPageHeader({
  eyebrow,
  title,
  description,
  section,
  actions,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  section: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="mb-6 rounded-[2rem] border border-white/10 bg-zinc-950/70 p-6 shadow-2xl shadow-black/20 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="min-w-0 max-w-2xl">
          {eyebrow && <p className="section-eyebrow">{eyebrow}</p>}
          <div className="mt-2 flex items-center gap-2">
            <h1 className="text-3xl font-black tracking-tight sm:text-5xl">{title}</h1>
            <AdminPageHelp section={section} />
          </div>
          {description && <p className="mt-3 leading-relaxed text-zinc-500">{description}</p>}
          {children}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
      </div>
    </header>
  );
}
