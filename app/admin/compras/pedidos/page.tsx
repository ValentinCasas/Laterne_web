import { requirePermission } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { listPurchaseOrders } from "@/lib/purchases";
import { ComprasPedidosClient } from "./client";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const context = await requirePermission("purchase.manage");
  return { title: `${context.tenant.name} | Pedidos de compra` };
}

export default async function PedidosPage() {
  const context = await requirePermission("purchase.manage");
  const activeBranchId = context.activeBranchId && context.activeBranchId > 0 ? context.activeBranchId : null;
  const branchFilter = activeBranchId ? { branchId: activeBranchId } : {};
  const [orders, suppliers] = await Promise.all([
    listPurchaseOrders(context.tenant.id, { ...branchFilter, limit: 100 }),
    prisma.supplier.findMany({
      where: { tenantId: context.tenant.id, status: "active" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <ComprasPedidosClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialOrders={serialize(orders.items) as any}
      total={orders.total}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      suppliers={serialize(suppliers) as any}
    />
  );
}
