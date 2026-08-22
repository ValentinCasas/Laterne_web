import type { ReactNode } from "react";
import { Icon } from "@/components/admin/ui/icons";

/** @summary Estado vacío consistente con título, descripción y acción opcional. */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--admin-border-strong)] bg-[var(--admin-surface)] p-6 text-center sm:p-8">
      <span className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-elevated)]">
        <Icon name="inbox" className="h-5 w-5 text-zinc-500" />
      </span>
      <div>
        <p className="text-sm font-bold text-zinc-200">{title}</p>
        {description && (
          <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-[var(--admin-muted)]">{description}</p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
