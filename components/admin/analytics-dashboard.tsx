"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/admin/ui";
import { adminHrefFromPathname, scopedApiPath } from "@/lib/routes";

type Metric = { eventType: string; count: number };
type ProductMetric = { id: number; name: string; views: number; additions: number };
type Operations = {
  orders: number;
  previousOrders: number;
  revenue: number;
  previousRevenue: number;
  averageTicket: number;
  reservations: number;
  orderStatus: { status: string; count: number }[];
  currency: string;
  locale: string;
};
type ActivityBreakdown = {
  devices: { name: string; count: number }[];
  hours: { hour: number; count: number }[];
  categories: { name: string; count: number }[];
};

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
  operations,
  activity,
}: {
  metrics: Metric[];
  products: ProductMetric[];
  days: number;
  operations: Operations;
  activity: ActivityBreakdown;
}) {
  const pathname = usePathname();
  const metricMap = new Map(metrics.map((metric) => [metric.eventType, metric.count]));
  const started = metricMap.get("order.started") ?? 0;
  const completed = metricMap.get("order.completed") ?? 0;
  const conversion = started ? (completed / started) * 100 : 0;
  const maximum = Math.max(1, ...metrics.map((metric) => metric.count));
  const orderChange = operations.previousOrders
    ? ((operations.orders - operations.previousOrders) / operations.previousOrders) * 100
    : operations.orders
      ? 100
      : 0;
  const revenueChange = operations.previousRevenue
    ? ((operations.revenue - operations.previousRevenue) / operations.previousRevenue) * 100
    : operations.revenue
      ? 100
      : 0;
  const currency = new Intl.NumberFormat(operations.locale, {
    style: "currency",
    currency: operations.currency,
    maximumFractionDigits: 0,
  });
  return (
    <section>
      <PageHeader
        eyebrow="Información para decidir"
        title="Analítica"
        description="Datos propios y anónimos; no dependen de servicios de terceros."
        section="estadisticas"
        actions={
          <div className="flex flex-wrap gap-2">
            {[7, 30, 90].map((value) => (
              <Link
                className={`rounded-xl border px-4 py-2 text-sm font-bold ${days === value ? "border-pink-500 bg-pink-500/15" : "border-white/10"}`}
                href={adminHrefFromPathname(pathname, `/admin/estadisticas?days=${value}`)}
                key={value}
              >
                {value} días
              </Link>
            ))}
            <a
              className="btn btn-secondary"
              href={scopedApiPath(pathname, `/api/admin/analytics/export?days=${days}`)}
            >
              Exportar CSV
            </a>
          </div>
        }
      />
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
      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="card p-5">
          <p className="text-sm text-zinc-500">Ventas registradas</p>
          <strong className="mt-2 block text-3xl">{currency.format(operations.revenue)}</strong>
          <small className={revenueChange >= 0 ? "text-emerald-300" : "text-red-300"}>
            {revenueChange >= 0 ? "+" : ""}
            {revenueChange.toFixed(1)}% contra el período anterior
          </small>
        </article>
        <article className="card p-5">
          <p className="text-sm text-zinc-500">Pedidos almacenados</p>
          <strong className="mt-2 block text-3xl">{operations.orders}</strong>
          <small className={orderChange >= 0 ? "text-emerald-300" : "text-red-300"}>
            {orderChange >= 0 ? "+" : ""}
            {orderChange.toFixed(1)}% contra el período anterior
          </small>
        </article>
        <article className="card p-5">
          <p className="text-sm text-zinc-500">Ticket promedio</p>
          <strong className="mt-2 block text-3xl">{currency.format(operations.averageTicket)}</strong>
        </article>
        <article className="card p-5">
          <p className="text-sm text-zinc-500">Reservas recibidas</p>
          <strong className="mt-2 block text-3xl">{operations.reservations}</strong>
        </article>
      </section>
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
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <section className="card p-5 sm:p-7">
          <h2 className="text-xl font-black">Estados de pedidos</h2>
          <div className="mt-4 space-y-2">
            {operations.orderStatus.map((item) => (
              <div className="flex justify-between rounded-xl bg-white/[.04] px-4 py-3" key={item.status}>
                <span className="capitalize">{item.status.replaceAll("_", " ")}</span>
                <strong>{item.count}</strong>
              </div>
            ))}
            {!operations.orderStatus.length && (
              <p className="text-sm text-zinc-500">Sin pedidos en el período.</p>
            )}
          </div>
        </section>
        <section className="card p-5 sm:p-7">
          <h2 className="text-xl font-black">Dispositivos</h2>
          <div className="mt-4 space-y-2">
            {activity.devices.map((item) => (
              <div className="flex justify-between rounded-xl bg-white/[.04] px-4 py-3" key={item.name}>
                <span className="capitalize">{item.name}</span>
                <strong>{item.count}</strong>
              </div>
            ))}
            {!activity.devices.length && <p className="text-sm text-zinc-500">Todavía no hay información.</p>}
          </div>
        </section>
        <section className="card p-5 sm:p-7">
          <h2 className="text-xl font-black">Horas con más actividad</h2>
          <div className="mt-4 space-y-2">
            {activity.hours.map((item) => (
              <div className="flex justify-between rounded-xl bg-white/[.04] px-4 py-3" key={item.hour}>
                <span>{String(item.hour).padStart(2, "0")}:00</span>
                <strong>{item.count}</strong>
              </div>
            ))}
            {!activity.hours.length && <p className="text-sm text-zinc-500">Todavía no hay información.</p>}
          </div>
        </section>
      </div>
      {activity.categories.length > 0 && (
        <section className="card mt-6 p-5 sm:p-7">
          <h2 className="text-xl font-black">Categorías más consultadas</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {activity.categories.map((item) => (
              <article className="rounded-2xl bg-white/[.04] p-4" key={item.name}>
                <strong>{item.name}</strong>
                <p className="mt-1 text-sm text-zinc-500">{item.count} interacciones</p>
              </article>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
