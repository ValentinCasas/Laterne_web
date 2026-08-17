import { authorize } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/format";
import { resolvePeriod } from "@/lib/reports/period";

/** @summary Comparativa entre sucursales. */
export async function GET(request: Request) {
  const auth = await authorize("analytics.read");
  if (!auth) return new Response("No autorizado", { status: 403 });

  const url = new URL(request.url);
  const rawFrom = url.searchParams.get("from");
  const rawTo = url.searchParams.get("to");

  if (!auth.allBranches && auth.branches.length <= 1) {
    return new Response(JSON.stringify(serialize({ branches: [] })), {
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }

  const period = resolvePeriod({ from: rawFrom || undefined, to: rawTo || undefined });

  const accessibleBranchIds = auth.branches.map((b) => b.id);
  const where = {
    tenantId: auth.tenant.id,
    status: { not: "cancelled" as const },
    createdAt: { gte: period.from, lte: period.to },
    ...(accessibleBranchIds.length > 0 ? { branchId: { in: accessibleBranchIds } } : {}),
  };

  const orders = await prisma.customerOrder.findMany({
    where,
    select: {
      branchId: true,
      branch: { select: { id: true, name: true } },
      total: true,
      discount: true,
      channel: true,
    },
  });

  const grouped = new Map<number, { name: string; total: number; discount: number; count: number; byChannel: Record<string, number> }>();
  let grandTotal = 0;

  for (const order of orders) {
    if (!order.branch) continue;
    const bid = order.branch.id;
    const current = grouped.get(bid) || { name: order.branch.name, total: 0, discount: 0, count: 0, byChannel: {} };
    current.total += Number(order.total);
    current.discount += Number(order.discount);
    current.count += 1;
    current.byChannel[order.channel] = (current.byChannel[order.channel] || 0) + Number(order.total);
    grouped.set(bid, current);
    grandTotal += Number(order.total);
  }

  const branches = [...grouped.entries()]
    .map(([branchId, values]) => ({
      branchId,
      branchName: values.name,
      netSales: values.total - values.discount,
      orderCount: values.count,
      averageTicket: values.count > 0 ? (values.total - values.discount) / values.count : 0,
      discounts: values.discount,
      participation: grandTotal > 0 ? ((values.total - values.discount) / grandTotal) * 100 : 0,
      byChannel: values.byChannel,
    }))
    .sort((a, b) => b.netSales - a.netSales);

  return new Response(
    JSON.stringify(serialize({ branches })),
    { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } },
  );
}
