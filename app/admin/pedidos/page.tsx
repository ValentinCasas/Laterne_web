import { OrderBoard, type AdminOrder } from "@/components/admin/order-board";
import { requirePermission } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> { const context = await requirePermission("order.manage"); return { title: `${context.tenant.name} | Pedidos` }; }

/** @summary Carga los pedidos usando exclusivamente el scope tenant/branch de la URL canónica. */
export default async function AdminOrdersPage() {
  const context = await requirePermission("order.manage");
  const branchIds = context.branches.map((branch) => branch.id);
  const activeId = context.activeBranchId && context.activeBranchId > 0 ? context.activeBranchId : null;
  const orders = await prisma.customerOrder.findMany({
    where: {
      tenantId: context.tenant.id,
      ...(activeId ? { branchId: activeId } : { branchId: { in: branchIds } }),
    },
    include: {
      table: { select: { name: true, code: true } },
      items: true,
      branch: { select: { name: true, slug: true } },
      invoice: { select: { id: true, number: true, status: true } },
      history: { orderBy: { createdAt: "asc" } },
      idempotencies: { select: { token: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  const publicOrders = orders.map(({ idempotencies, ...order }) => ({
    ...order,
    trackingToken: idempotencies[0]?.token ?? null,
  }));
  return <OrderBoard initialOrders={serialize(publicOrders) as unknown as AdminOrder[]} />;
}
