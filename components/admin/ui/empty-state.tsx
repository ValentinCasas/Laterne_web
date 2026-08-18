import type { ReactNode } from "react";
import { Icon } from "@/components/admin/ui/icons";

/** @summary Estado vacío consistente con título, descripción y acción opcional. */
export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/10 bg-white/[0.01] p-12 text-center">
      <Icon name="inbox" className="text-3xl text-zinc-600" />
      <div>
        <p className="text-sm font-bold text-zinc-300">{title}</p>
        {description && <p className="mt-1 text-xs text-[var(--admin-muted)]">{description}</p>}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
