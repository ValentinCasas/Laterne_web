/** @summary Skeleton compartido para transiciones entre rutas administrativas. */
export default function AdminLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="Cargando sección">
      <div className="border-b border-[var(--admin-border)] pb-6">
        <div className="admin-skeleton h-3 w-24 rounded" />
        <div className="admin-skeleton mt-3 h-8 w-64 max-w-full rounded-lg" />
        <div className="admin-skeleton mt-3 h-4 w-[32rem] max-w-full rounded" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5"
          >
            <div className="admin-skeleton h-3 w-28 rounded" />
            <div className="admin-skeleton mt-4 h-8 w-20 rounded" />
            <div className="admin-skeleton mt-3 h-3 w-36 rounded" />
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="flex gap-3 border-b border-[var(--admin-border)] p-3">
          <div className="admin-skeleton h-9 flex-1 rounded-lg" />
          <div className="admin-skeleton h-9 w-28 rounded-lg" />
        </div>
        <div className="space-y-px">
          {Array.from({ length: 7 }, (_, index) => (
            <div
              key={index}
              className="grid grid-cols-[1.5fr_1fr_.7fr] gap-4 border-b border-[var(--admin-border)] p-4 last:border-0"
            >
              <div className="admin-skeleton h-4 rounded" />
              <div className="admin-skeleton h-4 rounded" />
              <div className="admin-skeleton h-4 rounded" />
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Cargando…</span>
    </div>
  );
}
