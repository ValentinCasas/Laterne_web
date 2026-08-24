"use client";

import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Icon, type IconName } from "@/components/admin/ui/icons";
import { NumberFlow } from "@/components/admin/ui/number-flow";
import { routeStatusMeta, formatDuration, formatDistance } from "@/lib/delivery-route-state";
import { formatDate } from "@/lib/date-format";

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
  branch?: { id: number; name: string } | null;
};

/** @summary Historial de recorridos del repartidor con KPIs personales, filtros, paginación y enlaces al detalle. */
export function DriverRouteHistory({
  stats,
  history,
  currentPage = 1,
  totalPages = 1,
  totalCount = 0,
  filters = { status: "all", days: "all" },
  tenantSlug,
  tenantGuid,
}: {
  stats: { completedToday: number; routesToday: number; totalIncidents: number };
  history: RouteHistoryItem[];
  currentPage?: number;
  totalPages?: number;
  totalCount?: number;
  filters?: { status: string; days: string };
  tenantSlug: string;
  tenantGuid?: string;
}) {
  const router = useRouter();

  const base = tenantGuid
    ? `/t/${tenantGuid}/${tenantSlug}/driver/recorridos`
    : `/t/${tenantSlug}/driver/recorridos`;

  const buildUrl = (params: Record<string, string>): Route => {
    const search = new URLSearchParams();
    if (params.status && params.status !== "all") search.set("status", params.status);
    if (params.days && params.days !== "all") search.set("days", params.days);
    if (params.page && params.page !== "1") search.set("page", params.page);
    const qs = search.toString();
    return qs ? `${base}?${qs}` as Route : base as Route;
  };

  const detailUrl = (id: number): Route => {
    const prefix = tenantGuid ? `/t/${tenantGuid}/${tenantSlug}` : `/t/${tenantSlug}`;
    return `${prefix}/driver/recorridos/${id}` as Route;
  };

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

      {/* Filtros */}
      <section className="rounded-2xl border border-white/[.08] bg-zinc-900/60 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Período</span>
          {[
            { key: "all", label: "Todos" },
            { key: "today", label: "Hoy" },
            { key: "7", label: "7 días" },
            { key: "30", label: "30 días" },
          ].map((d) => (
            <button
              key={d.key}
              type="button"
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                filters.days === d.key
                  ? "bg-white/10 text-white"
                  : "bg-white/5 text-zinc-500 hover:bg-white/[.08] hover:text-zinc-300"
              }`}
              onClick={() => router.push(buildUrl({ status: filters.status, days: d.key }))}
            >
              {d.label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Estado</span>
          {[
            { key: "all", label: "Todos" },
            { key: "completed", label: "Completados" },
            { key: "cancelled", label: "Cancelados" },
            { key: "incidents", label: "Con incidencias" },
          ].map((s) => (
            <button
              key={s.key}
              type="button"
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                filters.status === s.key
                  ? "bg-white/10 text-white"
                  : "bg-white/5 text-zinc-500 hover:bg-white/[.08] hover:text-zinc-300"
              }`}
              onClick={() => router.push(buildUrl({ status: s.key, days: filters.days }))}
            >
              {s.label}
            </button>
          ))}
        </div>
      </section>

      {/* History list */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-black text-white">Mis recorridos</h2>
          <span className="text-xs text-zinc-500">{totalCount} total</span>
        </div>
        {history.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/10 bg-white/[.015] p-8 text-center">
            <Icon name="truck" className="mx-auto h-6 w-6 text-zinc-600" />
            <p className="mt-2 text-sm text-zinc-500">No tenés recorridos que coincidan con los filtros.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((route) => {
              const meta = routeStatusMeta(route.status);
              const duration = route.startedAt && (route.completedAt || route.cancelledAt)
                ? Math.round(((new Date(route.completedAt ?? route.cancelledAt!)).getTime() - new Date(route.startedAt).getTime()) / 1000)
                : route.totalDurationS ?? null;
              return (
                <button
                  key={route.id}
                  type="button"
                  className="w-full text-left flex items-center gap-4 rounded-2xl border border-white/[.06] bg-zinc-900/60 p-4 transition hover:border-white/[.12] hover:bg-zinc-900/80"
                  onClick={() => router.push(detailUrl(route.id))}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${meta.badge}`}>
                        {meta.label}
                      </span>
                      <span className="text-xs font-bold text-zinc-400">Recorrido #{route.id}</span>
                    </div>
                    <p className="mt-1 text-sm font-bold text-white">{formatDate(route.createdAt)}</p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
                      <span>{route.completedStops}/{route.totalStops} entregas</span>
                      {duration != null && <span>{formatDuration(duration)}</span>}
                      {route.totalDistanceM != null && <span>{formatDistance(route.totalDistanceM)}</span>}
                      {route.incidentCount > 0 && (
                        <span className="text-orange-300">{route.incidentCount} incidencia{route.incidentCount === 1 ? "" : "s"}</span>
                      )}
                      {route.branch && <span className="text-zinc-500">{route.branch.name}</span>}
                    </div>
                  </div>
                  <Icon name="arrow-right" className="h-4 w-4 shrink-0 text-zinc-600" />
                </button>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              type="button"
              className="rounded-xl bg-white/5 px-3 py-2 text-xs font-bold text-zinc-400 transition hover:bg-white/10 disabled:opacity-40"
              disabled={currentPage <= 1}
              onClick={() => router.push(buildUrl({ status: filters.status, days: filters.days, page: String(currentPage - 1) }))}
            >
              Anterior
            </button>
            <span className="text-xs text-zinc-500">
              Página {currentPage} de {totalPages}
            </span>
            <button
              type="button"
              className="rounded-xl bg-white/5 px-3 py-2 text-xs font-bold text-zinc-400 transition hover:bg-white/10 disabled:opacity-40"
              disabled={currentPage >= totalPages}
              onClick={() => router.push(buildUrl({ status: filters.status, days: filters.days, page: String(currentPage + 1) }))}
            >
              Siguiente
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
