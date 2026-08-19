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
  children?: ReactNode;
}

const BASE_CARD =
  "rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)]";

/** @summary Card base reutilizable con escala de padding coherente y tokens del admin. */
export function Card({
  padding = "default",
  interactive = false,
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={`${BASE_CARD} ${PADDING_CLASSES[padding]} ${
        interactive
          ? "transition-colors hover:border-white/20 hover:bg-[var(--admin-surface-elevated)]"
          : ""
      } ${className ?? ""}`}
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
      className={`mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-white/5 pb-4 ${
        className ?? ""
      }`}
    >
      <div className="flex min-w-0 items-start gap-3">
        {icon && (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/5 text-[var(--admin-primary)]">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          {typeof title === "string" ? (
            <h3 className="truncate text-base font-black text-zinc-100">{title}</h3>
          ) : (
            title
          )}
          {description && (
            <p className="mt-1 text-xs leading-relaxed text-[var(--admin-muted)]">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/** @summary Título de card (jerarquía clara, evita truncar sin control). */
export function CardTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h3 className={`text-base font-black text-zinc-100 ${className ?? ""}`}>
      {children}
    </h3>
  );
}

/** @summary Descripción secundaria de card. */
export function CardDescription({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`text-xs leading-relaxed text-[var(--admin-muted)] ${className ?? ""}`}
    >
      {children}
    </p>
  );
}

/** @summary Cuerpo de card con separación vertical coherente. */
export function CardContent({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={className ?? ""}>{children}</div>;
}

/** @summary Pie de card con separación superior y agrupación de acciones. */
export function CardFooter({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-white/5 pt-4 ${
        className ?? ""
      }`}
    >
      {children}
    </div>
  );
}
