import type { HTMLAttributes, ReactNode } from "react";

/**
 * Escala de padding coherente para todas las cards del admin.
 *  - compact:  paneles densos, listas, tiles internos.
 *  - default:  card estándar de sección/formulario.
 *  - spacious: hero cards, previews, paneles destacados.
 */
export type CardPadding = "compact" | "default" | "spacious";

const PADDING_CLASSES: Record<CardPadding, string> = {
  compact: "p-4",
  default: "p-5 sm:p-6",
  spacious: "p-6 sm:p-7",
};

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Escala de padding interior (ver `CardPadding`). */
  padding?: CardPadding;
  /** Aplica hover sutil de borde + elevación (cards clicables). */
  interactive?: boolean;
  /** Marca visualmente una card seleccionada sin depender solo del color. */
  selected?: boolean;
  children?: ReactNode;
}

const BASE_CARD =
  "admin-card rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[var(--admin-shadow-sm)]";

/** @summary Card base reutilizable con escala de padding coherente y tokens del admin. */
export function Card({
  padding = "default",
  interactive = false,
  selected = false,
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={`${BASE_CARD} ${PADDING_CLASSES[padding]} ${
        interactive
          ? "transition-[transform,border-color,background-color,box-shadow] duration-150 hover:-translate-y-0.5 hover:border-[var(--admin-border-strong)] hover:bg-[var(--admin-surface-elevated)] hover:shadow-[var(--admin-shadow-md)]"
          : ""
      } ${selected ? "border-[var(--admin-primary)]/60 bg-[var(--admin-primary-soft)] ring-1 ring-[var(--admin-primary)]/20" : ""} ${className ?? ""}`}
      {...props}
    >
      {children}
    </div>
  );
}

/** @summary Encabezado de card con separación inferior sutil y espacio para acciones. */
export function CardHeader({
  title,
  description,
  icon,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-[var(--admin-border)] pb-4 ${
        className ?? ""
      }`}
    >
      <div className="flex min-w-0 items-start gap-3">
        {icon && (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-elevated)] text-[var(--admin-primary)]">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          {typeof title === "string" ? (
            <h3 className="truncate text-base font-bold text-zinc-100">{title}</h3>
          ) : (
            title
          )}
          {description && (
            <p className="mt-1 text-xs leading-relaxed text-[var(--admin-muted)]">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/** @summary Título de card (jerarquía clara, evita truncar sin control). */
export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={`text-base font-bold text-zinc-100 ${className ?? ""}`}>{children}</h3>;
}

/** @summary Descripción secundaria de card. */
export function CardDescription({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={`text-xs leading-relaxed text-[var(--admin-muted)] ${className ?? ""}`}>{children}</p>;
}

/** @summary Cuerpo de card con separación vertical coherente. */
export function CardContent({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={className ?? ""}>{children}</div>;
}

/** @summary Pie de card con separación superior y agrupación de acciones. */
export function CardFooter({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={`mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-[var(--admin-border)] pt-4 ${
        className ?? ""
      }`}
    >
      {children}
    </div>
  );
}
