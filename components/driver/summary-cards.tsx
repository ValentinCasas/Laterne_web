"use client";

import { Icon, type IconName } from "@/components/admin/ui/icons";
import { NumberFlow } from "@/components/admin/ui/number-flow";

/** @summary Resumen compacto de la jornada con animación numérica accesible. */
export function DriverSummaryCards({
  active,
  deliveredToday,
  averageMinutes,
  incidents,
}: {
  active: number;
  deliveredToday: number;
  averageMinutes: number | null;
  incidents: number;
}) {
  const items: Array<{ label: string; value: number; suffix?: string; icon: IconName; tone: string }> = [
    { label: "Activas", value: active, icon: "package", tone: "text-sky-300 bg-sky-500/10" },
    { label: "Hoy", value: deliveredToday, icon: "check-circle", tone: "text-emerald-300 bg-emerald-500/10" },
    { label: "Tiempo medio", value: averageMinutes ?? 0, suffix: averageMinutes === null ? "" : " min", icon: "clock", tone: "text-violet-300 bg-violet-500/10" },
    { label: "Incidencias", value: incidents, icon: "warning", tone: incidents > 0 ? "text-orange-300 bg-orange-500/10" : "text-zinc-300 bg-white/5" },
  ];

  return (
    <section className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Resumen de la jornada">
      {items.map((item) => (
        <article key={item.label} className="rounded-2xl border border-white/10 bg-zinc-900/70 p-3 shadow-lg transition hover:-translate-y-0.5 hover:border-white/15">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">{item.label}</p>
            <span className={`grid h-7 w-7 place-items-center rounded-xl ${item.tone}`}><Icon name={item.icon} className="h-3.5 w-3.5" /></span>
          </div>
          <p className="mt-2 text-2xl font-black tracking-tight text-white">
            {averageMinutes === null && item.label === "Tiempo medio" ? "—" : <NumberFlow value={item.value} suffix={item.suffix} />}
          </p>
        </article>
      ))}
    </section>
  );
}
