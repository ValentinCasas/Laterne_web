import type { ReactNode } from "react";

/** @summary Caja de datos (KPI compacto) con acento tonal opcional y etiqueta jerárquica. */
export function FactBox({
  title,
  children,
  icon,
  tone = "default",
  className,
}: {
  title: string;
  children: ReactNode;
  icon?: ReactNode;
  tone?: "default" | "success" | "warning" | "info" | "danger";
  className?: string;
}) {
  const accents: Record<string, string> = {
    default: "text-zinc-200",
    success: "text-emerald-300",
    warning: "text-amber-300",
    info: "text-sky-300",
    danger: "text-red-300",
  };
  return (
    <div
      className={`rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 sm:p-5 ${
        className ?? ""
      }`}
    >
      <div className="flex items-center gap-2">
        {icon && <span className="text-[var(--admin-primary)]">{icon}</span>}
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
          {title}
        </p>
      </div>
      <div className={`mt-2 text-sm ${accents[tone] ?? accents.default}`}>
        {children}
      </div>
    </div>
  );
}
