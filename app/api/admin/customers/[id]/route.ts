import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { loyaltyTier } from "@/lib/loyalty";
import { prisma } from "@/lib/prisma";

const pointsInput = z.object({
  points: z.coerce
    .number()
    .int()
    .min(-100_000)
    .max(100_000)
    .refine((value) => value !== 0),
  reason: z.string().trim().min(3).max(220),
});

/** @summary Devuelve la ficha completa del cliente: datos, pedidos recientes y movimientos de puntos. */
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
    },
  });
  if (!customer) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  return NextResponse.json({ customer: serialize(customer) });
}

/** @summary Ajusta puntos con un movimiento explícito, saldo no negativo y auditoría. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("customer.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  const parsed = pointsInput.safeParse(await request.json().catch(() => null));
  if (!Number.isInteger(id) || !parsed.success)
    return NextResponse.json({ error: "Revisá puntos y motivo" }, { status: 400 });
  const current = await prisma.loyaltyCustomer.findFirst({
    where: { id, tenantId: auth.tenant.id, deletedAt: null },
  });
  if (!current) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
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
