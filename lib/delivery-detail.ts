import type { Prisma } from "@prisma/client";

/**
 * Include canónico del detalle de una entrega. Toda la API del módulo Delivery
 * (lista, carga inicial, asignación, cambio de estado) responde el mismo shape
 * para que el cliente jamás reciba una entrega sin `items`, `order` o `branch`.
 */
export const deliveryDetailInclude = {
  order: {
    select: {
      id: true,
      reference: true,
      status: true,
      orderType: true,
      channel: true,
      source: true,
      total: true,
      customerName: true,
      phone: true,
      requestedAt: true,
    },
  },
  branch: { select: { id: true, name: true } },
  driver: { select: { id: true, name: true } },
  driverProfile: { select: { id: true, name: true, phone: true, user: { select: { imageUrl: true } } } },
  items: {
    select: {
      id: true,
      orderItemId: true,
      productName: true,
      quantityDelivered: true,
      unitPrice: true,
    },
  },
  statusLogs: {
    orderBy: { changedAt: "desc" },
    take: 40,
    select: {
      id: true,
      status: true,
      previousStatus: true,
      reason: true,
      changedAt: true,
      driverProfile: { select: { id: true, name: true } },
      changedBy: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.OrderDeliveryInclude;

/**
 * Contrato serializado (luego de `serialize()`) que devuelve la API de entregas.
 * Es el tipo del centro de delivery y del tablero de pedidos.
 */
export type DeliveryDetail = {
  id: number;
  number: string;
  status: string;
  provider: string;
  externalOrderId?: string | null;
  deliveryType: string;
  deliveryDate: string | Date;
  createdAt: string | Date;
  customerName: string;
  deliveryAddress?: string | null;
  contactPhone?: string | null;
  contactName?: string | null;
  instructions?: string | null;
  receiverName?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  notes?: string | null;
  assignedAt?: string | Date | null;
  pickedUpAt?: string | Date | null;
  deliveredAt?: string | Date | null;
  driver?: { id: number; name: string } | null;
  driverProfile?: {
    id: number;
    name: string;
    phone?: string | null;
    user?: { imageUrl?: string | null } | null;
  } | null;
  branch?: { id: number; name: string } | null;
  order?: {
    id: number;
    reference: string;
    status: string;
    orderType: string;
    channel: string;
    source: string;
    total: string | number | object;
    customerName: string;
    phone?: string | null;
    requestedAt?: string | Date | null;
  } | null;
  items: Array<{
    id: number;
    orderItemId: number;
    productName: string;
    quantityDelivered: number;
    unitPrice: string | number | object;
  }>;
  statusLogs: Array<{
    id: number;
    status: string;
    previousStatus?: string | null;
    reason?: string | null;
    changedAt: string | Date;
    driverProfile?: { id: number; name: string } | null;
    changedBy?: { id: number; name: string } | null;
  }>;
};

/** @summary Normaliza una entrega desde la API: garantiza `items` y `order` ante respuestas heredadas. */
export function normalizeDeliveryDetail(delivery: DeliveryDetail): DeliveryDetail {
  return {
    ...delivery,
    items: Array.isArray(delivery.items) ? delivery.items : [],
    statusLogs: Array.isArray(delivery.statusLogs) ? delivery.statusLogs : [],
    order: delivery.order ?? null,
  };
}
