import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { createPurchaseInvoice, listPurchaseInvoices } from "@/lib/purchases";

const invoiceLineInput = z.object({
  productId: z.coerce.number().int().positive().nullable().optional(),
  description: z.string().trim().min(1).max(200),
  quantity: z.coerce.number().positive(),
  unit: z.string().trim().max(40).default("unidad"),
  unitCost: z.coerce.number().min(0),
  discountPercent: z.coerce.number().min(0).max(100).optional().default(0),
  taxPercent: z.coerce.number().min(0).max(100).optional().default(0),
});

const invoiceInput = z.object({
  supplierId: z.coerce.number().int().positive(),
  branchId: z.coerce.number().int().positive().nullable().optional(),
  orderId: z.coerce.number().int().positive().nullable().optional(),
  receiptIds: z.array(z.coerce.number().int().positive()).optional(),
  documentDate: z.string().optional(),
  dueDate: z.string().nullable().optional(),
  externalNumber: z.string().trim().max(120).optional(),
  financialCategory: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(2000).optional(),
  attachmentId: z.coerce.number().int().positive().nullable().optional(),
  items: z.array(invoiceLineInput).min(1),
});

/** @summary Lista facturas de compra con filtros. */
export async function GET(request: Request) {
  const auth = await authorize("purchase.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const url = new URL(request.url);
  const result = await listPurchaseInvoices(auth.tenant.id, {
    branchId: url.searchParams.get("branchId") ? Number(url.searchParams.get("branchId")) : null,
    supplierId: url.searchParams.get("supplierId") ? Number(url.searchParams.get("supplierId")) : null,
    status: url.searchParams.get("status") || undefined,
    query: url.searchParams.get("q") || undefined,
    from: url.searchParams.get("from") || undefined,
    to: url.searchParams.get("to") || undefined,
    limit: Number(url.searchParams.get("limit") ?? 60),
    offset: Number(url.searchParams.get("offset") ?? 0),
  });
  return NextResponse.json(serialize(result));
}

/** @summary Crea una factura de compra (opcionalmente vinculada a recepciones). */
export async function POST(request: Request) {
  const auth = await authorize("purchase.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = invoiceInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisá los datos de la factura" }, { status: 400 });

  try {
    const invoice = await createPurchaseInvoice(auth.tenant.id, auth.session.userId, {
      supplierId: parsed.data.supplierId,
      branchId: parsed.data.branchId ?? null,
      orderId: parsed.data.orderId ?? null,
      receiptIds: parsed.data.receiptIds ?? [],
      documentDate: parsed.data.documentDate,
      dueDate: parsed.data.dueDate,
      externalNumber: parsed.data.externalNumber,
      financialCategory: parsed.data.financialCategory,
      notes: parsed.data.notes,
      attachmentId: parsed.data.attachmentId ?? null,
      items: parsed.data.items.map((line) => ({ ...line, unit: line.unit || "unidad" })),
    });
    await recordAudit({
      context: auth,
      action: "create",
      entityType: "purchase-invoice",
      entityId: invoice.id,
      newValues: toAuditValue(serialize(invoice)),
      request,
    });
    return NextResponse.json({ item: serialize(invoice) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo crear la factura" },
      { status: error instanceof Error && "status" in error ? (error as { status?: number }).status ?? 400 : 400 },
    );
  }
}
