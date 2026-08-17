import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize, canAccessBranch } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/format";

const deliveryItemInput = z.object({
  orderItemId: z.number().int().positive(),
  quantityDelivered: z.number().int().positive(),
  notes: z.string().trim().max(500).optional(),
});

const createDeliveryInput = z.object({
  deliveryDate: z.coerce.date().optional(),
  deliveryType: z.enum(["full", "partial"]).default("full"),
  notes: z.string().trim().max(500).optional(),
  items: z.array(deliveryItemInput).min(1),
});

/**
 * @summary Crea una entrega/remito a partir de un pedido, validando cantidades pendientes y sucursal.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("order.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  const parsed = createDeliveryInput.safeParse(await request.json().catch(() => null));
  if (!Number.isInteger(id) || !parsed.success)
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });

  const order = await prisma.customerOrder.findFirst({
    where: { id, tenantId: auth.tenant.id },
    include: { items: true, branch: true },
  });
  if (!order) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  if (order.branchId && !canAccessBranch(auth, order.branchId)) {
    return NextResponse.json({ error: "No tenés acceso a la sucursal de este pedido" }, { status: 403 });
  }

  const itemMap = new Map(order.items.map((item) => [item.id, item]));
  for (const item of parsed.data.items) {
    const source = itemMap.get(item.orderItemId);
    if (!source) return NextResponse.json({ error: `Línea ${item.orderItemId} no pertenece al pedido` }, { status: 400 });
    const pending = source.quantity - source.deliveredQuantity;
    if (item.quantityDelivered > pending) {
      return NextResponse.json(
        { error: `La entrega supera lo pendiente para "${source.productName}" (pendiente: ${pending})` },
        { status: 400 },
      );
    }
  }

  const number = `ENT-${Date.now().toString(36).toUpperCase()}`;
  const delivery = await prisma.$transaction(async (transaction) => {
    const created = await transaction.orderDelivery.create({
      data: {
        tenantId: auth.tenant.id,
        orderId: id,
        number,
        deliveryDate: parsed.data.deliveryDate ?? new Date(),
        branchId: order.branchId ?? undefined,
        customerId: order.customerId ?? undefined,
        customerName: order.customerName,
        deliveryAddress: order.deliveryAddress ?? undefined,
        deliveryType: parsed.data.deliveryType,
        notes: parsed.data.notes ?? undefined,
        createdById: auth.session.userId,
        items: {
          create: parsed.data.items.map((item) => ({
            orderItemId: item.orderItemId,
            productId: itemMap.get(item.orderItemId)?.productId ?? undefined,
            productName: itemMap.get(item.orderItemId)?.productName ?? "",
            quantityDelivered: item.quantityDelivered,
            unitPrice: itemMap.get(item.orderItemId)?.unitPrice ?? 0,
            notes: item.notes ?? undefined,
          })),
        },
      },
      include: { items: true },
    });

    for (const item of parsed.data.items) {
      const source = itemMap.get(item.orderItemId)!;
      await transaction.orderItem.update({
        where: { id: item.orderItemId },
        data: {
          deliveredQuantity: source.deliveredQuantity + item.quantityDelivered,
          pendingQuantity: source.quantity - (source.deliveredQuantity + item.quantityDelivered),
        },
      });
    }

    const allDelivered = order.items.every((orderItem) => {
      const delivered = orderItem.deliveredQuantity + (parsed.data.items.find((i) => i.orderItemId === orderItem.id)?.quantityDelivered ?? 0);
      return delivered >= orderItem.quantity;
    });
    if (allDelivered && parsed.data.deliveryType === "full") {
      await transaction.customerOrder.updateMany({
        where: { id, tenantId: auth.tenant.id, status: { not: "delivered" } },
        data: { status: "delivered" },
      });
      await transaction.orderStatusHistory.create({
        data: { orderId: id, userId: auth.session.userId, toStatus: "delivered", note: "Entrega completa registrada" },
      });
    }

    return created;
  });

  await recordAudit({
    context: auth,
    action: "delivery-create",
    entityType: "order-delivery",
    entityId: delivery.id,
    oldValues: toAuditValue(null),
    newValues: toAuditValue({ ...delivery, orderReference: order.reference }),
    request,
  });

  return NextResponse.json({ delivery }, { status: 201 });
}

/**
 * @summary Lista las entregas de un pedido.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("order.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });

  const order = await prisma.customerOrder.findFirst({
    where: { id, tenantId: auth.tenant.id },
    select: { id: true, branchId: true },
  });
  if (!order) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  if (order.branchId && !canAccessBranch(auth, order.branchId)) {
    return NextResponse.json({ error: "No tenés acceso a la sucursal de este pedido" }, { status: 403 });
  }

  const deliveries = await prisma.orderDelivery.findMany({
    where: { orderId: id, tenantId: auth.tenant.id },
    include: { items: true, customer: { select: { name: true, email: true, phone: true } }, branch: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ deliveries: serialize(deliveries) });
}
