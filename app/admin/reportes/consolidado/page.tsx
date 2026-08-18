import { ReportsShell } from "@/components/admin/reports/reports-shell";
import { EvolutionBarChart, HorizontalBarList } from "@/components/admin/reports/reports-chart";
import { PageHeader, SectionHeader, KpiCard, EmptyState, StatusBadge } from "@/components/admin/ui";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolvePeriod } from "@/lib/reports/period";
import { computeVentasKpis, computeEvolution, computeByChannel, computeBySource } from "@/lib/reports/sales";
import { computeBranchComparison } from "@/lib/reports/branches";
import type { ReportFilters, BranchComparisonItem, EvolutionPoint } from "@/lib/reports";

type ConsolidadoPageProps = {
  searchParams: Promise<{
    from?: string;
    to?: string;
    branchIds?: string;
    tab?: string;
    period?: string;
  }>;
};

interface LowStockRow {
  productId: number;
  product: { name: string };
  branch: { name: string };
  current: number;
  minimum: number;
  unit: string;
}

interface PromotionRow {
  id: number;
  name: string;
  branch: { name: string } | null;
  discountValue: number | null;
  startAt: Date | null;
  endAt: Date | null;
  status: string;
}

interface MembershipRow {
  id: number;
  user: { name: string; email: string };
  role: { name: string };
  allBranches: boolean;
  branchAccess: Array<{ branchId: number; branch: { name: string } }>;
}

interface LicenseRow {
  id: number;
  branch: { name: string };
  plan: { name: string } | null;
  status: string;
  startsAt: Date;
  currentPeriodEnd: Date | null;
  usersAllowed: number;
  pricePerUser: unknown;
}

