import type { ReactNode } from "react";
import { AdminPageHelp } from "@/components/admin/admin-page-help";

/** @summary Cabecera de página consistente: eyebrow, título, descripción, acciones y breadcrumbs opcionales. */
export function PageHeader({
  eyebrow,
  title,
  description,
  section,
  actions,
  breadcrumbs,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  section: string;
  actions?: ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  children?: ReactNode;
}) {
  return (
    <header className="admin-page-header mb-6 rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-sm sm:p-7">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-2 text-xs text-[var(--admin-muted)]">
          {breadcrumbs.map((crumb, index) => (
            <span key={index} className="flex items-center gap-2">
              {index > 0 && <span className="text-[var(--admin-border)]">/</span>}
              {crumb.href ? (
                <a href={crumb.href} className="transition hover:text-zinc-300">{crumb.label}</a>
              ) : (
                <span className="text-zinc-300">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 max-w-3xl">
          {eyebrow && (
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--admin-primary-strong)]">{eyebrow}</p>
          )}
          <div className="mt-2 flex items-center gap-3">
            <h1 className="text-xl font-black tracking-tight sm:text-2xl lg:text-3xl">{title}</h1>
            <AdminPageHelp section={section} />
          </div>
          {description && (
            <p className="mt-3 text-sm leading-relaxed text-[var(--admin-muted)] sm:text-base">{description}</p>
          )}
          {children}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
    </header>
  );
}
