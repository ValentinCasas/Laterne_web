import { ReportsShell } from "@/components/admin/reports/reports-shell";
import { ReportsKpiCard } from "@/components/admin/reports/reports-kpi-card";
import { ReportsTable } from "@/components/admin/reports/reports-table";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolvePeriod } from "@/lib/reports/period";
import { computeComprasKpis, computePurchaseItems } from "@/lib/reports/purchases";
import type { PurchaseItem } from "@/lib/reports";

const PAGE_SIZE = 50;

type ComprasPageProps = { searchParams: Promise<{ from?: string; to?: string; branchId?: string; supplierId?: string; productId?: string; page?: string }> };

/** @summary Página de reporte de compras con detalle cronológico. */
export default async function ComprasPage({ searchParams }: ComprasPageProps) {
  const context = await requirePermission("analytics.read");
  const params = await searchParams;
  const branchId = params.branchId ? Number(params.branchId) : (context.activeBranchId && context.activeBranchId > 0 ? context.activeBranchId : null);
  const page = Math.max(1, Number(params.page || 1));

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
    supplierId: params.supplierId ? Number(params.supplierId) : null,
    productId: params.productId ? Number(params.productId) : null,
  };

  const [kpis, { items, total }] = await Promise.all([
    computeComprasKpis(context.tenant.id, period, filters),
    computePurchaseItems(context.tenant.id, period, filters, page, PAGE_SIZE),
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
      <AdminPageHeader
        eyebrow="Reportes"
        title="Compras"
        description="Evolución de costos y proveedores"
        section="reportes"
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ReportsKpiCard label="Total comprado" value={kpis.totalPurchased} tone="text-emerald-300" />
        <ReportsKpiCard label="Operaciones" value={kpis.operationCount} tone="text-sky-300" />
        <ReportsKpiCard label="Proveedores activos" value={kpis.activeSuppliers} tone="text-amber-300" />
      </div>
      <ReportsTable
        headers={["Fecha", "Proveedor", "Documento", "Producto", "Cantidad", "Unidad", "Costo unitario", "Total", "Sucursal"]}
        rows={items}
        emptyMessage="No hay compras para este período."
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        onPageChange={(newPage) => {
          const url = new URL(window.location.href);
          url.searchParams.set("page", String(newPage));
          window.location.href = url.toString();
        }}
        renderRow={(row: PurchaseItem) => (
          <tr key={`${row.document}-${row.productName}-${row.date}`} className="hover:bg-white/[0.02]">
            <td className="px-5 py-3">{row.date}</td>
            <td className="px-5 py-3 font-medium">{row.supplierName}</td>
            <td className="px-5 py-3 font-mono text-xs">{row.document}</td>
            <td className="px-5 py-3">{row.productName}</td>
            <td className="px-5 py-3 text-right tabular-nums">{row.quantity}</td>
            <td className="px-5 py-3">{row.unit}</td>
            <td className="px-5 py-3 text-right tabular-nums">{row.unitCost.toLocaleString("es-AR")}</td>
            <td className="px-5 py-3 text-right font-black tabular-nums">{row.total.toLocaleString("es-AR")}</td>
            <td className="px-5 py-3">{row.branchName}</td>
          </tr>
        )}
      />
    </ReportsShell>
  );
}
