import { authorize, canAccessBranch } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/format";
import { resolvePeriod, periodGranularity } from "@/lib/reports/period";
import {
  computeVentasKpis,
  computeEvolution,
  computeByWeekday,
  computeByHour,
  computeByPaymentMethod,
  computeBySource,
  computeByChannel,
  computeCancellations,
  salesWhere,
} from "@/lib/reports/sales";

const PAGE_SIZE = 20;

/** @summary Reporte de ventas con KPIs, gráficos y detalle paginado. */
export async function GET(request: Request) {
  const auth = await authorize("analytics.read");
  if (!auth) return new Response("No autorizado", { status: 403 });

  const url = new URL(request.url);
  const rawFrom = url.searchParams.get("from");
  const rawTo = url.searchParams.get("to");
  const requestedBranchId = url.searchParams.has("branchId") ? Number(url.searchParams.get("branchId")) : null;
  const categoryId = url.searchParams.has("categoryId") ? Number(url.searchParams.get("categoryId")) : null;
  const productId = url.searchParams.has("productId") ? Number(url.searchParams.get("productId")) : null;
  const userId = url.searchParams.has("userId") ? Number(url.searchParams.get("userId")) : null;
  const paymentMethod = url.searchParams.get("paymentMethod") || null;
  const channel = url.searchParams.get("channel") || null;
  const source = url.searchParams.get("source") || null;
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));

  let branchId: number | null = null;
  if (requestedBranchId && requestedBranchId > 0) {
    if (!canAccessBranch(auth, requestedBranchId)) return new Response("No autorizado", { status: 403 });
    branchId = requestedBranchId;
  } else if (auth.allBranches && auth.activeBranchId === 0) {
    branchId = null;
  } else if (auth.activeBranchId && auth.activeBranchId > 0) {
    branchId = auth.activeBranchId;
  }

  const period = resolvePeriod({ from: rawFrom || undefined, to: rawTo || undefined });
  const filters = { branchId, categoryId, productId, userId, paymentMethod, channel, source };

  const granularity = periodGranularity(period.from, period.to);

  const [kpis, evolution, byWeekday, byHour, byPaymentMethod, bySource, byChannel, cancellations, ordersResult] =
    await Promise.all([
      computeVentasKpis(auth.tenant.id, period, filters),
      computeEvolution(auth.tenant.id, period, filters, granularity),
      computeByWeekday(auth.tenant.id, period, filters),
      computeByHour(auth.tenant.id, period, filters),
      computeByPaymentMethod(auth.tenant.id, period, filters),
      computeBySource(auth.tenant.id, period, filters),
      computeByChannel(auth.tenant.id, period, filters),
      computeCancellations(auth.tenant.id, period, filters),
      prisma.customerOrder.findMany({
        where: salesWhere(auth.tenant.id, period, filters),
        include: {
          tableSession: { select: { waiter: { select: { name: true } } } },
          deliveries: { select: { createdBy: { select: { name: true } } }, take: 1 },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
    ]);

  const userName = (order: (typeof ordersResult)[number]): string | null => {
    if (order.tableSession?.waiter?.name) return order.tableSession.waiter.name;
    if (order.deliveries[0]?.createdBy?.name) return order.deliveries[0].createdBy.name;
    return null;
  };

  const orders = ordersResult.map((order) => ({
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

  const total = await prisma.customerOrder.count({ where: salesWhere(auth.tenant.id, period, filters) });

  return new Response(
    JSON.stringify(
      serialize({
        kpis,
        evolution,
        byWeekday,
        byHour,
        byPaymentMethod,
        bySource,
        byChannel,
        cancellations,
        orders,
        meta: { page, pageSize: PAGE_SIZE, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) },
      }),
    ),
    { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } },
  );
}
