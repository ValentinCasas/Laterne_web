"use client";

import { Icon, type IconName } from "@/components/admin/ui/icons";
import { NumberFlow } from "@/components/admin/ui/number-flow";

/** @summary Dashboard operativo del repartidor con KPIs premium, animación numérica y gradientes de estado. */
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
  const items: Array<{
    label: string;
    sublabel?: string;
    value: number;
    suffix?: string;
    icon: IconName;
    gradient: string;
    iconBg: string;
    iconColor: string;
    glow?: string;
  }> = [
    {
      label: "Activas",
      sublabel: "En curso",
      value: active,
      icon: "package",
      gradient: "from-sky-500/15 via-sky-500/5 to-transparent",
      iconBg: "bg-sky-500/20",
      iconColor: "text-sky-300",
      glow: active > 0 ? "shadow-sky-500/10" : undefined,
    },
    {
      label: "Entregadas",
      sublabel: "Hoy",
      value: deliveredToday,
      icon: "check-circle",
      gradient: "from-emerald-500/15 via-emerald-500/5 to-transparent",
      iconBg: "bg-emerald-500/20",
      iconColor: "text-emerald-300",
    },
    {
      label: "Tiempo medio",
      sublabel: "min por entrega",
      value: averageMinutes ?? 0,
      suffix: averageMinutes === null ? "" : " min",
      icon: "clock",
      gradient: "from-violet-500/15 via-violet-500/5 to-transparent",
      iconBg: "bg-violet-500/20",
      iconColor: "text-violet-300",
    },
    {
      label: "Incidencias",
      sublabel: "Pendientes",
      value: incidents,
      icon: "warning",
      gradient: incidents > 0 ? "from-orange-500/15 via-orange-500/5 to-transparent" : "from-white/5 via-white/[.02] to-transparent",
      iconBg: incidents > 0 ? "bg-orange-500/20" : "bg-white/10",
      iconColor: incidents > 0 ? "text-orange-300" : "text-zinc-400",
      glow: incidents > 0 ? "shadow-orange-500/10" : undefined,
    },
  ];

  return (
    <section className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Resumen de la jornada">
      {items.map((item) => (
        <article
          key={item.label}
          className={`group relative overflow-hidden rounded-2xl border border-white/[.08] bg-gradient-to-br ${item.gradient} p-4 shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:border-white/[.12] hover:shadow-xl ${item.glow ?? ""}`}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.16em] text-zinc-500">{item.label}</p>
              {item.sublabel && <p className="text-[9px] font-medium text-zinc-600">{item.sublabel}</p>}
            </div>
            <span className={`grid h-8 w-8 place-items-center rounded-xl ${item.iconBg} transition-transform duration-300 group-hover:scale-110`}>
              <Icon name={item.icon} className={`h-4 w-4 ${item.iconColor}`} />
            </span>
          </div>
          <p className="mt-3 text-3xl font-black tracking-tight text-white sm:text-2xl">
            {averageMinutes === null && item.label === "Tiempo medio" ? (
              <span className="text-zinc-500">—</span>
            ) : (
              <NumberFlow value={item.value} suffix={item.suffix} />
            )}
          </p>
          {/* Decorative gradient orb */}
          <div className={`absolute -bottom-6 -right-6 h-16 w-16 rounded-full opacity-[.07] transition-opacity group-hover:opacity-[.12] ${item.iconBg}`} />
        </article>
      ))}
    </section>
  );
}
