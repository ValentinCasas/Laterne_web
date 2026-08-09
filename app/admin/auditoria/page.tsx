import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** @summary Convierte una captura de auditoría en JSON legible sin alterar su contenido. */
function formatAuditValue(value: unknown) {
  return JSON.stringify(value, null, 2);
}

/** @summary Presenta las operaciones administrativas recientes del negocio para su revisión. */
export default async function AuditPage() {
  const context = await requirePermission("audit.read");
  const logs = await prisma.auditLog.findMany({
    where: { tenantId: context.tenant.id },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 150,
  });
  return (
    <section>
      <header className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-violet-500/15 to-zinc-950 p-6 sm:p-8">
        <p className="section-eyebrow text-violet-300">Seguridad y trazabilidad</p>
        <h1 className="mt-2 text-4xl font-black sm:text-5xl">Auditoría</h1>
        <p className="mt-3 max-w-2xl text-zinc-500">
          Últimas operaciones sensibles realizadas dentro de {context.tenant.name}.
        </p>
      </header>
      <div className="mt-6 space-y-3">
        {logs.map((log) => (
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
        {!logs.length && (
          <div className="rounded-3xl border border-dashed border-white/15 p-12 text-center text-zinc-500">
            Todavía no hay operaciones registradas.
          </div>
        )}
      </div>
    </section>
  );
}
