import { ReportsShell } from "@/components/admin/reports/reports-shell";
import { ReportsTable } from "@/components/admin/reports/reports-table";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolvePeriod } from "@/lib/reports/period";
import { computeBranchComparison } from "@/lib/reports/branches";
import type { BranchComparisonItem } from "@/lib/reports";

type SucursalesPageProps = { searchParams: Promise<{ from?: string; to?: string }> };

/** @summary Página de comparativa entre sucursales. */
export default async function SucursalesPage({ searchParams }: SucursalesPageProps) {
  const context = await requirePermission("analytics.read");
  const params = await searchParams;

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
  const accessibleBranchIds = context.branches.map((b) => b.id);
  const branches = await computeBranchComparison(context.tenant.id, period, {}, accessibleBranchIds);

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
        title="Sucursales"
        description="Comparativa entre sucursales"
        section="reportes"
      />
      {branches.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 p-12 text-center text-zinc-500">
          Necesitás acceso a más de una sucursal para ver la comparativa.
        </div>
      ) : (
        <ReportsTable
          headers={["Sucursal", "Ventas netas", "Pedidos", "Ticket promedio", "Descuentos", "Participación"]}
          rows={branches}
          emptyMessage="No hay datos para este período."
          page={1}
          pageSize={branches.length}
          total={branches.length}
          onPageChange={() => {}}
          renderRow={(row: BranchComparisonItem) => (
            <tr key={row.branchId} className="hover:bg-white/[0.02]">
              <td className="px-5 py-3 font-medium">{row.branchName}</td>
              <td className="px-5 py-3 text-right font-black tabular-nums">{row.netSales.toLocaleString("es-AR")}</td>
              <td className="px-5 py-3 text-right tabular-nums">{row.orderCount}</td>
              <td className="px-5 py-3 text-right tabular-nums">{row.averageTicket.toLocaleString("es-AR")}</td>
              <td className="px-5 py-3 text-right text-red-300">{row.discounts.toLocaleString("es-AR")}</td>
              <td className="px-5 py-3 text-right tabular-nums">{row.participation.toFixed(1)}%</td>
            </tr>
          )}
        />
      )}
    </ReportsShell>
  );
}
