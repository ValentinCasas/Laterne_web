import { requirePermission } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { ComprasAlbaranDetailClient, type AlbaranDetail } from "./client";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const context = await requirePermission("purchase.manage");
  const { id } = await params;
  try {
    const receipt = await prisma.purchaseReceipt.findFirst({
      where: { id: Number(id), tenantId: context.tenant.id },
      select: { number: true },
    });
    return { title: `${context.tenant.name} | ${receipt?.number ?? "Albarán"}` };
  } catch {
    return { title: `${context.tenant.name} | Albarán` };
  }
}

export default async function AlbaranDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await requirePermission("purchase.manage");
  const { id } = await params;
  const receipt = await prisma.purchaseReceipt.findFirst({
    where: { id: Number(id), tenantId: context.tenant.id },
    include: {
      supplier: { select: { id: true, name: true, paymentTerms: true } },
      branch: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      order: { select: { id: true, number: true, status: true } },
      items: {
        include: {
          product: { select: { id: true, name: true } },
          orderItem: {
            select: {
              id: true,
              quantity: true,
              receivedQuantity: true,
              invoicedQuantity: true,
              unit: true,
              unitCost: true,
              sortOrder: true,
              product: { select: { id: true, name: true } },
              order: { select: { id: true, number: true } },
            },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
      invoices: {
        include: {
          invoice: {
            select: {
              id: true,
              number: true,
              status: true,
              total: true,
              paidAmount: true,
              documentDate: true,
            },
          },
        },
      },
    },
  });

  if (!receipt) {
    return <div className="p-8 text-center text-[var(--admin-muted)]">Albarán no encontrado.</div>;
  }

  return (
    <ComprasAlbaranDetailClient receipt={serialize(receipt) as unknown as AlbaranDetail} currency="ARS" />
  );
}
