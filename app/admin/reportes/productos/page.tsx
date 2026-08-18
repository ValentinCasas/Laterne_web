import { ReportsShell } from "@/components/admin/reports/reports-shell";
import { PageHeader, SectionHeader, KpiCard } from "@/components/admin/ui";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolvePeriod } from "@/lib/reports/period";
import { computeProductKpis, computeProductRanking } from "@/lib/reports/products";

type ProductosPageProps = { searchParams: Promise<{ from?: string; to?: string; branchId?: string; categoryId?: string; productId?: string; top?: string }> };

/** @summary Página de reporte de productos con ranking y márgenes. */
export default async function ProductosPage({ searchParams }: ProductosPageProps) {
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
  const filters = {
    branchId,
    categoryId: params.categoryId ? Number(params.categoryId) : null,
    productId: params.productId ? Number(params.productId) : null,
  };

  const [kpis, rankingData] = await Promise.all([
    computeProductKpis(context.tenant.id, period, filters),
    computeProductRanking(context.tenant.id, period, filters, Number(params.top || 10)),
  ]);

  return (
    <ReportsShell
      branches={context.branches.map((b) => ({ id: b.id, name: b.name }))}
      categories={categories}
      products={products}
      suppliers={suppliers}
      users={users}
      paymentMethods={[]}
      channels={[]}
      sources={[]}
    >
      <PageHeader eyebrow="Reportes" title="Productos" description="Popularidad, rentabilidad y CMV." section="reportes" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Unidades vendidas" value={kpis.unitsSold} tone="text-sky-300" />
        <KpiCard label="Ventas totales" value={kpis.totalSales} tone="text-emerald-300" />
        <KpiCard label="CMV total" value={kpis.cmvTotal} tone="text-red-300" />
        <KpiCard label="Margen total" value={kpis.marginTotal} tone="text-amber-300" />
      </div>
      <section className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 sm:p-7">
        <SectionHeader title="Ranking de productos" description={`Top ${rankingData.ranking.length} = ${rankingData.topProductsShare.toFixed(1)}% de las ventas`} />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--admin-border)] bg-white/[0.02] text-xs uppercase tracking-wider text-[var(--admin-muted)]">
                <th className="px-5 py-3 font-bold">Producto</th>
                <th className="px-5 py-3 font-bold text-right">Unidades</th>
                <th className="px-5 py-3 font-bold text-right">Ventas</th>
                <th className="px-5 py-3 font-bold text-right">Participación</th>
                <th className="px-5 py-3 font-bold text-right">CMV</th>
                <th className="px-5 py-3 font-bold text-right">CMV%</th>
                <th className="px-5 py-3 font-bold text-right">Margen</th>
                <th className="px-5 py-3 font-bold text-right">Margen%</th>
                <th className="px-5 py-3 font-bold text-right">Markup</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--admin-border)]">
              {rankingData.ranking.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-[var(--admin-muted)]">
                    No hay ventas para este período.
                  </td>
                </tr>
              ) : (
                rankingData.ranking.map((item, index) => (
                  <tr key={item.productId} className="hover:bg-white/[0.02]">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-pink-300">{index + 1}</span>
                        <span className="font-medium">{item.productName}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">{item.units}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{item.sales.toLocaleString("es-AR")}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{item.participation.toFixed(1)}%</td>
                    <td className="px-5 py-3 text-right tabular-nums">{item.cmv !== null ? item.cmv.toLocaleString("es-AR") : "—"}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{item.cmvPercent !== null ? `${item.cmvPercent.toFixed(1)}%` : "—"}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-emerald-300">{item.margin !== null ? item.margin.toLocaleString("es-AR") : "—"}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-emerald-300">{item.marginPercent !== null ? `${item.marginPercent.toFixed(1)}%` : "—"}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{item.markup !== null ? `${item.markup.toFixed(1)}%` : "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </ReportsShell>
  );
}
