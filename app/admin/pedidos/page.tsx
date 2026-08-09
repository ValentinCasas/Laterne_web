import { OrderBoard, type AdminOrder } from "@/components/admin/order-board";
import { requirePermission } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** @summary Carga los pedidos recientes del negocio para su gestión operativa por estados. */
export default async function AdminOrdersPage() {
  const context = await requirePermission("order.manage");
  const orders = await prisma.customerOrder.findMany({
    where: { tenantId: context.tenant.id },
    include: { table: { select: { name: true, code: true } }, items: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return <OrderBoard initialOrders={serialize(orders) as unknown as AdminOrder[]} />;
}
