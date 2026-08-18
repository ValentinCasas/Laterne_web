import type { ReactNode } from "react";

/** @summary Sección de formulario con título opcional y contenido agrupado. */
export function FormSection({ title, description, children, className }: { title?: string; description?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 sm:p-6 ${className ?? ""}`}>
      {(title || description) && (
        <div className="mb-5 border-b border-white/5 pb-4">
          {title && <h3 className="text-base font-black text-zinc-100">{title}</h3>}
          {description && <p className="mt-1 text-xs text-[var(--admin-muted)]">{description}</p>}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
    </div>
  );
}
