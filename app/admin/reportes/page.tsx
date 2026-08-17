import { ReportsShell } from "@/components/admin/reports/reports-shell";
import { ReportsKpiCard } from "@/components/admin/reports/reports-kpi-card";
import { EvolutionBarChart, Sparkline } from "@/components/admin/reports/reports-chart";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolvePeriod } from "@/lib/reports/period";
import { computeVentasKpis, computeEvolution } from "@/lib/reports/sales";
import { computeProductRanking } from "@/lib/reports/products";

type ResumenPageProps = { searchParams: Promise<{ from?: string; to?: string; branchId?: string }> };

/** @summary Página de resumen general de reportes. */
export default async function ResumenPage({ searchParams }: ResumenPageProps) {
  const context = await requirePermission("analytics.read");
  const params = await searchParams;
  const branchId = params.branchId ? Number(params.branchId) : (context.activeBranchId && context.activeBranchId > 0 ? context.activeBranchId : null);

  const [categories, products, suppliers, users] = await Promise.all([
    prisma.category.findMany({ where: { tenantId: context.tenant.id }, select: { id: true, name: true } }),
    prisma.product.findMany({ where: { tenantId: context.tenant.id }, select: { id: true, name: true } }),
    prisma.supplier.findMany({ where: { tenantId: context.tenant.id, status: "active" }, select: { id: true, name: true } }),
    prisma.user.findMany({
      where: { memberships: { some: { tenantId: context.tenant.id, status: "active" } } },
      select: { id: true, name: true },
    }),
  ]);

  const period = resolvePeriod({ from: params.from || undefined, to: params.to || undefined });
  const filters = { branchId };

  const [kpis, evolution, topProducts] = await Promise.all([
    computeVentasKpis(context.tenant.id, period, filters),
    computeEvolution(context.tenant.id, period, filters, "day"),
    computeProductRanking(context.tenant.id, period, filters, 5),
  ]);

  return (
    <ReportsShell
      branches={context.branches.map((b) => ({ id: b.id, name: b.name }))}
      categories={categories}
      products={products}
      suppliers={suppliers}
      users={users}
      paymentMethods={[]}
      channels={["SALON", "MOSTRADOR", "DELIVERY", "ONLINE"]}
      sources={["ADMIN", "MENUCLICK_WEB", "TABLE_QR", "POS", "EXTERNAL_INTEGRATOR", "API"]}
    >
      <AdminPageHeader
        eyebrow="Reportes"
        title="Resumen"
        description="KPIs generales y evolución del negocio"
        section="reportes"
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ReportsKpiCard label="Ventas netas" value={kpis.netSales} tone="text-emerald-300" />
        <ReportsKpiCard label="Pedidos" value={kpis.orderCount} tone="text-sky-300" />
        <ReportsKpiCard label="Ticket promedio" value={kpis.averageTicket} tone="text-amber-300" />
        <ReportsKpiCard
          label="Variación ventas"
          value={`${kpis.netSalesChange >= 0 ? "+" : ""}${kpis.netSalesChange.toFixed(1)}%`}
          tone={kpis.netSalesChange >= 0 ? "text-emerald-300" : "text-red-300"}
        />
      </div>
      <section className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 sm:p-7">
        <h2 className="text-lg font-black">Evolución de ventas netas</h2>
        <div className="mt-4">
          <EvolutionBarChart
            data={evolution.map((point) => ({ label: point.date.slice(5), value: point.netSales }))}
            height={160}
          />
        </div>
        <div className="mt-4">
          <Sparkline data={evolution.map((p) => p.netSales)} />
        </div>
      </section>
      <section className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 sm:p-7">
        <h2 className="text-lg font-black">Top productos</h2>
        <div className="mt-4 space-y-3">
          {topProducts.ranking.length === 0 ? (
            <p className="text-zinc-500">No hay ventas para este período.</p>
          ) : (
            topProducts.ranking.map((product, index) => (
              <article key={product.productId} className="grid grid-cols-[32px_1fr_auto] items-center gap-3 rounded-2xl bg-white/5 p-3">
                <span className="text-center text-sm font-black text-pink-300">{index + 1}</span>
                <div>
                  <strong>{product.productName}</strong>
                  <p className="text-xs text-zinc-500">{product.units} unidades</p>
                </div>
                <span className="text-sm font-bold">{product.sales.toLocaleString("es-AR")}</span>
              </article>
            ))
          )}
        </div>
      </section>
    </ReportsShell>
  );
}
