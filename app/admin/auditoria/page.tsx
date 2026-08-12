import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { requirePermission } from "@/lib/auth";
import { activeBranchWhere } from "@/lib/branch";
import { prisma } from "@/lib/prisma";
import { adminHrefForContext } from "@/lib/routes";

const AUDIT_PAGE_SIZE = 50;

/** @summary Convierte una captura de auditoría en JSON legible sin alterar su contenido. */
function formatAuditValue(value: unknown) {
  return JSON.stringify(value, null, 2);
}

/** @summary Presenta las operaciones administrativas del negocio paginadas para su revisión. */
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const context = await requirePermission("audit.read");
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const auditFilter = activeBranchWhere(context.tenant.id, context.activeBranchId);
  const activeBranch = context.activeBranchId && context.activeBranchId > 0
    ? context.branches.find((branch) => branch.id === context.activeBranchId)
    : undefined;
  const auditHref = (targetPage: number) => `${adminHrefForContext(context.tenant.slug, "/admin/auditoria", activeBranch?.slug)}?page=${targetPage}`;
  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: auditFilter,
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * AUDIT_PAGE_SIZE,
      take: AUDIT_PAGE_SIZE + 1,
    }),
    prisma.auditLog.count({ where: auditFilter }),
  ]);
  const hasMore = logs.length > AUDIT_PAGE_SIZE;
  const visibleLogs = logs.slice(0, AUDIT_PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));

  return (
    <section>
      <AdminPageHeader
        eyebrow="Seguridad y trazabilidad"
        title="Auditoría"
        description={`Quién realizó cambios importantes y cuándo, dentro de ${context.tenant.name}.`}
        section="auditoria"
      />
      <div className="mt-6 space-y-3">
        {visibleLogs.map((log) => (
          <article
            className="grid gap-3 rounded-2xl border border-white/10 bg-zinc-950 p-4 sm:grid-cols-[170px_1fr_auto] sm:items-center"
            key={log.id.toString()}
          >
            <div>
              <time className="text-sm font-bold">{log.createdAt.toLocaleString("es-AR")}</time>
              <p className="text-xs text-zinc-600">{log.ipAddress ?? "Sin IP registrada"}</p>
            </div>
            <div>
              <p className="font-black">
                <span className="text-pink-300">{log.action}</span> · {log.entityType}
                {log.entityId ? ` #${log.entityId}` : ""}
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                {log.user ? `${log.user.name} · ${log.user.email}` : "Usuario eliminado o sistema"}
              </p>
            </div>
            <span
              className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${log.result === "success" ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"}`}
            >
              {log.result === "success" ? "Correcto" : log.result}
            </span>
            {(log.oldValues !== null || log.newValues !== null) && (
              <details className="rounded-xl border border-white/10 bg-black/30 p-3 sm:col-span-3">
                <summary className="cursor-pointer text-sm font-black text-zinc-300">
                  Ver valores anteriores y nuevos
                </summary>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <section>
                    <h3 className="text-xs font-black uppercase tracking-wider text-zinc-500">
                      Valor anterior
                    </h3>
                    <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-black p-3 text-xs text-zinc-400">
                      {formatAuditValue(log.oldValues) ?? "Sin valor anterior"}
                    </pre>
                  </section>
                  <section>
                    <h3 className="text-xs font-black uppercase tracking-wider text-zinc-500">Valor nuevo</h3>
                    <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-black p-3 text-xs text-zinc-400">
                      {formatAuditValue(log.newValues) ?? "Sin valor nuevo"}
                    </pre>
                  </section>
                </div>
              </details>
            )}
          </article>
        ))}
        {!visibleLogs.length && (
          <div className="rounded-3xl border border-dashed border-white/15 p-12 text-center text-zinc-500">
            Todavía no hay operaciones registradas.
          </div>
        )}
      </div>
      <nav className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-500">
        <p>
          Página {page} de {totalPages} · {total} operaciones
        </p>
        <div className="flex gap-3">
          {page > 1 && (
            <Link className="btn btn-secondary" href={auditHref(page - 1)}>
              ← Anterior
            </Link>
          )}
          {hasMore && (
            <Link className="btn btn-secondary" href={auditHref(page + 1)}>
              Siguiente →
            </Link>
          )}
        </div>
      </nav>
    </section>
  );
}
