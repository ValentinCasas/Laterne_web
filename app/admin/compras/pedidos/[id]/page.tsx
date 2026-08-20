import { requirePermission } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { loadPurchaseOrder } from "@/lib/purchases";
import { ComprasPedidoDetailClient } from "./client";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const context = await requirePermission("purchase.manage");
  const { id } = await params;
  try {
    const order = await loadPurchaseOrder(context.tenant.id, Number(id));
    return { title: `${context.tenant.name} | ${order.number}` };
  } catch {
    return { title: `${context.tenant.name} | Pedido` };
  }
}

export default async function PedidoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await requirePermission("purchase.manage");
  const { id } = await params;
  const order = await loadPurchaseOrder(context.tenant.id, Number(id));

  return (
    <ComprasPedidoDetailClient
      order={serialize(order) as any}
      currency="ARS"
    />
  );
}
