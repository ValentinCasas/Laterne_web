import { ReportsShell } from "@/components/admin/reports/reports-shell";
import { MenuScatterChart } from "@/components/admin/reports/menu-scatter-chart";
import { MenuEngineeringTable } from "@/components/admin/reports/menu-engineering-table";
import { PageHeader, SectionHeader, KpiCard } from "@/components/admin/ui";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeMenuEngineering } from "@/lib/reports/menu-engineering";

type IngenieriaMenuPageProps = {
  searchParams: Promise<{
    from?: string;
    to?: string;
    branchId?: string;
    categoryId?: string;
    channel?: string;
    period?: string;
  }>;
};

/** @summary Página de ingeniería de menú: clasificación de productos por popularidad y rentabilidad. */
export default async function IngenieriaMenuPage({ searchParams }: IngenieriaMenuPageProps) {
  const context = await requirePermission("analytics.read");
  const params = await searchParams;

  const preset = params.period || "30d";
  const now = new Date();
  let from: Date;
  let to: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (preset === "7d") {
    from = new Date(now);
    from.setUTCDate(from.getUTCDate() - 7);
    from.setUTCHours(0, 0, 0, 0);
  } else if (preset === "30d") {
    from = new Date(now);
    from.setUTCDate(from.getUTCDate() - 30);
    from.setUTCHours(0, 0, 0, 0);
  } else if (preset === "3m") {
    from = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  } else if (preset === "6m") {
    from = new Date(now.getFullYear(), now.getMonth() - 6, 1);
  } else if (preset === "12m") {
    from = new Date(now.getFullYear() - 1, now.getMonth(), 1);
  } else {
    from = params.from ? new Date(params.from) : new Date(now.getTime() - 30 * 86_400_000);
    from.setUTCHours(0, 0, 0, 0);
  }

  if (params.to) {
    to = new Date(params.to);
    to.setUTCHours(23, 59, 59, 999);
  }

  const period = { from, to };

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

  const filters = {
    branchId,
    categoryId: params.categoryId ? Number(params.categoryId) : null,
    channel: params.channel || null,
  };

  const { items, summary } = await computeMenuEngineering(context.tenant.id, period, filters);

  return (
    <ReportsShell
      branches={context.branches.map((b) => ({ id: b.id, name: b.name }))}
      categories={categories}
      products={products}
      suppliers={suppliers}
      users={users}
      paymentMethods={[]}
      channels={["SALON", "MOSTRADOR", "DELIVERY", "ONLINE"]}
      sources={[]}
      defaultFrom={period.from.toISOString().slice(0, 10)}
      defaultTo={period.to.toISOString().slice(0, 10)}
      periodPreset={preset === "custom" ? undefined : preset}
    >
      <PageHeader eyebrow="Reportes" title="Ingeniería de menú" description="Clasificación de productos por popularidad y rentabilidad para tomar decisiones de carta, precios y recetas." section="reportes" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Productos analizados" value={summary.totalProducts} tone="text-white" />
        <KpiCard label="Con costo histórico" value={summary.withCostData} tone="text-emerald-300" />
        <KpiCard label="Sin costo histórico" value={summary.withoutCostData} tone="text-red-300" />
        <KpiCard label="Margen mediano" value={`${summary.marginMedian.toFixed(1)}%`} tone="text-amber-300" />
      </div>
      <section className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 sm:p-7">
        <SectionHeader title="Matriz de popularidad vs rentabilidad" description="Cada punto es un producto. Popularidad = unidades vendidas. Margen = porcentaje que queda luego del costo. Los cuadrantes usan la mediana del período como referencia." />
        <div className="mt-4">
          <MenuScatterChart data={items} popularityMedian={summary.popularityMedian} marginMedian={summary.marginMedian} />
        </div>
      </section>
      <section className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 sm:p-7">
        <SectionHeader title="Detalle de productos" description="Hacé clic en un producto para ver su ficha. CMV = costo de la mercadería vendida." />
        <div className="mt-4">
          <MenuEngineeringTable data={items} />
        </div>
      </section>
    </ReportsShell>
  );
}
