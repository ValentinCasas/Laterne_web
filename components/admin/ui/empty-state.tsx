import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/admin/ui/icons";

type EmptyVariant = "default" | "minimal";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  variant?: EmptyVariant;
  icon?: IconName;
}

/** @summary Estado vacío consistente con variante default y minimal. */
export function EmptyState({ title, description, action, variant = "default", icon = "inbox" }: EmptyStateProps) {
  if (variant === "minimal") {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
        <span className="grid h-10 w-10 place-items-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-elevated)] text-zinc-500">
          <Icon name={icon} className="h-4 w-4" />
        </span>
        <p className="text-sm font-semibold text-zinc-300">{title}</p>
        {description && <p className="max-w-sm text-xs leading-relaxed text-[var(--admin-muted)]">{description}</p>}
        {action && <div className="mt-1">{action}</div>}
      </div>
    );
  }

  return (
    <div className="flex min-h-52 flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-[var(--admin-border-strong)] bg-[var(--admin-surface)] p-6 text-center sm:p-8">
      <span className="grid h-12 w-12 place-items-center rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface-elevated)] text-zinc-500">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <div className="max-w-md">
        <p className="text-sm font-bold text-zinc-200">{title}</p>
        {description && <p className="mx-auto mt-1.5 text-xs leading-relaxed text-[var(--admin-muted)]">{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
