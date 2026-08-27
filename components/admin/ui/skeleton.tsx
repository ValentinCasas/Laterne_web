
type SkeletonShape = "text" | "circle" | "rect";

interface SkeletonProps {
  shape?: SkeletonShape;
  className?: string;
  width?: string | number;
  height?: string | number;
}

/** @summary Placeholder de carga reutilizable con animación shimmer sutil. */
export function Skeleton({ shape = "text", className, width, height }: SkeletonProps) {
  const style = {
    width: typeof width === "number" ? `${width}px` : width,
    height: typeof height === "number" ? `${height}px` : height,
  };

  const base =
    "animate-pulse rounded-md bg-[var(--admin-border-strong)]/60";

  if (shape === "circle") {
    return <span className={`${base} shrink-0 rounded-full ${className ?? ""}`} style={style} />;
  }

  if (shape === "rect") {
    return <span className={`${base} ${className ?? ""}`} style={style} />;
  }

  return <span className={`${base} h-3 w-full max-w-[320px] ${className ?? ""}`} style={style} />;
}

/** @summary Grupo de skeletons para tablas. */
export function SkeletonTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton key={`head-${index}`} shape="text" className="h-3 w-full" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={`row-${rowIndex}`} className="flex items-center gap-3">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={`cell-${rowIndex}-${colIndex}`} shape="text" className="h-3 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}

/** @summary Grupo de skeletons para cards KPI. */
export function SkeletonKpi({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={`kpi-${index}`} className="space-y-3 rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
          <Skeleton shape="text" className="h-3 w-24" />
          <Skeleton shape="text" className="h-8 w-32" />
        </div>
      ))}
    </div>
  );
}

/** @summary Grupo de skeletons para tarjetas de board. */
export function SkeletonBoardCards({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={`board-${index}`} className="space-y-3 rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
          <Skeleton shape="text" className="h-3 w-20" />
          <Skeleton shape="text" className="h-4 w-full" />
          <Skeleton shape="text" className="h-3 w-24" />
        </div>
      ))}
    </div>
  );
}
