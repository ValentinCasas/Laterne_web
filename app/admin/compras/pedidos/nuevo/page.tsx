import { requirePermission } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { ComprasNuevoPedidoClient } from "./client";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const context = await requirePermission("purchase.manage");
  return { title: `${context.tenant.name} | Nuevo pedido de compra` };
}

export default async function NuevoPedidoPage() {
  const context = await requirePermission("purchase.manage");
  const activeBranchId = context.activeBranchId && context.activeBranchId > 0 ? context.activeBranchId : null;

  const [suppliers, branches, products] = await Promise.all([
    prisma.supplier.findMany({
      where: { tenantId: context.tenant.id, status: "active" },
      select: { id: true, name: true, code: true, paymentTerms: true, currency: true },
      orderBy: { name: "asc" },
    }),
    prisma.branch.findMany({
      where: { id: { in: context.branches.map((b) => b.id) } },
      select: { id: true, name: true, slug: true },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
    prisma.product.findMany({
      where: { tenantId: context.tenant.id },
      select: { id: true, name: true, cost: true, costUnit: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
  ]);

  return (
    <ComprasNuevoPedidoClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      suppliers={serialize(suppliers) as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      branches={serialize(branches) as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      products={serialize(products) as any}
      activeBranchId={activeBranchId}
    />
  );
}
