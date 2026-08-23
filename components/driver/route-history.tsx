"use client";

import { Icon, type IconName } from "@/components/admin/ui/icons";
import { NumberFlow } from "@/components/admin/ui/number-flow";
import { routeStatusMeta, formatDuration, formatDistance } from "@/lib/delivery-route-state";
import { formatDateTimeShort } from "@/lib/date-format";

type RouteHistoryItem = {
  id: number;
  status: string;
  startedAt?: string | Date | null;
  completedAt?: string | Date | null;
  cancelledAt?: string | Date | null;
  totalStops: number;
  completedStops: number;
  incidentCount: number;
  totalDistanceM?: number | null;
  totalDurationS?: number | null;
  createdAt: string | Date;
};

function formatDate(value: string | Date) {
  return formatDateTimeShort(value);
}

/** @summary Historial de recorridos del repartidor con KPIs personales y lista paginada. */
export function DriverRouteHistory({
  stats,
  history,
}: {
  stats: { completedToday: number; routesToday: number; totalIncidents: number };
  history: RouteHistoryItem[];
}) {
  return (
    <div className="space-y-5">
      {/* KPIs */}
      <section className="grid grid-cols-3 gap-2">
        {[
          { label: "Entregadas hoy", value: stats.completedToday, icon: "check-circle" as IconName, color: "text-emerald-300", bg: "from-emerald-500/15 via-emerald-500/5 to-transparent" },
          { label: "Recorridos hoy", value: stats.routesToday, icon: "truck" as IconName, color: "text-sky-300", bg: "from-sky-500/15 via-sky-500/5 to-transparent" },
          { label: "Incidencias", value: stats.totalIncidents, icon: "warning" as IconName, color: stats.totalIncidents > 0 ? "text-orange-300" : "text-zinc-400", bg: stats.totalIncidents > 0 ? "from-orange-500/15 via-orange-500/5 to-transparent" : "from-white/5 via-white/[.02] to-transparent" },
        ].map((kpi) => (
          <article
            key={kpi.label}
            className={`relative overflow-hidden rounded-2xl border border-white/[.08] bg-gradient-to-br ${kpi.bg} p-4 shadow-lg`}
          >
            <div className="flex items-start justify-between">
              <p className="text-[10px] font-black uppercase tracking-[.16em] text-zinc-500">{kpi.label}</p>
              <Icon name={kpi.icon} className={`h-4 w-4 ${kpi.color}`} />
            </div>
            <p className={`mt-3 text-3xl font-black tracking-tight ${kpi.color}`}>
              <NumberFlow value={kpi.value} />
            </p>
          </article>
        ))}
      </section>

      {/* History list */}
      <section>
        <h2 className="mb-3 text-lg font-black text-white">Mis recorridos</h2>
        {history.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/10 bg-white/[.015] p-8 text-center">
            <Icon name="truck" className="mx-auto h-6 w-6 text-zinc-600" />
            <p className="mt-2 text-sm text-zinc-500">Aún no tenés recorridos finalizados.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((route) => {
              const meta = routeStatusMeta(route.status);
              return (
                <article
                  key={route.id}
                  className="flex items-center gap-4 rounded-2xl border border-white/[.06] bg-zinc-900/60 p-4 transition hover:border-white/[.12]"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${meta.badge}`}>
                        {meta.label}
                      </span>
                      <span className="text-xs text-zinc-500">{formatDate(route.createdAt)}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-4 text-xs text-zinc-400">
                      <span>{route.completedStops}/{route.totalStops} entregas</span>
                      {route.totalDurationS != null && <span>{formatDuration(route.totalDurationS)}</span>}
                      {route.totalDistanceM != null && <span>{formatDistance(route.totalDistanceM)}</span>}
                      {route.incidentCount > 0 && (
                        <span className="text-orange-300">{route.incidentCount} incidencia{route.incidentCount === 1 ? "" : "s"}</span>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
