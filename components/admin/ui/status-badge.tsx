/**
 * @summary Badge de estado consistente con dot indicator y colores semánticos.
 *
 * Muestra un punto de color + texto para mejor jerarquía visual.
 * Los colores se resuelven automáticamente por status o por tone explícito.
 */
export function StatusBadge({
  status,
  tone,
  size = "default",
}: {
  status: string;
  tone?: "default" | "success" | "warning" | "danger" | "info";
  size?: "default" | "sm";
}) {
  const styles: Record<string, { badge: string; dot: string }> = {
    default: { badge: "border-white/10 bg-white/5 text-zinc-300", dot: "bg-zinc-400" },
    success: { badge: "border-emerald-400/20 bg-emerald-500/10 text-emerald-300", dot: "bg-emerald-400" },
    warning: { badge: "border-amber-400/20 bg-amber-500/10 text-amber-300", dot: "bg-amber-400" },
    danger: { badge: "border-red-400/20 bg-red-500/10 text-red-300", dot: "bg-red-400" },
    info: { badge: "border-sky-400/20 bg-sky-500/10 text-sky-300", dot: "bg-sky-400" },
  };

  const autoMap: Record<string, string> = {
    active: "success",
    delivered: "success",
    completed: "success",
    finished: "success",
    paid: "success",
    published: "success",
    available: "success",
    cancelled: "danger",
    canceled: "danger",
    rejected: "danger",
    failed: "danger",
    incident: "danger",
    draft: "default",
    hidden: "default",
    archived: "default",
    pending: "warning",
    processing: "info",
    in_progress: "info",
    scheduled: "info",
  };

  const normalized = tone ?? autoMap[status.toLowerCase()] ?? "default";
  const style = styles[normalized] ?? styles.default;
  const isSmall = size === "sm";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-bold uppercase tracking-wider ${style.badge} ${
        isSmall ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]"
      }`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`} />
      {status}
    </span>
  );
}
