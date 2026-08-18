import { ReportsShell } from "@/components/admin/reports/reports-shell";
import { ReportsVentasTable } from "@/components/admin/reports/reports-ventas-table";
import { EvolutionBarChart, HorizontalBarList } from "@/components/admin/reports/reports-chart";
import { PageHeader, SectionHeader, KpiCard } from "@/components/admin/ui";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolvePeriod, periodGranularity } from "@/lib/reports/period";
import {
  computeVentasKpis,
  computeEvolution,
  computeByWeekday,
  computeByHour,
  computeByPaymentMethod,
  computeBySource,
  computeByChannel,
  salesWhere,
} from "@/lib/reports/sales";
import type { OrderDetail } from "@/lib/reports";

const PAGE_SIZE = 20;

type VentasPageProps = { searchParams: Promise<{ from?: string; to?: string; branchId?: string; categoryId?: string; productId?: string; userId?: string; paymentMethod?: string; channel?: string; source?: string; page?: string }> };

/** @summary Página de reporte de ventas con detalle y gráficos. */
export default async function VentasPage({ searchParams }: VentasPageProps) {
  const context = await requirePermission("analytics.read");
  const params = await searchParams;
  const branchId = params.branchId ? Number(params.branchId) : (context.activeBranchId && context.activeBranchId > 0 ? context.activeBranchId : null);
  const page = Math.max(1, Number(params.page || 1));

  const [categories, products, suppliers, users, paymentMethods] = await Promise.all([
    prisma.category.findMany({ where: { tenantId: context.tenant.id }, select: { id: true, name: true } }),
    prisma.product.findMany({ where: { tenantId: context.tenant.id }, select: { id: true, name: true } }),
    prisma.supplier.findMany({ where: { tenantId: context.tenant.id, status: "active" }, select: { id: true, name: true } }),
    prisma.user.findMany({
      where: { memberships: { some: { tenantId: context.tenant.id, status: "active" } } },
      select: { id: true, name: true },
    }),
    prisma.customerOrder.findMany({
      where: { tenantId: context.tenant.id },
      select: { paymentMethod: true },
      distinct: ["paymentMethod"],
    }),
  ]);

  const period = resolvePeriod({ from: params.from || undefined, to: params.to || undefined });
  const filters = {
    branchId,
    categoryId: params.categoryId ? Number(params.categoryId) : null,
    productId: params.productId ? Number(params.productId) : null,
    userId: params.userId ? Number(params.userId) : null,
    paymentMethod: params.paymentMethod || null,
    channel: params.channel || null,
    source: params.source || null,
  };

  const granularity = periodGranularity(period.from, period.to);

  const [kpis, evolution, byWeekday, byHour, byPaymentMethod, bySource, byChannel, ordersResult, total] =
    await Promise.all([
      computeVentasKpis(context.tenant.id, period, filters),
      computeEvolution(context.tenant.id, period, filters, granularity),
      computeByWeekday(context.tenant.id, period, filters),
      computeByHour(context.tenant.id, period, filters),
      computeByPaymentMethod(context.tenant.id, period, filters),
      computeBySource(context.tenant.id, period, filters),
      computeByChannel(context.tenant.id, period, filters),
      prisma.customerOrder.findMany({
        where: salesWhere(context.tenant.id, period, filters),
        include: {
          tableSession: { select: { waiter: { select: { name: true } } } },
          deliveries: { select: { createdBy: { select: { name: true } } }, take: 1 },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.customerOrder.count({ where: salesWhere(context.tenant.id, period, filters) }),
    ]);

  const userName = (order: typeof ordersResult[number]): string | null => {
    if (order.tableSession?.waiter?.name) return order.tableSession.waiter.name;
    if (order.deliveries[0]?.createdBy?.name) return order.deliveries[0].createdBy.name;
    return null;
  };

  const orders: OrderDetail[] = ordersResult.map((order) => ({
    id: order.id,
    reference: order.reference,
    createdAt: order.createdAt.toISOString(),
    status: order.status,
    orderType: order.orderType,
    channel: order.channel,
    source: order.source,
    paymentMethod: order.paymentMethod,
    total: Number(order.total),
    discount: Number(order.discount),
    customerName: order.customerName,
    userName: userName(order),
  }));

  return (
    <ReportsShell
      branches={context.branches.map((b) => ({ id: b.id, name: b.name }))}
      categories={categories}
      products={products}
      suppliers={suppliers}
      users={users}
      paymentMethods={paymentMethods.map((p) => p.paymentMethod).filter(Boolean) as string[]}
      channels={["SALON", "MOSTRADOR", "DELIVERY", "ONLINE"]}
      sources={["ADMIN", "MENUCLICK_WEB", "TABLE_QR", "POS", "EXTERNAL_INTEGRATOR", "API"]}
    >
      <PageHeader eyebrow="Reportes" title="Ventas" description="Análisis de ventas, medios de pago y origen." section="reportes" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard label="Ventas brutas" value={kpis.grossSales} tone="text-white" />
        <KpiCard label="Descuentos" value={kpis.discounts} tone="text-red-300" />
        <KpiCard label="Ventas netas" value={kpis.netSales} tone="text-emerald-300" />
        <KpiCard label="Pedidos" value={kpis.orderCount} tone="text-sky-300" />
        <KpiCard label="Ticket promedio" value={kpis.averageTicket} tone="text-amber-300" />
        <KpiCard
          label="Variación ventas"
          value={`${kpis.netSalesChange >= 0 ? "+" : ""}${kpis.netSalesChange.toFixed(1)}%`}
          tone={kpis.netSalesChange >= 0 ? "text-emerald-300" : "text-red-300"}
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 sm:p-7">
          <SectionHeader title="Evolución temporal" description="Ventas netas a lo largo del período." />
          <div className="mt-4">
            <EvolutionBarChart data={evolution.map((p) => ({ label: p.date.slice(5), value: p.netSales }))} height={140} />
          </div>
        </section>
        <section className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 sm:p-7">
          <SectionHeader title="Medios de pago" description="Distribución por método de cobro." />
          <div className="mt-4">
            <HorizontalBarList data={byPaymentMethod.map((m) => ({ label: m.method, value: m.netSales }))} />
          </div>
        </section>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 sm:p-7">
          <SectionHeader title="Ventas por día de semana" description="Distribución semanal." />
          <div className="mt-4">
            <HorizontalBarList data={byWeekday.map((d) => ({ label: d.label, netSales: d.netSales }))} maxKey="netSales" />
          </div>
        </section>
        <section className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 sm:p-7">
          <SectionHeader title="Ventas por hora" description="Distribución horaria." />
          <div className="mt-4">
            <HorizontalBarList data={byHour.map((d) => ({ label: `${String(d.hour).padStart(2, "0")}:00`, netSales: d.netSales }))} maxKey="netSales" />
          </div>
        </section>
      </div>
      <section className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 sm:p-7">
        <SectionHeader title="Origen y canal" description="De dónde vienen los pedidos y por qué canal entran." />
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-bold text-zinc-400">Por origen</h3>
            <HorizontalBarList data={bySource.map((s) => ({ label: s.source, netSales: s.netSales }))} maxKey="netSales" />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-bold text-zinc-400">Por canal</h3>
            <HorizontalBarList data={byChannel.map((c) => ({ label: c.channel, netSales: c.netSales }))} maxKey="netSales" />
          </div>
        </div>
      </section>
      <section className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 sm:p-7">
        <SectionHeader title="Pedidos" description="Detalle de pedidos del período." />
        <div className="mt-4">
          <ReportsVentasTable orders={orders} page={page} pageSize={PAGE_SIZE} total={total} />
        </div>
      </section>
    </ReportsShell>
  );
}
