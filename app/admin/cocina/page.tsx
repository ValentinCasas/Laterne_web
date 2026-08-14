import { KitchenBoard, type KitchenOrder } from "@/components/admin/kitchen-board";
import { requirePermission } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> { const context = await requirePermission("order.manage"); return { title: `${context.tenant.name} | Cocina` }; }

/** @summary Carga los pedidos activos que necesita preparar la cocina en el scope actual. */
export default async function AdminKitchenPage() {
  const context = await requirePermission("order.manage");
  const branchIds = context.branches.map((branch) => branch.id);
  const activeId = context.activeBranchId && context.activeBranchId > 0 ? context.activeBranchId : null;
  const orders = await prisma.customerOrder.findMany({
    where: {
      tenantId: context.tenant.id,
      status: { in: ["received", "confirmed", "preparing"] },
      ...(activeId ? { branchId: activeId } : { branchId: { in: branchIds } }),
    },
    include: {
      table: { select: { name: true, code: true } },
      items: true,
    },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  return <KitchenBoard initialOrders={serialize(orders) as unknown as KitchenOrder[]} />;
}
