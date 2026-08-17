import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { loyaltyTier } from "@/lib/loyalty";
import { prisma } from "@/lib/prisma";

const customerInput = z.object({
  name: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(190).optional().nullable(),
  phone: z.string().trim().max(60).optional().nullable(),
  address: z.string().trim().max(255).optional().nullable(),
  paymentTerms: z.string().trim().max(80).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

const pointsInput = z.object({
  points: z.coerce
    .number()
    .int()
    .min(-100_000)
    .max(100_000)
    .refine((value) => value !== 0),
  reason: z.string().trim().min(3).max(220),
});

/** @summary Devuelve la ficha completa del cliente: datos, pedidos recientes, entregas, pagos y movimientos de puntos. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("customer.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Cliente inválido" }, { status: 400 });
  const customer = await prisma.loyaltyCustomer.findFirst({
    where: { id, tenantId: auth.tenant.id, deletedAt: null },
    include: {
      orders: {
        select: {
          id: true,
          reference: true,
          status: true,
          orderType: true,
          total: true,
          currency: true,
          createdAt: true,
          branch: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      transactions: { orderBy: { createdAt: "desc" }, take: 30 },
      deliveries: {
        select: { id: true, number: true, status: true, deliveryDate: true, orderId: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      payments: {
        select: { id: true, number: true, amount: true, method: true, paidAt: true, status: true, orderId: true, deliveryId: true },
        orderBy: { paidAt: "desc" },
        take: 20,
      },
    },
  });
  if (!customer) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  return NextResponse.json({ customer: serialize(customer) });
}

/** @summary Actualiza datos del cliente o ajusta puntos según el cuerpo recibido. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("customer.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  const body = await request.json().catch(() => null);
  if (!Number.isInteger(id) || !body) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });

  const current = await prisma.loyaltyCustomer.findFirst({
    where: { id, tenantId: auth.tenant.id, deletedAt: null },
  });
  if (!current) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

  if (body.points !== undefined && body.reason) {
    const parsed = pointsInput.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Revisá puntos y motivo" }, { status: 400 });
    const nextPoints = Math.max(0, current.points + parsed.data.points);
    const customer = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.loyaltyCustomer.update({
        where: { id },
        data: { points: nextPoints, tier: loyaltyTier(nextPoints) },
      });
      await transaction.loyaltyTransaction.create({
        data: { customerId: id, points: nextPoints - current.points, reason: parsed.data.reason },
      });
      return updated;
    });
    await recordAudit({
      context: auth,
      action: "points-adjust",
      entityType: "loyalty-customer",
      entityId: id,
      oldValues: toAuditValue(serialize(current)),
      newValues: toAuditValue(serialize(customer)),
      request,
    });
    return NextResponse.json({ customer: serialize(customer) });
  }

  const parsed = customerInput.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const customer = await prisma.loyaltyCustomer.update({
    where: { id },
    data: {
      name: parsed.data.name,
      email: parsed.data.email ?? current.email,
      phone: parsed.data.phone ?? current.phone,
      address: parsed.data.address ?? current.address,
      paymentTerms: parsed.data.paymentTerms ?? current.paymentTerms,
    },
  });
  await recordAudit({
    context: auth,
    action: "customer-update",
    entityType: "loyalty-customer",
    entityId: id,
    oldValues: toAuditValue(serialize(current)),
    newValues: toAuditValue(serialize(customer)),
    request,
  });
  return NextResponse.json({ customer: serialize(customer) });
}