/** @summary Página consolidada multi-sucursal: KPIs, comparativa, stock, productos, promociones, usuarios y licencias. */
export default async function ConsolidadoPage({ searchParams }: ConsolidadoPageProps) {
  const context = await requirePermission("analytics.read");
  const params = await searchParams;
  const period = resolvePeriod({ from: params.from || undefined, to: params.to || undefined });
  const branchIds = params.branchIds
    ? params.branchIds.split(",").map((id) => Number(id)).filter((id) => Number.isFinite(id))
    : [];
  const filters: ReportFilters = {
    branchId: branchIds.length === 1 ? branchIds[0] : null,
  };
  const activeBranchIds = branchIds.length > 0 ? branchIds : context.branches.map((b) => b.id);

  const [categories, products, suppliers, users, branchComparison, kpis, evolution, byChannel, bySource, lowStocks, promotions, memberships, licenses] =
    await Promise.all([
      prisma.category.findMany({ where: { tenantId: context.tenant.id }, select: { id: true, name: true } }),
      prisma.product.findMany({ where: { tenantId: context.tenant.id }, select: { id: true, name: true } }),
      prisma.supplier.findMany({ where: { tenantId: context.tenant.id, status: "active" }, select: { id: true, name: true } }),
      prisma.user.findMany({
        where: { memberships: { some: { tenantId: context.tenant.id, status: "active" } } },
        select: { id: true, name: true },
      }),
      computeBranchComparison(context.tenant.id, period, filters, activeBranchIds),
      computeVentasKpis(context.tenant.id, period, filters),
      computeEvolution(context.tenant.id, period, filters, "day"),
      computeByChannel(context.tenant.id, period, filters),
      computeBySource(context.tenant.id, period, filters),
      prisma.inventoryStock.findMany({
        where: { tenantId: context.tenant.id, branchId: { in: activeBranchIds }, tracked: true },
        include: { product: { select: { name: true } }, branch: { select: { name: true } } },
      }).then((stocks) => stocks.filter((stock) => Number(stock.current) <= Number(stock.minimum)).map((stock): LowStockRow => ({
        productId: stock.productId,
        product: stock.product,
        branch: stock.branch,
        current: Number(stock.current),
        minimum: Number(stock.minimum),
        unit: stock.unit,
      }))),
      prisma.promotion.findMany({
        where: { tenantId: context.tenant.id, OR: [{ branchId: null }, { branchId: { in: activeBranchIds } }] },
        include: { branch: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      }).then((items) =>
        items.map((promo): PromotionRow => ({
          id: promo.id,
          name: promo.name,
          branch: promo.branch,
          discountValue: promo.discountValue === null ? null : Number(promo.discountValue),
          startAt: promo.startAt,
          endAt: promo.endAt,
          status: promo.status,
        })),
      ),
      prisma.tenantMembership.findMany({
        where: { tenantId: context.tenant.id, status: "active" },
        include: { user: { select: { name: true, email: true } }, role: { select: { key: true, name: true } }, branchAccess: { include: { branch: { select: { name: true } } } } },
        orderBy: { createdAt: "asc" },
      }).then((items) =>
        items.map((membership): MembershipRow => ({
          id: membership.id,
          user: membership.user,
          role: membership.role,
          allBranches: membership.allBranches,
          branchAccess: membership.branchAccess,
        })),
      ),
      prisma.branchLicense.findMany({
        where: { tenantId: context.tenant.id, branchId: { in: activeBranchIds } },
        include: { branch: { select: { name: true } }, plan: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      }).then((items) =>
        items.map((license): LicenseRow => ({
          id: license.id,
          branch: license.branch,
          plan: license.plan,
          status: license.status,
          startsAt: license.startsAt,
          currentPeriodEnd: license.currentPeriodEnd,
          usersAllowed: license.usersAllowed,
          pricePerUser: license.pricePerUser,
        })),
      ),
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
      <PageHeader eyebrow="Multi-sucursal" title="Consolidado" description="Vista integral del tenant: ventas, stock, productos, promociones, usuarios y licencias." section="reportes" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Ventas netas" value={kpis.netSales} tone="text-emerald-300" />
        <KpiCard label="Pedidos" value={kpis.orderCount} tone="text-sky-300" />
        <KpiCard label="Ticket promedio" value={kpis.averageTicket} tone="text-amber-300" />
        <KpiCard label="Descuentos" value={kpis.previousNetSales} tone="text-red-300" />
      </div>
      <section className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 sm:p-7">
        <SectionHeader title="Evolución de ventas netas" description="Comparativa con el período anterior." />
        <div className="mt-4">
          <EvolutionBarChart data={evolution.map((point: EvolutionPoint) => ({ label: point.date.slice(5), value: point.netSales }))} height={160} />
        </div>
      </section>
      <section className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 sm:p-7">
        <SectionHeader title="Comparativa por sucursal" description="Métricas consolidadas del período seleccionado." />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--admin-border)] bg-white/[0.02] text-xs uppercase tracking-wider text-[var(--admin-muted)]">
                <th className="px-5 py-3 font-bold">Sucursal</th>
                <th className="px-5 py-3 font-bold text-right">Ventas netas</th>
                <th className="px-5 py-3 font-bold text-right">Pedidos</th>
                <th className="px-5 py-3 font-bold text-right">Ticket promedio</th>
                <th className="px-5 py-3 font-bold text-right">Descuentos</th>
                <th className="px-5 py-3 font-bold text-right">Participación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--admin-border)]">
              {branchComparison.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-[var(--admin-muted)]"><EmptyState title="Necesitás acceso a más de una sucursal" description="Cuando tengas acceso a varias sucursales, vas a ver la comparativa aquí." /></td>
                </tr>
              ) : (
                branchComparison.map((row: BranchComparisonItem) => (
                  <tr key={row.branchId} className="hover:bg-white/[0.02]">
                    <td className="px-5 py-3 font-medium">{row.branchName}</td>
                    <td className="px-5 py-3 text-right font-black tabular-nums">{row.netSales.toLocaleString("es-AR")}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{row.orderCount}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{row.averageTicket.toLocaleString("es-AR")}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-red-300">{row.discounts.toLocaleString("es-AR")}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{row.participation.toFixed(1)}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      <section className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 sm:p-7">
        <SectionHeader title="Origen de ventas por sucursal" description="Distribución por canal y origen." />
        <div className="mt-4 grid gap-6 xl:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-bold text-zinc-400">Por canal</h3>
            <HorizontalBarList data={byChannel.map((c: { channel: string; netSales: number }) => ({ label: c.channel, value: c.netSales }))} />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-bold text-zinc-400">Por origen</h3>
            <HorizontalBarList data={bySource.map((s: { source: string; netSales: number }) => ({ label: s.source, value: s.netSales }))} />
          </div>
        </div>
      </section>
      <section className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 sm:p-7">
        <SectionHeader title="Stock crítico comparativo" description="Productos por debajo del mínimo en las sucursales seleccionadas." />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--admin-border)] bg-white/[0.02] text-xs uppercase tracking-wider text-[var(--admin-muted)]">
                <th className="px-5 py-3 font-bold">Producto</th>
                <th className="px-5 py-3 font-bold">Sucursal</th>
                <th className="px-5 py-3 font-bold text-right">Stock actual</th>
                <th className="px-5 py-3 font-bold text-right">Mínimo</th>
                <th className="px-5 py-3 font-bold text-right">Unidad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--admin-border)]">
              {lowStocks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-[var(--admin-muted)]"><EmptyState title="No hay stock crítico" description="Todas las sucursales seleccionadas tienen stock suficiente." /></td>
                </tr>
              ) : (
                lowStocks.map((row: LowStockRow, idx: number) => (
                  <tr key={`${row.productId}-${row.branch.name}-${idx}`} className="hover:bg-white/[0.02]">
                    <td className="px-5 py-3">{row.product.name}</td>
                    <td className="px-5 py-3">{row.branch.name}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-red-300">{row.current}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{row.minimum}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{row.unit}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      <section className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 sm:p-7">
        <SectionHeader title="Promociones activas" description="Promociones del tenant y por sucursal." />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--admin-border)] bg-white/[0.02] text-xs uppercase tracking-wider text-[var(--admin-muted)]">
                <th className="px-5 py-3 font-bold">Nombre</th>
                <th className="px-5 py-3 font-bold">Alcance</th>
                <th className="px-5 py-3 font-bold">Descuento</th>
                <th className="px-5 py-3 font-bold">Inicio</th>
                <th className="px-5 py-3 font-bold">Fin</th>
                <th className="px-5 py-3 font-bold">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--admin-border)]">
              {promotions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-[var(--admin-muted)]"><EmptyState title="No hay promociones" description="No hay promociones para este período." /></td>
                </tr>
              ) : (
                promotions.map((promo: PromotionRow) => (
                  <tr key={promo.id} className="hover:bg-white/[0.02]">
                    <td className="px-5 py-3 font-medium">{promo.name}</td>
                    <td className="px-5 py-3">{promo.branch?.name ?? "General del tenant"}</td>
                    <td className="px-5 py-3">{promo.discountValue}</td>
                    <td className="px-5 py-3">{promo.startAt ? new Date(promo.startAt).toISOString().slice(0, 10) : "—"}</td>
                    <td className="px-5 py-3">{promo.endAt ? new Date(promo.endAt).toISOString().slice(0, 10) : "—"}</td>
                    <td className="px-5 py-3"><StatusBadge status={promo.status} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      <section className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 sm:p-7">
        <SectionHeader title="Usuarios y acceso a sucursales" description="Matriz de permisos y alcance por sucursal." />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--admin-border)] bg-white/[0.02] text-xs uppercase tracking-wider text-[var(--admin-muted)]">
                <th className="px-5 py-3 font-bold">Usuario</th>
                <th className="px-5 py-3 font-bold">Rol</th>
                <th className="px-5 py-3 font-bold">Acceso</th>
                <th className="px-5 py-3 font-bold">Sucursales asignadas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--admin-border)]">
              {memberships.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-[var(--admin-muted)]"><EmptyState title="No hay usuarios registrados." description="Agregá usuarios para que puedan operar en el panel." /></td>
                </tr>
              ) : (
                memberships.map((membership: MembershipRow) => (
                  <tr key={membership.id} className="hover:bg-white/[0.02]">
                    <td className="px-5 py-3">
                      <div>
                        <p className="font-medium">{membership.user.name}</p>
                        <p className="text-xs text-zinc-500">{membership.user.email}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3">{membership.role.name}</td>
                    <td className="px-5 py-3">
                      {membership.allBranches ? (
                        <StatusBadge status="Consolidado" tone="success" />
                      ) : (
                        <StatusBadge status="Por sucursal" tone="default" />
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {membership.allBranches ? (
                        "Todas"
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {membership.branchAccess.map((access) => (
                            <span key={access.branchId} className="rounded-full bg-white/5 px-2 py-1 text-xs text-zinc-300">{access.branch.name}</span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      <section className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 sm:p-7">
        <SectionHeader title="Licencias por sucursal" description="Estado operativo y cupos de cada local." />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--admin-border)] bg-white/[0.02] text-xs uppercase tracking-wider text-[var(--admin-muted)]">
                <th className="px-5 py-3 font-bold">Sucursal</th>
                <th className="px-5 py-3 font-bold">Plan</th>
                <th className="px-5 py-3 font-bold">Estado</th>
                <th className="px-5 py-3 font-bold">Inicio</th>
                <th className="px-5 py-3 font-bold">Fin</th>
                <th className="px-5 py-3 font-bold text-right">Cupos</th>
                <th className="px-5 py-3 font-bold text-right">Precio usuario</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--admin-border)]">
              {licenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-[var(--admin-muted)]"><EmptyState title="No hay licencias registradas" description="Las licencias se crean automáticamente al agregar sucursales." /></td>
                </tr>
              ) : (
                licenses.map((license: LicenseRow) => (
                  <tr key={license.id} className="hover:bg-white/[0.02]">
                    <td className="px-5 py-3 font-medium">{license.branch.name}</td>
                    <td className="px-5 py-3">{license.plan?.name ?? "—"}</td>
                    <td className="px-5 py-3"><StatusBadge status={license.status} /></td>
                    <td className="px-5 py-3">{new Date(license.startsAt).toISOString().slice(0, 10)}</td>
                    <td className="px-5 py-3">{license.currentPeriodEnd ? new Date(license.currentPeriodEnd).toISOString().slice(0, 10) : "—"}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{license.usersAllowed}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{license.pricePerUser ? `$${Number(license.pricePerUser).toLocaleString("es-AR")}` : "—"}</td>
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
