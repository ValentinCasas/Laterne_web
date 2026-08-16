/**
 * Comanda estructurada de MenuClick.
 *
 * La comanda es un documento de trabajo independiente del formato físico de
 * impresión: guarda qué se pidió (pedido, mesa, camarero, productos con
 * modificadores y notas, fechas) sin conocer drivers ni plantillas. Los futuros
 * proveedores de impresión reciben exactamente esta estructura.
 */

export type ComandaExtra = {
  name: string;
  /** Precio del agregado cuando el pedido lo registró. */
  price?: number;
};

export type ComandaItem = {
  productName: string;
  quantity: number;
  variantName: string | null;
  extras: ComandaExtra[];
  notes: string | null;
};

export type ComandaData = {
  orderId: number;
  reference: string;
  orderType: string;
  customerName: string;
  table: { name: string; sector: string | null } | null;
  waiter: string | null;
  items: ComandaItem[];
  notes: string | null;
  /** Momento en que ingresó el pedido (ISO 8601). */
  createdAt: string;
  /** Momento solicitado de entrega, si existe (ISO 8601). */
  requestedAt: string | null;
};

/** @summary Subconjunto de CustomerOrder que necesita el armado de la comanda. */
export type ComandaOrderInput = {
  id: number;
  reference: string;
  orderType: string;
  customerName: string;
  notes: string | null;
  createdAt: Date;
  requestedAt: Date | null;
  table: { name: string; sector: string | null } | null;
  tableSession: { waiter: { name: string } | null } | null;
  items: Array<{
    productName: string;
    quantity: number;
    variantName: string | null;
    extras: unknown;
    notes: string | null;
  }>;
};

/** @summary Normaliza el JSON de agregados de una línea en una lista estable de extras. */
export function comandaExtras(value: unknown): ComandaExtra[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((extra) => {
    if (typeof extra !== "object" || extra === null) return [];
    const record = extra as { name?: unknown; price?: unknown };
    if (typeof record.name !== "string" || !record.name.trim()) return [];
    const price = Number(record.price);
    return [{ name: record.name.trim(), ...(Number.isFinite(price) && price !== 0 ? { price } : {}) }];
  });
}

/** @summary Construye la comanda estructurada de un pedido real, sin tocar la base de datos. */
export function buildComandaData(order: ComandaOrderInput): ComandaData {
  return {
    orderId: order.id,
    reference: order.reference,
    orderType: order.orderType,
    customerName: order.customerName,
    table: order.table
      ? { name: order.table.name, sector: order.table.sector?.trim() || null }
      : null,
    waiter: order.tableSession?.waiter?.name ?? null,
    items: order.items.map((item) => ({
      productName: item.productName,
      quantity: item.quantity,
      variantName: item.variantName,
      extras: comandaExtras(item.extras),
      notes: item.notes?.trim() || null,
    })),
    notes: order.notes?.trim() || null,
    createdAt: order.createdAt.toISOString(),
    requestedAt: order.requestedAt ? order.requestedAt.toISOString() : null,
  };
}
