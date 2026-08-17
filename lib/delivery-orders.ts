import { randomBytes } from "node:crypto";
import type { OrderDelivery, OrderDeliveryItem, Prisma, PrismaClient } from "@prisma/client";

/**
 * Integración automática entre pedidos y el módulo Delivery:
 * todo pedido con modalidad `delivery` genera una entrega SIN ASIGNAR al crearse.
 * Este archivo no importa `@/lib/prisma` para que también pueda usarse desde
 * scripts de reparación (Node con type stripping) sin resolver alias.
 */

/** @summary Modalidades de pedido que generan entrega automática. */
export const DELIVERY_ORDER_TYPES = new Set<string>(["delivery"]);

/** @summary Devuelve si la modalidad de un pedido requiere entrega automática. */
export function requiresDelivery(orderType: string | null | undefined): boolean {
  return DELIVERY_ORDER_TYPES.has((orderType ?? "").trim().toLowerCase());
}

/**
 * @summary Estados de entrega que representan una entrega vigente: bloquean la
 * creación de una segunda entrega para el mismo pedido y son los que se
 * cancelan cuando el pedido se cancela.
 */
export const ACTIVE_DELIVERY_STATUSES = new Set<string>([
  "PENDING_ASSIGNMENT",
  "ASSIGNED",
  "PICKED_UP",
  "ON_THE_WAY",
  "INCIDENT",
]);

/** @summary Estados de pedido que todavía admiten una entrega en curso. */
export const ORDER_STATUSES_WITH_DELIVERY = new Set<string>([
  "received",
  "confirmed",
  "preparing",
  "ready",
  "on_the_way",
]);

/**
 * @summary Lanza si el pedido tiene una entrega ya RETIRADA, EN CAMINO o en
 * INCIDENCIA. Un pedido no se puede cancelar en silencio con el repartidor en
 * la calle: primero hay que resolver la entrega. Debe llamarse dentro de la
 * transacción de cancelación para que el guard sea atómico.
 */
export async function assertOrderCancellable(
  client: Prisma.TransactionClient | PrismaClient,
  orderId: number,
  tenantId: number,
): Promise<void> {
  const rolling = await client.orderDelivery.findFirst({
    where: { orderId, tenantId, status: { in: ["PICKED_UP", "ON_THE_WAY", "INCIDENT"] } },
    select: { id: true },
  });
  if (rolling) throw new Error("DELIVERY_EN_ROUTE");
}

/** @summary Genera un número de remito/entrega con sufijo aleatorio para evitar colisiones. */
export function deliveryNumber(prefix = "ENT"): string {
  const safePrefix = prefix.replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 12) || "ENT";
  return `${safePrefix}-${Date.now().toString(36).toUpperCase()}${randomBytes(3).toString("hex").toUpperCase()}`;
}

/** @summary Datos del pedido que necesita la entrega automática. */
export type DeliveryOrderInput = {
  id: number;
  tenantId: number;
  branchId: number | null;
  customerId: number | null;
  customerName: string;
  deliveryAddress: string | null;
  items: Array<{
    id: number;
    productId: number | null;
    productName: string;
    unitPrice: number | Prisma.Decimal;
    quantity: number;
  }>;
};

export type DeliveryWithItems = OrderDelivery & { items: OrderDeliveryItem[] };

/**
 * @summary Garantiza que un pedido tenga exactamente una entrega SIN ASIGNAR.
 * Idempotente: si ya existe una entrega vigente para el pedido, la devuelve sin
 * crear nada (jamás dos entregas para el mismo pedido). Crea la entrega con sus
 * líneas a partir de los items del pedido y conserva tenantId/branchId/cliente.
 * Debe llamarse dentro de la misma transacción que crea el pedido.
 */
export async function ensureDeliveryForOrder(
  client: Prisma.TransactionClient | PrismaClient,
  order: DeliveryOrderInput,
  createdById?: number | null,
): Promise<DeliveryWithItems> {
  const existing = await client.orderDelivery.findFirst({
    where: {
      orderId: order.id,
      tenantId: order.tenantId,
      status: { in: [...ACTIVE_DELIVERY_STATUSES] },
    },
    orderBy: { createdAt: "asc" },
    include: { items: true },
  });
  if (existing) return existing;

  return client.orderDelivery.create({
    data: {
      tenantId: order.tenantId,
      orderId: order.id,
      number: deliveryNumber(),
      deliveryDate: new Date(),
      branchId: order.branchId ?? undefined,
      customerId: order.customerId ?? undefined,
      customerName: order.customerName,
      deliveryAddress: order.deliveryAddress ?? undefined,
      deliveryType: "full",
      provider: "MENUCLICK",
      status: "PENDING_ASSIGNMENT",
      createdById: createdById ?? undefined,
      items: {
        create: order.items.map((item) => ({
          orderItemId: item.id,
          productId: item.productId ?? undefined,
          productName: item.productName,
          quantityDelivered: item.quantity,
          unitPrice: item.unitPrice,
        })),
      },
    },
    include: { items: true },
  });
}