import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { PurchaseError } from "@/lib/purchases";

/** @summary Detalle completo de un albarán de compra registrado. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("purchase.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { id } = await params;
  try {
    const receipt = await prisma.purchaseReceipt.findFirst({
      where: { id: Number(id), tenantId: auth.tenant.id },
      include: {
        supplier: { select: { id: true, name: true, paymentTerms: true } },
        branch: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        order: {
          select: { id: true, number: true, status: true },
        },
        items: {
          include: {
            product: { select: { id: true, name: true, cost: true, costUnit: true } },
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
                externalNumber: true,
              },
            },
          },
        },
      },
    });
    if (!receipt) throw new PurchaseError("El albarán no existe", 404);
    return NextResponse.json(serialize(receipt));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar el albarán" },
      { status: error instanceof PurchaseError ? error.status : 404 },
    );
  }
}
