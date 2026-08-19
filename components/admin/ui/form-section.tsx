import type { ReactNode } from "react";

/**
 * Columnas del cuerpo de `FormSection` según el ancho disponible.
 *  - 2: formularios densos (2 columnas en escritorio).
 *  - 3: distribución equilibrada (por defecto).
 *  - 4: muchos campos cortes (moneda, país, estado, etc.) en pantallas grandes.
 */
export type FormColumns = 2 | 3 | 4;

const COLUMN_CLASSES: Record<FormColumns, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 xl:grid-cols-3",
  4: "sm:grid-cols-2 xl:grid-cols-4",
};

/** @summary Sección de formulario con título opcional y contenido agrupado. */
export function FormSection({
  title,
  description,
  children,
  className,
  columns = 3,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  columns?: FormColumns;
}) {
  return (
    <div className={`rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 sm:p-6 ${className ?? ""}`}>
      {(title || description) && (
        <div className="mb-5 border-b border-white/5 pb-4">
          {title && <h3 className="text-base font-black text-zinc-100">{title}</h3>}
          {description && <p className="mt-1 text-xs text-[var(--admin-muted)]">{description}</p>}
        </div>
      )}
      <div className={`grid gap-4 ${COLUMN_CLASSES[columns]}`}>{children}</div>
    </div>
  );
}
