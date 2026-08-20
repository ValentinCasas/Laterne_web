import { requirePermission } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { loadPurchaseInvoice } from "@/lib/purchases";
import { ComprasFacturaDetailClient } from "./client";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const context = await requirePermission("purchase.manage");
  const { id } = await params;
  try {
    const invoice = await loadPurchaseInvoice(context.tenant.id, Number(id));
    return { title: `${context.tenant.name} | ${invoice.number}` };
  } catch {
    return { title: `${context.tenant.name} | Factura` };
  }
}

export default async function FacturaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await requirePermission("purchase.manage");
  const { id } = await params;
  const invoice = await loadPurchaseInvoice(context.tenant.id, Number(id));

  return (
    <ComprasFacturaDetailClient
      invoice={serialize(invoice) as any}
      currency="ARS"
    />
  );
}
