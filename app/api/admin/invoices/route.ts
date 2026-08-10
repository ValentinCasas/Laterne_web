import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const invoiceInput = z.object({ orderId: z.coerce.number().int().positive() });

/** @summary Crea un comprobante interno desde un pedido sin presentarlo como factura fiscal electrónica. */
export async function POST(request: Request) {
  const auth = await authorize("order.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = invoiceInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  const order = await prisma.customerOrder.findFirst({
    where: { id: parsed.data.orderId, tenantId: auth.tenant.id },
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
      number: `INT-${order.reference}`,
      customerName: order.customerName,
      subtotal: order.subtotal,
      tax: 0,
      total: order.total,
      currency: order.currency,
      notes: "Comprobante interno no fiscal",
    },
    include: { order: true, branch: true },
  });
  await recordAudit({
    context: auth,
    action: "invoice.create",
    entityType: "invoice",
    entityId: invoice.id,
    newValues: toAuditValue(invoice),
    request,
  });
  return NextResponse.json({ invoice }, { status: 201 });
}
