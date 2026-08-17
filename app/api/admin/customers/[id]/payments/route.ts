import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/format";

const paymentInput = z.object({
  amount: z.coerce.number().positive(),
  method: z.string().trim().min(2).max(40).default("efectivo"),
  paidAt: z.coerce.date().optional(),
  notes: z.string().trim().max(240).optional(),
  orderId: z.number().int().positive().optional(),
  deliveryId: z.number().int().positive().optional(),
});

/**
 * @summary Registra un pago de cliente contra un pedido, entrega o cuenta corriente.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("order.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const customerId = Number((await context.params).id);
  const parsed = paymentInput.safeParse(await request.json().catch(() => null));
  if (!Number.isInteger(customerId) || !parsed.success)
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });

  if (!parsed.data.orderId && !parsed.data.deliveryId) {
    return NextResponse.json({ error: "Tenés que indicar un pedido o una entrega" }, { status: 400 });
  }

  const customer = await prisma.loyaltyCustomer.findFirst({
    where: { id: customerId, tenantId: auth.tenant.id, deletedAt: null },
  });
  if (!customer) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

  const number = `PAG-${Date.now().toString(36).toUpperCase()}`;
  const payment = await prisma.$transaction(async (transaction) => {
    const created = await transaction.customerPayment.create({
      data: {
        tenantId: auth.tenant.id,
        customerId,
        orderId: parsed.data.orderId ?? undefined,
        deliveryId: parsed.data.deliveryId ?? undefined,
        number,
        amount: parsed.data.amount,
        method: parsed.data.method,
        paidAt: parsed.data.paidAt ?? new Date(),
        notes: parsed.data.notes ?? undefined,
        createdById: auth.session.userId,
      },
    });

    const newBalance = Number(customer.currentBalance) - parsed.data.amount;
    await transaction.loyaltyCustomer.update({
      where: { id: customerId },
      data: { currentBalance: Math.max(0, newBalance) },
    });

    return created;
  });

  await recordAudit({
    context: auth,
    action: "customer-payment",
    entityType: "customer-payment",
    entityId: payment.id,
    oldValues: toAuditValue({ customerId, previousBalance: customer.currentBalance }),
    newValues: toAuditValue({ ...payment, previousBalance: customer.currentBalance }),
    request,
  });

  return NextResponse.json({ payment }, { status: 201 });
}

/**
 * @summary Devuelve el saldo y los últimos pagos del cliente.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("customer.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const customerId = Number((await context.params).id);
  if (!Number.isInteger(customerId)) return NextResponse.json({ error: "Cliente inválido" }, { status: 400 });

  const customer = await prisma.loyaltyCustomer.findFirst({
    where: { id: customerId, tenantId: auth.tenant.id, deletedAt: null },
    select: { id: true, name: true, currentBalance: true, currency: true },
  });
  if (!customer) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

  const payments = await prisma.customerPayment.findMany({
    where: { customerId, tenantId: auth.tenant.id },
    include: { order: { select: { reference: true } }, delivery: { select: { number: true } } },
    orderBy: { paidAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ customer, payments: serialize(payments) });
}
