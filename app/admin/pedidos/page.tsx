import { OrderBoard, type AdminOrder } from "@/components/admin/order-board";
import { requirePermission } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { ACTIVE_DELIVERY_STATUSES } from "@/lib/delivery-orders";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
/**
 * @summary Genera los metadatos de la vista para el tenant autorizado.
 */
export async function generateMetadata(): Promise<Metadata> {
  const context = await requirePermission("order.manage");
  return { title: `${context.tenant.name} | Pedidos` };
}

/** @summary Carga los pedidos usando exclusivamente el contexto de tenant y sucursal de la URL canónica. */
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
  const deliveries = await prisma.orderDelivery.findMany({
    where: {
      tenantId: context.tenant.id,
      orderId: { in: orders.map((order) => order.id) },
      status: { in: [...ACTIVE_DELIVERY_STATUSES] },
    },
    select: {
      orderId: true,
      id: true,
      number: true,
      status: true,
      driverProfile: { select: { name: true } },
    },
  });
  const deliveryByOrderId = new Map(deliveries.map((delivery) => [delivery.orderId, delivery]));
  const ordersWithDelivery = publicOrders.map((order) => ({
    ...order,
    delivery: deliveryByOrderId.get(order.id) ?? null,
  }));
  return <OrderBoard initialOrders={serialize(ordersWithDelivery) as unknown as AdminOrder[]} />;
}
