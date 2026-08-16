import { NextResponse } from "next/server";
import { z } from "zod";
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
  documentType: z.enum(documentTypes).default("internal_receipt"),
});

/** @summary Crea un comprobante interno desde un pedido sin presentarlo como factura fiscal electrónica. */
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
    include: { invoice: true },
  });
  if (!order) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  if (order.invoice)
    return NextResponse.json({ error: "El pedido ya tiene un comprobante" }, { status: 409 });
  const invoice = await prisma.invoiceRecord.create({
    data: {
      tenantId: auth.tenant.id,
      branchId: order.branchId,
      orderId: order.id,
      documentType: parsed.data.documentType,
      number: `INT-${order.reference}`,
      customerName: order.customerName,
      subtotal: order.subtotal,
      tax: 0,
      total: order.total,
      currency: order.currency,
      notes: "Comprobante interno no fiscal",
    },
    include: { order: true, branch: true, document: true },
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
