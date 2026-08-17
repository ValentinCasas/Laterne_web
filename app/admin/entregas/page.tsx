import { DeliveryManager, type OrderDeliveryData } from "@/components/admin/delivery-manager";
import { requirePermission } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ orderId?: string }>;

/** @summary Carga las entregas de un pedido o la lista global según el contexto. */
export default async function DeliveriesPage({ searchParams }: { searchParams: SearchParams }) {
  const context = await requirePermission("order.manage");
  const { orderId } = await searchParams;
  const activeId = context.activeBranchId && context.activeBranchId > 0 ? context.activeBranchId : null;
  const branchScope = activeId
    ? { branchId: activeId }
    : { branchId: { in: context.branches.map((branch) => branch.id) } };

  let deliveries: OrderDeliveryData[] = [];
  if (orderId) {
    const id = Number(orderId);
    if (Number.isInteger(id) && id > 0) {
      const found = await prisma.orderDelivery.findMany({
        where: { orderId: id, tenantId: context.tenant.id, ...branchScope },
        include: {
          items: { include: { product: { select: { name: true, imageUrl: true } } } },
          customer: { select: { name: true, email: true, phone: true } },
          branch: { select: { name: true } },
          createdBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      deliveries = serialize(found) as unknown as OrderDeliveryData[];
    }
  } else {
    const found = await prisma.orderDelivery.findMany({
      where: { tenantId: context.tenant.id, ...branchScope },
      include: {
        items: { include: { product: { select: { name: true, imageUrl: true } } } },
        customer: { select: { name: true, email: true, phone: true } },
        branch: { select: { name: true } },
        createdBy: { select: { name: true } },
        order: { select: { reference: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    deliveries = serialize(found) as unknown as OrderDeliveryData[];
  }

  return <DeliveryManager initialDeliveries={deliveries} orderId={orderId ? Number(orderId) : undefined} />;
}
