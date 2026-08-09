import Link from "next/link";

type Metric = { eventType: string; count: number };
type ProductMetric = { id: number; name: string; views: number; additions: number };

const labels: Record<string, string> = {
  "page.view": "Vistas de páginas",
  "menu.open": "Aperturas de carta",
  "product.view": "Productos vistos",
  "product.add": "Productos agregados",
  "order.started": "Pedidos iniciados",
  "order.completed": "Pedidos confirmados",
  "reservation.completed": "Reservas recibidas",
  "model.open": "Aperturas 3D",
  "ar.started": "Activaciones AR",
  "whatsapp.click": "Clics en WhatsApp",
  "menu.search": "Búsquedas",
  "menu.search_empty": "Búsquedas sin resultado",
};

/** @summary Presenta métricas comerciales, conversión y rendimiento de productos por período. */
export function AnalyticsDashboard({
  metrics,
  products,
  days,
}: {
  metrics: Metric[];
  products: ProductMetric[];
  days: number;
}) {
  const metricMap = new Map(metrics.map((metric) => [metric.eventType, metric.count]));
  const started = metricMap.get("order.started") ?? 0;
  const completed = metricMap.get("order.completed") ?? 0;
  const conversion = started ? (completed / started) * 100 : 0;
  const maximum = Math.max(1, ...metrics.map((metric) => metric.count));
  return (
    <section>
      <header className="mb-6 flex flex-col gap-4 rounded-3xl border border-white/10 bg-zinc-950/80 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-7">
        <div>
          <p className="section-eyebrow">Información para decidir</p>
          <h1 className="mt-2 text-3xl font-black sm:text-5xl">Analítica</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Datos propios y anónimos; no dependen de servicios de terceros.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[7, 30, 90].map((value) => (
            <Link
              className={`rounded-xl border px-4 py-2 text-sm font-bold ${days === value ? "border-pink-500 bg-pink-500/15" : "border-white/10"}`}
              href={`/admin/estadisticas?days=${value}`}
              key={value}
            >
              {value} días
            </Link>
          ))}
          <a className="btn btn-secondary" href={`/api/admin/analytics/export?days=${days}`}>
            Exportar CSV
          </a>
        </div>
      </header>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="card p-5">
          <p className="text-sm text-zinc-500">Aperturas de carta</p>
          <strong className="mt-2 block text-3xl">{metricMap.get("menu.open") ?? 0}</strong>
        </article>
        <article className="card p-5">
          <p className="text-sm text-zinc-500">Pedidos confirmados</p>
          <strong className="mt-2 block text-3xl">{completed}</strong>
        </article>
        <article className="card p-5">
          <p className="text-sm text-zinc-500">Conversión estimada</p>
          <strong className="mt-2 block text-3xl">{conversion.toFixed(1)}%</strong>
        </article>
        <article className="card p-5">
          <p className="text-sm text-zinc-500">Experiencias AR</p>
          <strong className="mt-2 block text-3xl">{metricMap.get("ar.started") ?? 0}</strong>
        </article>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card p-5 sm:p-7">
          <h2 className="text-2xl font-black">Actividad</h2>
          <div className="mt-5 space-y-4">
            {metrics.map((metric) => (
              <div key={metric.eventType}>
                <div className="mb-1 flex justify-between gap-3 text-sm">
                  <span>{labels[metric.eventType] ?? metric.eventType}</span>
                  <strong>{metric.count}</strong>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/5">
                  <span
                    className="block h-full rounded-full bg-pink-500"
                    style={{ width: `${Math.max(2, (metric.count / maximum) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
            {!metrics.length && <p className="text-zinc-500">Todavía no hay actividad en este período.</p>}
          </div>
        </section>
        <section className="card p-5 sm:p-7">
          <h2 className="text-2xl font-black">Productos con más interacción</h2>
          <div className="mt-5 space-y-3">
            {products.map((product, index) => (
              <article
                className="grid grid-cols-[32px_1fr_auto] items-center gap-3 rounded-2xl bg-white/5 p-3"
                key={product.id}
              >
                <span className="text-center text-sm font-black text-pink-300">{index + 1}</span>
                <div>
                  <strong>{product.name}</strong>
                  <p className="text-xs text-zinc-500">{product.views} vistas</p>
                </div>
                <span className="text-sm font-bold">+{product.additions}</span>
              </article>
            ))}
            {!products.length && (
              <p className="text-zinc-500">Los productos aparecerán cuando reciban vistas.</p>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
