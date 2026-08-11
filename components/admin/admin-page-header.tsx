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
    <header className="admin-page-header mb-8 rounded-[2rem] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-7 shadow-2xl shadow-black/20 sm:p-9">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="min-w-0 max-w-2xl">
          {eyebrow && <p className="section-eyebrow">{eyebrow}</p>}
           <div className="mt-2 flex items-center gap-3">
             <h1 className="text-3xl font-black tracking-tight sm:text-5xl">{title}</h1>
            <AdminPageHelp section={section} />
          </div>
           {description && <p className="mt-4 max-w-3xl text-base leading-relaxed text-[var(--admin-muted)]">{description}</p>}
          {children}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
      </div>
    </header>
  );
}
