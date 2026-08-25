import type { Route } from "next";
import Link from "next/link";
import { AnimatedProgress, KpiCard, NumberFlow, PageHeader } from "@/components/admin/ui";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { activeBranchWhere, branchProductWhere } from "@/lib/branch";
import { adminHrefForContext } from "@/lib/routes";
import { safeQuery } from "@/lib/safe-query";

export const dynamic = "force-dynamic";

const statStyles = [
  "from-pink-500/25 to-pink-950/10 text-pink-300",
  "from-amber-500/25 to-amber-950/10 text-amber-300",
  "from-violet-500/25 to-violet-950/10 text-violet-300",
  "from-emerald-500/25 to-emerald-950/10 text-emerald-300",
  "from-sky-500/25 to-sky-950/10 text-sky-300",
] as const;

const SOLD_STATUSES = ["confirmed", "ready", "delivered", "completed"];

const STATUS_LABELS: Record<string, string> = {
  received: "Recibidos",
  confirmed: "Confirmados",
  preparing: "En preparación",
  ready: "Listos",
  delivered: "Entregados",
  completed: "Completados",
  cancelled: "Cancelados",
  paid: "Pagados",
};

const CHANNEL_LABELS: Record<string, string> = {
  DELIVERY: "Delivery",
  TAKEAWAY: "Takeaway",
  DINE_IN: "Salón",
  TABLE: "Mesa",
  WEB: "Web",
  WHATSAPP: "WhatsApp",
  COUNTER: "Mostrador",
  APP: "App",
};

function labelFor(map: Record<string, string>, value: string) {
  return (
    map[value] ??
    value
      .replaceAll("_", " ")
      .toLocaleLowerCase("es")
      .replace(/^\w/, (c) => c.toLocaleUpperCase("es"))
  );
}

function money(value: number, currency = "ARS") {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 0 }).format(
    value,
  );
}

