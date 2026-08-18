/** @summary Badge de estado consistente con colores semánticos. */
export function StatusBadge({ status, tone }: { status: string; tone?: "default" | "success" | "warning" | "danger" | "info" }) {
  const styles: Record<string, string> = {
    default: "bg-white/5 text-zinc-300",
    success: "bg-emerald-500/10 text-emerald-300",
    warning: "bg-amber-500/10 text-amber-300",
    danger: "bg-red-500/10 text-red-300",
    info: "bg-sky-500/10 text-sky-300",
  };

  const normalized = tone ?? "default";
  if (!styles[normalized]) {
    const map: Record<string, string> = {
      active: "success",
      delivered: "success",
      completed: "success",
      finished: "success",
      paid: "success",
      cancelled: "danger",
      canceled: "danger",
      rejected: "danger",
      failed: "danger",
      pending: "warning",
      processing: "info",
      in_progress: "info",
      draft: "default",
    };
    const resolved = map[status.toLowerCase()] || "default";
    return (
      <span className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${styles[resolved]}`}>
        {status}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${styles[normalized]}`}>
      {status}
    </span>
  );
}
