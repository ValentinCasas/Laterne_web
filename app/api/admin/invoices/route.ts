import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { documentTypes } from "@/lib/documents/document-fields";
import { generateInvoiceDocumentArtifact } from "@/lib/documents/invoice-document";
import { prisma } from "@/lib/prisma";

/**
 * @summary Valida la entrada relacionada con los comprobantes.
 */
const invoiceInput = z.object({
  orderId: z.coerce.number().int().positive(),
  deliveryId: z.coerce.number().int().positive().optional(),
  documentType: z.enum(documentTypes).default("internal_receipt"),
});

/**
 * @summary Construye las líneas snapshot de la factura.
 * Si se indicó una entrega/remito, las líneas reflejan las cantidades
 * efectivamente despachadas en ese remito; en caso contrario, las del pedido.
 */
function invoiceLines(
  items: Array<{
    id: number | null;
    productId: number | null;
    productName: string;
    quantity: number;
    unitPrice: Prisma.Decimal | number | string;
    variantName: string | null;
    variantPrice: Prisma.Decimal | number | string;
    extras: unknown;
    extrasTotal: Prisma.Decimal | number | string;
    notes: string | null;
    lineTotal: Prisma.Decimal | number | string;
    costSnapshot: Prisma.Decimal | number | string | null;
    deliveryItemId?: number | null;
  }>,
) {
  return items.map((item) => ({
    deliveryItemId: item.deliveryItemId ?? undefined,
    orderItemId: item.deliveryItemId ? undefined : item.id,
    productId: item.productId ?? undefined,
    productName: item.productName,
    descriptionSnapshot: item.productName,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    variantName: item.variantName,
    variantPrice: item.variantPrice,
    extras: item.extras ?? undefined,
    extrasTotal: item.extrasTotal,
    notes: item.notes,
    discount: 0,
    tax: 0,
    lineTotal: item.lineTotal,
    costSnapshot: item.costSnapshot ?? undefined,
  }));
}

/** @summary Crea un comprobante interno desde un pedido o remito sin presentarlo como factura fiscal electrónica. */
export async function POST(request: Request) {
  const auth = await authorize("order.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = invoiceInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  const order = await prisma.customerOrder.findFirst({
    where: {
      id: parsed.data.orderId,
      tenantId: auth.tenant.id,
      ...(auth.activeBranchId && auth.activeBranchId > 0 ? { branchId: auth.activeBranchId } : {}),
    },
    include: {
      invoice: true,
      items: true,
      deliveries: {
        where: { status: { in: ["ASSIGNED", "PICKED_UP", "ON_THE_WAY", "DELIVERED"] } },
        include: { items: true },
      },
    },
  });
  if (!order) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  if (order.invoice)
    return NextResponse.json({ error: "El pedido ya tiene un comprobante" }, { status: 409 });

  // Si se factura desde un remito, las líneas reflejan lo despachado en ese remito.
  let delivery = null;
  if (parsed.data.deliveryId) {
    delivery = order.deliveries.find((candidate) => candidate.id === parsed.data.deliveryId) ?? null;
    if (!delivery) return NextResponse.json({ error: "El remito no pertenece a este pedido" }, { status: 400 });
  }

  const lines = delivery
    ? invoiceLines(
        delivery.items.map((item) => ({
          id: item.orderItemId,
          deliveryItemId: item.id,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantityDelivered,
          unitPrice: item.unitPrice,
          variantName: null,
          variantPrice: 0,
          extras: undefined,
          extrasTotal: 0,
          notes: item.notes,
          lineTotal: Number(item.unitPrice) * item.quantityDelivered,
          costSnapshot: null,
        })),
      )
    : invoiceLines(order.items);

  const invoice = await prisma.invoiceRecord.create({
    data: {
      tenantId: auth.tenant.id,
      branchId: order.branchId,
      orderId: order.id,
      deliveryId: delivery?.id ?? undefined,
      documentType: parsed.data.documentType,
      number: `INT-${order.reference}`,
      customerName: order.customerName,
      subtotal: order.subtotal,
      tax: 0,
      total: order.total,
      currency: order.currency,
      notes: "Comprobante interno no fiscal",
      items: { create: lines },
    },
    include: { order: true, branch: true, document: true, items: true },
  });
  let document = null;
  let documentError: string | null = null;
  try {
    document = await generateInvoiceDocumentArtifact(invoice.id, auth.tenant.id);
  } catch (error) {
    documentError = error instanceof Error ? error.message : "No se pudo generar el archivo Word";
  }
  await recordAudit({
    context: auth,
    action: "invoice.create",
    entityType: "invoice",
    entityId: invoice.id,
    newValues: toAuditValue(invoice),
    request,
  });
  const documentSummary = document
    ? {
        pdfStatus: document.pdfStatus,
        conversionMessage: document.conversionMessage,
        templateVersion: document.templateVersion,
      }
    : null;
  return NextResponse.json(
    { invoice: { ...invoice, document: documentSummary }, documentError },
    { status: 201 },
  );
}
