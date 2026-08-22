import type { ReactNode } from "react";

/** @summary Encabezado de sección consistente dentro de una página. */
export function SectionHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-3 ${className ?? ""}`}>
      <div>
        <h2 className="text-base font-bold tracking-tight text-zinc-100 sm:text-lg">{title}</h2>
        {description && (
          <p className="mt-1 max-w-2xl text-sm leading-5 text-[var(--admin-muted)]">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
