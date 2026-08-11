import { OrderBoard, type AdminOrder } from "@/components/admin/order-board";
import { requirePermission } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> { const context = await requirePermission("order.manage"); return { title: `${context.tenant.name} | Pedidos` }; }

/** @summary Carga los pedidos recientes del negocio para su gestión operativa por estados. */
export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ branchId?: string }> }) {
  const context = await requirePermission("order.manage");
  const requestedBranchId = Number((await searchParams).branchId);
  const branchIds = context.branches.map((branch) => branch.id);
  const selectedBranchId = branchIds.includes(requestedBranchId) ? requestedBranchId : null;
  const orders = await prisma.customerOrder.findMany({
     where: { tenantId: context.tenant.id, ...(selectedBranchId ? { branchId: selectedBranchId } : { branchId: { in: branchIds } }) },
    include: { table: { select: { name: true, code: true } }, items: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return <OrderBoard initialOrders={serialize(orders) as unknown as AdminOrder[]} branches={context.branches} selectedBranchId={selectedBranchId} />;
}