function pctDelta(current: number, previous: number) {
  if (!previous) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

/** @summary Muestra indicadores, accesos rápidos y actividad reciente del negocio. */
export default async function Dashboard() {
  const context = await requirePermission("admin.access");
  const tenantId = context.tenant.id;
  const activeBranch =
    context.activeBranchId && context.activeBranchId > 0
      ? context.branches.find((branch) => branch.id === context.activeBranchId)
      : undefined;
  const adminHref = (href: string) =>
    adminHrefForContext(context.tenant.slug, href, activeBranch?.slug, context.tenant.publicGuid) as Route;
  const branchFilter = activeBranchWhere(tenantId, context.activeBranchId);
  const productFilter = branchProductWhere(tenantId, context.activeBranchId);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(startOfToday);
  yesterdayStart.setDate(startOfToday.getDate() - 1);
  const periodStart = new Date(now);
  periodStart.setDate(now.getDate() - 30);
  const prevPeriodStart = new Date(now);
  prevPeriodStart.setDate(now.getDate() - 60);

  const logCtx = { tenantId, module: "admin.dashboard" };

  // ── Catálogo y contenido (opcionales) ──
  const [products, categories, events, pendingTestimonials, incompleteProducts] = await Promise.allSettled([
    safeQuery({ name: "product.count", fallback: 0, context: logCtx, query: () => prisma.product.count({ where: productFilter }) }),
    safeQuery({ name: "category.count", fallback: 0, context: logCtx, query: () => prisma.category.count({ where: branchFilter }) }),
    safeQuery({ name: "event.count", fallback: 0, context: logCtx, query: () => prisma.event.count({ where: branchFilter }) }),
    safeQuery({ name: "testimonial.pendingCount", fallback: 0, context: logCtx, query: () => prisma.testimonial.count({ where: { ...branchFilter, moderationStatus: "pending" } }) }),
    safeQuery({ name: "product.incompleteCount", fallback: 0, context: logCtx, query: () => prisma.product.count({ where: { ...productFilter, OR: [{ price: null }, { imageUrl: "product_default.png" }, { categories: { none: {} } }] } }) }),
  ]);

  // ── KPIs de operación (opcionales) ──
  const [pendingOrders, pendingReservations, lowStock] = await Promise.allSettled([
    safeQuery({ name: "customerOrder.pendingCount", fallback: 0, context: logCtx, query: () => context.permissions.includes("order.manage") ? prisma.customerOrder.count({ where: { ...branchFilter, status: { in: ["received", "confirmed", "preparing", "ready"] } } }) : Promise.resolve(0) }),
    safeQuery({ name: "reservation.pendingCount", fallback: 0, context: logCtx, query: () => context.permissions.includes("reservation.manage") ? prisma.reservation.count({ where: { ...branchFilter, status: "pending" } }) : Promise.resolve(0) }),
    safeQuery({ name: "inventoryStock.lowCount", fallback: 0, context: logCtx, query: () => context.permissions.includes("product.manage") ? prisma.inventoryStock.count({ where: { tenantId, ...(context.activeBranchId && context.activeBranchId > 0 ? { branchId: context.activeBranchId } : {}), tracked: true, current: { lte: prisma.inventoryStock.fields.minimum } } }) : Promise.resolve(0) }),
  ]);

  // ── Contenido reciente (opcional) ──
  const [recentEvents, recentTestimonials, users, branches, files, subscription] = await Promise.allSettled([
    safeQuery({ name: "event.findMany", fallback: [], context: logCtx, query: () => prisma.event.findMany({ where: branchFilter, orderBy: [{ date: "desc" }, { id: "desc" }], take: 3 }) }),
    safeQuery({ name: "testimonial.findMany", fallback: [], context: logCtx, query: () => prisma.testimonial.findMany({ where: branchFilter, orderBy: { id: "desc" }, take: 3 }) }),
    safeQuery({ name: "tenantMembership.count", fallback: 0, context: logCtx, query: () => prisma.tenantMembership.count({ where: { tenantId, status: "active" } }) }),
    safeQuery({ name: "branch.count", fallback: 0, context: logCtx, query: () => prisma.branch.count({ where: { tenantId, active: true } }) }),
    safeQuery({ name: "mediaAsset.aggregate", fallback: { _sum: { sizeBytes: null } }, context: logCtx, query: () => prisma.mediaAsset.aggregate({ where: { tenantId }, _sum: { sizeBytes: true } }) }),
    safeQuery({ name: "tenantSubscription.findUnique", fallback: null, context: logCtx, query: () => prisma.tenantSubscription.findUnique({ where: { tenantId }, select: { status: true, endsAt: true } }) }),
  ]);

  // ── Ventas y analytics (opcionales) ──
  const [salesTodayAgg, salesYesterdayAgg, salesPeriodAgg, prevSalesPeriodAgg, ordersPeriodCount, avgTicketAgg, ordersByStatus, ordersByChannel, topItems] = await Promise.allSettled([
    safeQuery({ name: "sales.today", fallback: { _sum: { total: null } }, context: logCtx, query: () => prisma.customerOrder.aggregate({ where: { ...branchFilter, status: { in: SOLD_STATUSES }, createdAt: { gte: startOfToday } }, _sum: { total: true } }) }),
    safeQuery({ name: "sales.yesterday", fallback: { _sum: { total: null } }, context: logCtx, query: () => prisma.customerOrder.aggregate({ where: { ...branchFilter, status: { in: SOLD_STATUSES }, createdAt: { gte: yesterdayStart, lt: startOfToday } }, _sum: { total: true } }) }),
    safeQuery({ name: "sales.period", fallback: { _sum: { total: null } }, context: logCtx, query: () => prisma.customerOrder.aggregate({ where: { ...branchFilter, status: { in: SOLD_STATUSES }, createdAt: { gte: periodStart } }, _sum: { total: true } }) }),
    safeQuery({ name: "sales.prevPeriod", fallback: { _sum: { total: null } }, context: logCtx, query: () => prisma.customerOrder.aggregate({ where: { ...branchFilter, status: { in: SOLD_STATUSES }, createdAt: { gte: prevPeriodStart, lt: periodStart } }, _sum: { total: true } }) }),
    safeQuery({ name: "orders.periodCount", fallback: 0, context: logCtx, query: () => prisma.customerOrder.count({ where: { ...branchFilter, createdAt: { gte: periodStart } } }) }),
    safeQuery({ name: "orders.avgTicket", fallback: { _avg: { total: null } }, context: logCtx, query: () => prisma.customerOrder.aggregate({ where: { ...branchFilter, status: { in: SOLD_STATUSES }, createdAt: { gte: periodStart } }, _avg: { total: true } }) }),
    safeQuery({ name: "orders.byStatus", fallback: [], context: logCtx, query: () => prisma.customerOrder.groupBy({ by: ["status"], where: { ...branchFilter, createdAt: { gte: periodStart } }, _count: { _all: true } }) }),
    safeQuery({ name: "orders.byChannel", fallback: [], context: logCtx, query: () => prisma.customerOrder.groupBy({ by: ["channel"], where: { ...branchFilter, createdAt: { gte: periodStart } }, _count: { _all: true } }) }),
    safeQuery({ name: "orderItems.topProducts", fallback: [], context: logCtx, query: () => prisma.orderItem.groupBy({ by: ["productId"], where: { order: { ...branchFilter, createdAt: { gte: periodStart } } }, _sum: { quantity: true }, orderBy: { _sum: { quantity: "desc" } }, take: 5 }) }),
  ]);

  // ── Reservas, mesas, compras, gastos (opcionales) ──
  const [reservationsUpcoming, tablesInUse, pendingPurchases, pendingPayablesAgg, recentExpenses] = await Promise.allSettled([
    safeQuery({ name: "reservation.upcomingCount", fallback: 0, context: logCtx, query: () => prisma.reservation.count({ where: { ...branchFilter, reservationDate: { gte: startOfToday }, status: { in: ["pending", "confirmed"] } } }) }),
    safeQuery({ name: "tableSession.activeCount", fallback: 0, context: logCtx, query: () => prisma.tableSession.count({ where: { tenantId, ...(context.activeBranchId ? { branchId: context.activeBranchId } : {}), closedAt: null } }) }),
    safeQuery({ name: "purchaseOrder.pendingCount", fallback: 0, context: logCtx, query: () => prisma.purchaseOrder.count({ where: { tenantId, ...(context.activeBranchId ? { branchId: context.activeBranchId } : {}), status: { in: ["draft", "sent", "partial"] } } }) }),
    safeQuery({ name: "expense.pendingAgg", fallback: { _sum: { total: null, paidAmount: null } }, context: logCtx, query: () => prisma.expense.aggregate({ where: { tenantId, ...(context.activeBranchId ? { branchId: context.activeBranchId } : {}), status: { not: "paid" } }, _sum: { total: true, paidAmount: true } }) }),
    safeQuery({ name: "expense.findMany", fallback: [], context: logCtx, query: () => prisma.expense.findMany({ where: { tenantId, ...(context.activeBranchId ? { branchId: context.activeBranchId } : {}) }, orderBy: { createdAt: "desc" }, take: 4, select: { number: true, total: true, expenseDate: true, status: true, supplier: { select: { name: true } } } }) }),
  ]);

  const productsVal = products.status === "fulfilled" ? products.value : 0;
  const categoriesVal = categories.status === "fulfilled" ? categories.value : 0;
  const eventsVal = events.status === "fulfilled" ? events.value : 0;
  const pendingTestimonialsVal = pendingTestimonials.status === "fulfilled" ? pendingTestimonials.value : 0;
  const incompleteProductsVal = incompleteProducts.status === "fulfilled" ? incompleteProducts.value : 0;
  const pendingOrdersVal = pendingOrders.status === "fulfilled" ? pendingOrders.value : 0;
  const pendingReservationsVal = pendingReservations.status === "fulfilled" ? pendingReservations.value : 0;
  const lowStockVal = lowStock.status === "fulfilled" ? lowStock.value : 0;
  const recentEventsVal = recentEvents.status === "fulfilled" ? recentEvents.value : [];
  const recentTestimonialsVal = recentTestimonials.status === "fulfilled" ? recentTestimonials.value : [];
  const usersVal = users.status === "fulfilled" ? users.value : 0;
  const branchesVal = branches.status === "fulfilled" ? branches.value : 0;
  const filesVal = files.status === "fulfilled" ? files.value : { _sum: { sizeBytes: null } };
  const subscriptionVal = subscription.status === "fulfilled" ? subscription.value : null;
  const salesTodayAggVal = salesTodayAgg.status === "fulfilled" ? salesTodayAgg.value : { _sum: { total: null } };
  const salesYesterdayAggVal = salesYesterdayAgg.status === "fulfilled" ? salesYesterdayAgg.value : { _sum: { total: null } };
  const salesPeriodAggVal = salesPeriodAgg.status === "fulfilled" ? salesPeriodAgg.value : { _sum: { total: null } };
  const prevSalesPeriodAggVal = prevSalesPeriodAgg.status === "fulfilled" ? prevSalesPeriodAgg.value : { _sum: { total: null } };
  const ordersPeriodCountVal = ordersPeriodCount.status === "fulfilled" ? ordersPeriodCount.value : 0;
  const avgTicketAggVal = avgTicketAgg.status === "fulfilled" ? avgTicketAgg.value : { _avg: { total: null } };
  const ordersByStatusVal = ordersByStatus.status === "fulfilled" ? ordersByStatus.value : [];
  const ordersByChannelVal = ordersByChannel.status === "fulfilled" ? ordersByChannel.value : [];
  const topItemsVal = topItems.status === "fulfilled" ? topItems.value : [];
  const reservationsUpcomingVal = reservationsUpcoming.status === "fulfilled" ? reservationsUpcoming.value : 0;
  const tablesInUseVal = tablesInUse.status === "fulfilled" ? tablesInUse.value : 0;
  const pendingPurchasesVal = pendingPurchases.status === "fulfilled" ? pendingPurchases.value : 0;
  const pendingPayablesAggVal = pendingPayablesAgg.status === "fulfilled" ? pendingPayablesAgg.value : { _sum: { total: null, paidAmount: null } };
  const recentExpensesVal = recentExpenses.status === "fulfilled" ? recentExpenses.value : [];

  const salesToday = Number(salesTodayAggVal._sum.total ?? 0);
  const salesYesterday = Number(salesYesterdayAggVal._sum.total ?? 0);
  const salesPeriod = Number(salesPeriodAggVal._sum.total ?? 0);
  const prevSalesPeriod = Number(prevSalesPeriodAggVal._sum.total ?? 0);
  const avgTicket = Number(avgTicketAggVal._avg.total ?? 0);
  const pendingPayables =
    Number(pendingPayablesAggVal._sum.total ?? 0) - Number(pendingPayablesAggVal._sum.paidAmount ?? 0);

  const topProducts = topItemsVal
    .filter((item) => item.productId)
    .map((item) => ({
      id: item.productId as number,
      quantity: Number(item._sum.quantity ?? 0),
    }));
  const topNames = await prisma.product.findMany({
    where: { id: { in: topProducts.map((p) => p.id) } },
    select: { id: true, name: true },
  });
  const topNameMap = new Map(topNames.map((p) => [p.id, p.name]));
  const topProductsView = topProducts
    .map((p) => ({ label: topNameMap.get(p.id) ?? `Producto #${p.id}`, value: p.quantity }))
    .sort((a, b) => b.value - a.value);
  const topMax = Math.max(1, ...topProductsView.map((p) => p.value));

  const statusView = ordersByStatusVal
    .map((row) => ({ label: labelFor(STATUS_LABELS, row.status), value: row._count._all }))
    .sort((a, b) => b.value - a.value);
  const statusMax = Math.max(1, ...statusView.map((s) => s.value));

  const channelView = ordersByChannelVal
    .map((row) => ({ label: labelFor(CHANNEL_LABELS, row.channel), value: row._count._all }))
    .sort((a, b) => b.value - a.value);
  const channelMax = Math.max(1, ...channelView.map((c) => c.value));

  const catalogStats = [
    { label: "Productos publicados", value: productsVal, href: "/admin/productos" },
    { label: "Categorías activas", value: categoriesVal, href: "/admin/categorias" },
    { label: "Eventos cargados", value: eventsVal, href: "/admin/eventos" },
    { label: "Opiniones pendientes", value: pendingTestimonialsVal, href: "/admin/testimonios" },
    { label: "Usuarios activos", value: usersVal, href: "/admin/usuarios" },
    { label: "Sucursales activas", value: branchesVal, href: "/admin/sucursales" },
    {
      label: "Almacenamiento",
      value: `${(Number(filesVal._sum.sizeBytes ?? 0) / 1_000_000).toFixed(1)} MB`,
      href: "/admin/archivos",
    },
  ];

  const operationAlerts = [
    context.permissions.includes("order.manage") && {
      label: "Pedidos en curso",
      value: pendingOrdersVal,
      href: "/admin/pedidos",
    },
    context.permissions.includes("reservation.manage") && {
      label: "Reservas pendientes",
      value: pendingReservationsVal,
      href: "/admin/reservas",
    },
    context.permissions.includes("product.manage") && {
      label: "Alertas de stock",
      value: lowStockVal,
      href: "/admin/inventario",
    },
    context.permissions.includes("product.manage") && {
      label: "Productos incompletos",
      value: incompleteProductsVal,
      href: "/admin/productos",
    },
  ].filter(Boolean) as { label: string; value: number; href: string }[];

  const salesKpis = [
    {
      label: "Ventas de hoy",
      value: money(salesToday),
      delta: pctDelta(salesToday, salesYesterday),
      href: "/admin/pedidos",
    },
    {
      label: "Ventas (30 días)",
      value: money(salesPeriod),
      delta: pctDelta(salesPeriod, prevSalesPeriod),
      href: "/admin/pedidos",
    },
    {
      label: "Pedidos (30 días)",
      value: ordersPeriodCountVal,
      delta: null as number | null,
      href: "/admin/pedidos",
    },
    {
      label: "Ticket promedio",
      value: money(avgTicket),
      delta: null as number | null,
      href: "/admin/pedidos",
    },
  ];

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Centro de control"
        title="Tu negocio, en un solo lugar."
        description="Actualizá la carta, publicá eventos y moderá opiniones sin tocar código."
        section="resumen"
        actions={
          <>
            <Link className="btn" href={adminHref("/admin/productos")}>
              Agregar producto
            </Link>
            <Link className="btn btn-secondary" href={adminHref("/admin/eventos")}>
              Nuevo evento
            </Link>
          </>
        }
      />

      {/* Ventas y períodos */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {salesKpis.map((stat) => (
          <Link
            key={stat.label}
            className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]"
            href={adminHref(stat.href)}
          >
            <KpiCard
              label={stat.label}
              value={stat.value}
              change={stat.delta === null ? undefined : { value: stat.delta, label: "vs período previo" }}
            />
          </Link>
        ))}
      </div>

      {operationAlerts.length > 0 && (
        <section className="rounded-3xl border border-white/10 bg-zinc-950/70 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-amber-300">
                Atención operativa
              </p>
              <h2 className="mt-1 text-2xl font-black">Qué conviene revisar ahora</h2>
            </div>
            <Link className="text-sm font-bold text-pink-300" href={adminHref("/admin/notificaciones")}>
              Centro de actividad
            </Link>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {operationAlerts.map((alert) => (
              <Link
                key={alert.label}
                className="rounded-2xl bg-white/[.04] p-4 transition hover:bg-white/[.07]"
                href={adminHref(alert.href)}
              >
                <strong className="text-3xl">
                  <NumberFlow value={alert.value} />
                </strong>
                <p className="mt-1 text-sm text-zinc-400">{alert.label}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Pedidos por estado y canal */}
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-3xl border border-white/10 bg-zinc-950/70 p-5 sm:p-6">
          <h2 className="text-lg font-black">Pedidos por estado</h2>
          <p className="mt-1 text-sm text-zinc-500">Últimos 30 días.</p>
          <div className="mt-4 space-y-2.5">
            {statusView.length === 0 && <p className="text-sm text-zinc-500">Sin pedidos en el período.</p>}
            {statusView.map((row) => (
              <div key={row.label}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-zinc-300">{row.label}</span>
                  <strong>
                    <NumberFlow value={row.value} />
                  </strong>
                </div>
                <AnimatedProgress
                  label={`${row.label}: ${row.value}`}
                  value={Math.max(4, (row.value / statusMax) * 100)}
                />
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-zinc-950/70 p-5 sm:p-6">
          <h2 className="text-lg font-black">Pedidos por canal</h2>
          <p className="mt-1 text-sm text-zinc-500">Últimos 30 días.</p>
          <div className="mt-4 space-y-2.5">
            {channelView.length === 0 && <p className="text-sm text-zinc-500">Sin pedidos en el período.</p>}
            {channelView.map((row) => (
              <div key={row.label}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-zinc-300">{row.label}</span>
                  <strong>
                    <NumberFlow value={row.value} />
                  </strong>
                </div>
                <AnimatedProgress
                  label={`${row.label}: ${row.value}`}
                  tone="info"
                  value={Math.max(4, (row.value / channelMax) * 100)}
                />
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Productos y reservas/mesas */}
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-3xl border border-white/10 bg-zinc-950/70 p-5 sm:p-6">
          <h2 className="text-lg font-black">Productos más vendidos</h2>
          <p className="mt-1 text-sm text-zinc-500">Por cantidad, últimos 30 días.</p>
          <div className="mt-4 space-y-2.5">
            {topProductsView.length === 0 && (
              <p className="text-sm text-zinc-500">Sin ventas en el período.</p>
            )}
            {topProductsView.map((row, index) => (
              <div key={row.label} className="flex items-center gap-3">
                <span className="w-5 shrink-0 text-center text-sm font-black text-pink-300">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex justify-between gap-3 text-sm">
                    <span className="truncate text-zinc-300">{row.label}</span>
                    <strong className="shrink-0">
                      <NumberFlow value={row.value} />
                    </strong>
                  </div>
                  <AnimatedProgress
                    label={`${row.label}: ${row.value}`}
                    tone="info"
                    value={Math.max(4, (row.value / topMax) * 100)}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-zinc-950/70 p-5 sm:p-6">
          <h2 className="text-lg font-black">Reservas y mesas</h2>
          <p className="mt-1 text-sm text-zinc-500">Situación actual del salón.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-white/[.04] p-4">
              <p className="text-xs font-black uppercase tracking-wider text-amber-300">Reservas próximas</p>
              <strong className="mt-2 block text-3xl">
                <NumberFlow value={reservationsUpcomingVal} />
              </strong>
              <Link
                className="mt-1 inline-block text-sm font-bold text-pink-300"
                href={adminHref("/admin/reservas")}
              >
                Ver reservas
              </Link>
            </div>
            <div className="rounded-2xl bg-white/[.04] p-4">
              <p className="text-xs font-black uppercase tracking-wider text-emerald-300">Mesas ocupadas</p>
              <strong className="mt-2 block text-3xl">
                <NumberFlow value={tablesInUseVal} />
              </strong>
              <Link
                className="mt-1 inline-block text-sm font-bold text-pink-300"
                href={adminHref("/admin/salon")}
              >
                Ir al salón
              </Link>
            </div>
          </div>
        </section>
      </div>

      {/* Compras y gastos */}
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-3xl border border-white/10 bg-zinc-950/70 p-5 sm:p-6">
          <h2 className="text-lg font-black">Compras y cuentas</h2>
          <p className="mt-1 text-sm text-zinc-500">Pendientes de tu negocio.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-white/[.04] p-4">
              <p className="text-xs font-black uppercase tracking-wider text-sky-300">Compras pendientes</p>
              <strong className="mt-2 block text-3xl">
                <NumberFlow value={pendingPurchasesVal} />
              </strong>
              <Link
                className="mt-1 inline-block text-sm font-bold text-pink-300"
                href={adminHref("/admin/compras")}
              >
                Ver compras
              </Link>
            </div>
            <div className="rounded-2xl bg-white/[.04] p-4">
              <p className="text-xs font-black uppercase tracking-wider text-rose-300">Cuentas por pagar</p>
              <strong className="mt-2 block text-3xl">{money(pendingPayables)}</strong>
              <Link
                className="mt-1 inline-block text-sm font-bold text-pink-300"
                href={adminHref("/admin/gastos")}
              >
                Ver gastos
              </Link>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-zinc-950/70 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-black">Gastos recientes</h2>
            <Link className="text-sm font-bold text-pink-300" href={adminHref("/admin/gastos")}>
              Ver todos
            </Link>
          </div>
          <div className="mt-4 space-y-2">
            {recentExpensesVal.length === 0 && <p className="text-sm text-zinc-500">Sin gastos registrados.</p>}
            {recentExpensesVal.map((expense) => (
              <div
                key={expense.number}
                className="flex items-center justify-between gap-3 rounded-xl bg-white/[.04] px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{expense.supplier?.name ?? "Gasto"}</p>
                  <p className="text-xs text-zinc-500">
                    {expense.number} · {new Date(expense.expenseDate).toLocaleDateString("es-AR")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-black uppercase text-zinc-400">
                    {expense.status}
                  </span>
                  <strong className="tabular-nums">{money(Number(expense.total))}</strong>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Catálogo y contenido */}
      <section className="rounded-3xl border border-white/10 bg-zinc-950/70 p-5 sm:p-6">
        <h2 className="text-lg font-black">Catálogo y contenido</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {catalogStats.map((stat, index) => (
            <Link
              key={stat.label}
              className={`group rounded-2xl border border-white/10 bg-gradient-to-br p-4 transition hover:border-white/20 ${statStyles[index % statStyles.length]}`}
              href={adminHref(stat.href)}
            >
              <p className="text-sm font-bold text-zinc-300">{stat.label}</p>
              <strong className="mt-2 block text-2xl font-black text-white">{stat.value}</strong>
            </Link>
          ))}
        </div>
      </section>

      {subscriptionVal && subscriptionVal.status !== "ACTIVE" && (
        <Link
          className="block rounded-2xl border border-amber-400/30 bg-amber-400/10 p-5 text-amber-100"
          href={adminHref("/admin/soporte")}
        >
          <strong>Estado de suscripción: {subscriptionVal.status}</strong>
          <span className="ml-2 text-sm text-amber-200">Revisá la información de tu cuenta.</span>
        </Link>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-3xl border border-white/10 bg-zinc-950/70 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-violet-300">Agenda</p>
              <h2 className="mt-1 text-2xl font-black">Eventos recientes</h2>
            </div>
            <Link
              className="text-sm font-bold text-pink-300 hover:text-pink-200"
              href={adminHref("/admin/eventos")}
            >
              Ver todos
            </Link>
          </div>
          <div className="mt-5 space-y-3">
            {recentEventsVal.map((event) => (
              <article className="flex items-center gap-4 rounded-2xl bg-white/[.04] p-4" key={event.id}>
                <time className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet-500/15 text-xs font-black text-violet-300">
                  {event.date?.toLocaleDateString("es-AR", { day: "2-digit", month: "short" }) ?? "S/F"}
                </time>
                <div className="min-w-0">
                  <h3 className="truncate font-black">{event.name}</h3>
                  <p className="truncate text-sm text-zinc-500">{event.location}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-zinc-950/70 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-emerald-300">Comunidad</p>
              <h2 className="mt-1 text-2xl font-black">Últimas opiniones</h2>
            </div>
            <Link
              className="text-sm font-bold text-pink-300 hover:text-pink-200"
              href={adminHref("/admin/testimonios")}
            >
              Moderar
            </Link>
          </div>
          <div className="mt-5 space-y-3">
            {recentTestimonialsVal.map((testimonial) => (
              <article className="rounded-2xl bg-white/[.04] p-4" key={testimonial.id}>
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
                      testimonial.moderationStatus === "approved"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : testimonial.moderationStatus === "rejected"
                          ? "bg-red-500/15 text-red-300"
                          : "bg-amber-500/15 text-amber-300"
                    }`}
                  >
                    {testimonial.moderationStatus === "approved"
                      ? "Publicada"
                      : testimonial.moderationStatus === "rejected"
                        ? "Rechazada"
                        : "Pendiente"}
                  </span>
                  <time className="text-xs text-zinc-600">
                    {testimonial.date.toLocaleDateString("es-AR")}
                  </time>
                </div>
                <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-zinc-300">
                  “{testimonial.description}”
                </p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
