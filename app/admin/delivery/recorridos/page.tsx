import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/format";
import { PageHeader } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

/** @summary Historial de recorridos de repartidores para administradores. */
export default async function AdminRouteHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; branch?: string; driver?: string }>;
}) {
  const context = await requirePermission("admin.access");
  const params = await searchParams;

  // Get accessible branch IDs
  const accessibleBranchIds = context.allBranches ? null : context.branches.map((b: { id: number }) => b.id);

  const page = Math.max(1, Number(params.page) || 1);
  const statusFilter = params.status || "all";
  const branchFilter = params.branch ? Number(params.branch) : null;
  const driverFilter = params.driver ? Number(params.driver) : null;

  // Build where clause with tenant + branch scoping
  const where: Record<string, unknown> = {
    tenantId: context.tenant.id,
  };

  if (accessibleBranchIds) {
    where.branchId = { in: accessibleBranchIds };
  }
  if (branchFilter) {
    where.branchId = branchFilter;
  }

  if (statusFilter === "completed") {
    where.status = "COMPLETED";
  } else if (statusFilter === "cancelled") {
    where.status = "CANCELLED";
  } else if (statusFilter === "in_progress") {
    where.status = "IN_PROGRESS";
  } else if (statusFilter === "preparing") {
    where.status = "PREPARING";
  } else {
    where.status = { in: ["COMPLETED", "CANCELLED", "IN_PROGRESS", "PREPARING"] };
  }

  if (driverFilter) {
    where.driverProfileId = driverFilter;
  }

  const pageSize = 25;
  const [total, routes] = await Promise.all([
    prisma.deliveryRoute.count({ where }),
    prisma.deliveryRoute.findMany({
      where,
      select: {
        id: true,
        status: true,
        startedAt: true,
        completedAt: true,
        cancelledAt: true,
        totalStops: true,
        completedStops: true,
        incidentCount: true,
        totalDistanceM: true,
        totalDurationS: true,
        createdAt: true,
        branch: { select: { id: true, name: true } },
        driver: { select: { id: true, name: true, userId: true } },
      },
      orderBy: { createdAt: "desc" as const },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-5">
      <PageHeader
        section="Delivery"
        title="Recorridos"
        description="Historial de recorridos de repartidores"
      />

      {/* Filters */}
      <div className="rounded-2xl border border-white/[.08] bg-zinc-900/60 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Estado</span>
          {[
            { key: "all", label: "Todos" },
            { key: "in_progress", label: "En curso" },
            { key: "preparing", label: "Preparando" },
            { key: "completed", label: "Completados" },
            { key: "cancelled", label: "Cancelados" },
          ].map((s) => (
            <a
              key={s.key}
              href={`/admin/delivery/recorridos?status=${s.key}${branchFilter ? `&branch=${branchFilter}` : ""}${driverFilter ? `&driver=${driverFilter}` : ""}`}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                statusFilter === s.key
                  ? "bg-white/10 text-white"
                  : "bg-white/5 text-zinc-500 hover:bg-white/[.08] hover:text-zinc-300"
              }`}
            >
              {s.label}
            </a>
          ))}
        </div>
      </div>

      {/* Routes table */}
      {routes.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/10 bg-white/[.015] p-8 text-center">
          <p className="text-sm text-zinc-500">No hay recorridos que coincidan con los filtros.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/[.08] bg-zinc-900/60">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/5 text-[10px] font-black uppercase tracking-wider text-zinc-500">
                  <th className="px-4 py-3">Recorrido</th>
                  <th className="px-4 py-3">Repartidor</th>
                  <th className="px-4 py-3">Sucursal</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Paradas</th>
                  <th className="px-4 py-3">Duración</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {serialize(routes).map((route: { id: number; status: string; createdAt: string | Date; totalStops: number; completedStops: number; incidentCount: number; totalDurationS?: number | null; branch?: { name: string } | null; driver?: { name: string } | null }) => (
                  <tr key={route.id} className="transition hover:bg-white/[.02]">
                    <td className="px-4 py-3 font-bold text-white">#{route.id}</td>
                    <td className="px-4 py-3 text-zinc-300">{route.driver?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-zinc-400">{route.branch?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-zinc-400">{new Date(route.createdAt).toLocaleDateString("es-AR")}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${routeStatusMeta(route.status).badge}`}>
                        {routeStatusMeta(route.status).label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-300">{route.completedStops}/{route.totalStops}</td>
                    <td className="px-4 py-3 text-zinc-400">{route.totalDurationS != null ? formatDuration(route.totalDurationS) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <a
              href={`/admin/delivery/recorridos?page=${page - 1}${statusFilter !== "all" ? `&status=${statusFilter}` : ""}`}
              className="rounded-xl bg-white/5 px-3 py-2 text-xs font-bold text-zinc-400 transition hover:bg-white/10"
            >
              Anterior
            </a>
          )}
          <span className="text-xs text-zinc-500">
            Página {page} de {totalPages}
          </span>
          {page < totalPages && (
            <a
              href={`/admin/delivery/recorridos?page=${page + 1}${statusFilter !== "all" ? `&status=${statusFilter}` : ""}`}
              className="rounded-xl bg-white/5 px-3 py-2 text-xs font-bold text-zinc-400 transition hover:bg-white/10"
            >
              Siguiente
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function routeStatusMeta(status: string) {
  const map: Record<string, { label: string; badge: string }> = {
    PREPARING: { label: "Preparando", badge: "bg-zinc-500/15 text-zinc-300" },
    IN_PROGRESS: { label: "En curso", badge: "bg-sky-500/15 text-sky-300" },
    COMPLETED: { label: "Completado", badge: "bg-emerald-500/15 text-emerald-300" },
    CANCELLED: { label: "Cancelado", badge: "bg-red-500/15 text-red-300" },
  };
  return map[status] ?? { label: status, badge: "bg-zinc-500/15 text-zinc-300" };
}

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m} min`;
  return `${h} h ${m} min`;
}
