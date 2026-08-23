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
    <header className="admin-page-header relative mb-6 border-b border-[var(--admin-border)] pb-5 pt-1 sm:mb-7 sm:pb-6">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav
          aria-label="Breadcrumb"
          className="mb-3 flex items-center gap-2 overflow-x-auto whitespace-nowrap text-xs text-[var(--admin-muted)]"
        >
          {breadcrumbs.map((crumb, index) => (
            <span key={index} className="flex items-center gap-2">
              {index > 0 && <span className="text-[var(--admin-border)]">/</span>}
              {crumb.href ? (
                <a href={crumb.href} className="transition hover:text-zinc-300">
                  {crumb.label}
                </a>
              ) : (
                <span className="text-zinc-300">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 max-w-3xl">
          {eyebrow && (
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-[var(--admin-primary-strong)]">
              <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
              {eyebrow}
            </p>
          )}
          <div className={`${eyebrow ? "mt-2" : ""} flex items-center gap-3`}>
            <h1 className="min-w-0 break-words text-2xl font-bold leading-tight tracking-[-0.025em] text-[var(--admin-text)] sm:text-[1.75rem]">
              {title}
            </h1>
            <AdminPageHelp section={section} />
          </div>
          {description && (
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[var(--admin-muted)]">{description}</p>
          )}
          {children}
        </div>
        {actions && (
          <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
