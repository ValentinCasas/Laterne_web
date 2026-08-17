import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { convertQuantity, type UnitConversionRow } from "@/lib/recipe-units";

/**
 * Servicio de Compras de MenuClick.
 *
 * Separa conceptualmente Pedido → Recepción → Factura → Pago. Crear un pedido
 * nunca toca inventario; solo la confirmación de una recepción física crea
 * movimientos reales (reutilizando `InventoryStock`/`StockMovement`). Las
 * facturas pueden vincularse a una o varias recepciones y, según la política
 * de costo del negocio, actualizar el costo actual del producto o quedarse
 * solo como costo histórico (nunca se reescriben snapshots de ventas pasadas).
 */

/** @summary Error de negocio de compras con código HTTP sugerido. */
export class PurchaseError extends Error {
  status: number;
  constructor(message: string, status = 409) {
    super(message);
    this.name = "PurchaseError";
    this.status = status;
  }
}

/** @summary Estados conceptuales de un pedido de compra. */
export const PURCHASE_ORDER_STATUSES = [
  "draft",
  "sent",
  "partially_received",
  "received",
  "closed",
  "cancelled",
] as const;

/** @summary Estados de una factura de compra. */
export const PURCHASE_INVOICE_STATUSES = ["draft", "pending", "partially_paid", "paid", "cancelled"] as const;

/** @summary Etiquetas legibles de los estados de pedido. */
export const purchaseOrderStatusLabels: Record<string, string> = {
  draft: "Borrador",
  sent: "Enviado",
  partially_received: "Recibido parcial",
  received: "Recibido",
  closed: "Cerrado",
  cancelled: "Cancelado",
};

/** @summary Etiquetas legibles de los estados de factura/gasto. */
export const purchaseInvoiceStatusLabels: Record<string, string> = {
  draft: "Borrador",
  pending: "Pendiente",
  partially_paid: "Parcialmente pagado",
  paid: "Pagado",
  cancelled: "Anulado",
};

/** @summary Medios de pago disponibles para facturas y gastos. */
export const PAYMENT_METHODS = ["transferencia", "efectivo", "tarjeta", "otro"] as const;

/**
 * @summary Genera el número secuencial del siguiente documento del tenant.
 * El incremento es atómico dentro de la transacción; ante una carrera en el
 * contador reintenta hasta tres veces.
 */
export async function nextDocumentNumber(
  client: Prisma.TransactionClient | typeof prisma,
  tenantId: number,
  prefix: string,
): Promise<string> {
  const safePrefix = prefix.replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 6) || "DOC";
  let attempts = 0;
  while (attempts < 3) {
    attempts += 1;
    try {
      const counter = await client.documentSequence.upsert({
        where: { tenantId_prefix: { tenantId, prefix: safePrefix } },
        create: { tenantId, prefix: safePrefix, lastValue: 0 },
        update: {},
      });
      const next = Number(counter.lastValue) + 1;
      await client.documentSequence.update({
        where: { id: counter.id },
        data: { lastValue: next },
      });
      return `${safePrefix}-${String(next).padStart(6, "0")}`;
    } catch (error) {
      // P2002: otra transacción creó el contador en paralelo; reintentar.
      if (attempts < 3 && error instanceof Error && "code" in error && (error as { code?: string }).code === "P2002") {
        continue;
      }
      throw error;
    }
  }
  throw new PurchaseError("No se pudo generar el número de documento", 409);
}

/** @summary Valida que el proveedor pertenezca al tenant y esté activo. */
export async function requireSupplier(tenantId: number, supplierId: number) {
  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, tenantId, active: true },
  });
  if (!supplier) throw new PurchaseError("El proveedor no existe o no está activo", 404);
  return supplier;
}

/** @summary Valida que una línea de pedido tenga cantidad y costo razonables. */
function validateOrderLine(line: { quantity: unknown; unitCost: unknown }) {
  const quantity = Number(line.quantity);
  const unitCost = Number(line.unitCost);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new PurchaseError("La cantidad pedida debe ser mayor a cero", 400);
  }
  if (!Number.isFinite(unitCost) || unitCost < 0) {
    throw new PurchaseError("El costo esperado no es válido", 400);
  }
  return { quantity, unitCost };
}

export type PurchaseOrderLineInput = {
  productId: number;
  quantity: number;
  unit: string;
  unitCost: number;
  discountPercent?: number;
  taxPercent?: number;
};

/**
 * @summary Crea un pedido de compra sin tocar inventario.
 * La numeración, el pedido y sus líneas se crean en una sola transacción.
 */
export async function createPurchaseOrder(
  tenantId: number,
  branchId: number,
  userId: number | null,
  input: {
    supplierId: number;
    orderDate?: string;
    expectedDate?: string | null;
    externalReference?: string;
    notes?: string;
    lines: PurchaseOrderLineInput[];
  },
) {
  if (!input.lines.length) throw new PurchaseError("Agregá al menos un producto al pedido", 400);
  await requireSupplier(tenantId, input.supplierId);
  const branch = await prisma.branch.findFirst({ where: { id: branchId, tenantId } });
  if (!branch) throw new PurchaseError("La sucursal no existe", 404);

  const normalized = input.lines.map((line) => ({ ...line, ...validateOrderLine(line) }));

  return prisma.$transaction(async (transaction) => {
    const number = await nextDocumentNumber(transaction, tenantId, "OC");
    const order = await transaction.purchaseOrder.create({
      data: {
        tenantId,
        branchId,
        supplierId: input.supplierId,
        number,
        status: "draft",
        orderDate: input.orderDate ? new Date(input.orderDate) : new Date(),
        expectedDate: input.expectedDate ? new Date(input.expectedDate) : null,
        externalReference: input.externalReference?.trim() || null,
        notes: input.notes?.trim() || null,
        createdById: userId,
        items: {
          create: normalized.map((line, index) => ({
            productId: line.productId,
            quantity: line.quantity,
            unit: line.unit || "unidad",
            unitCost: line.unitCost,
            discountPercent: line.discountPercent ?? 0,
            taxPercent: line.taxPercent ?? 0,
            sortOrder: index,
          })),
        },
      },
      include: { items: true, supplier: { select: { id: true, name: true } }, branch: { select: { id: true, name: true } } },
    });
    return order;
  });
}

/** @summary Recupera un pedido del tenant con sus relaciones completas. */
export async function loadPurchaseOrder(tenantId: number, orderId: number) {
  const order = await prisma.purchaseOrder.findFirst({
    where: { id: orderId, tenantId },
    include: {
      supplier: { select: { id: true, name: true, paymentTerms: true } },
      branch: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      items: {
        include: { product: { select: { id: true, name: true, cost: true, costUnit: true, imageUrl: true } } },
        orderBy: { sortOrder: "asc" },
      },
      receipts: {
        orderBy: { receivedAt: "desc" },
        include: {
          items: { include: { product: { select: { id: true, name: true } } }, orderBy: { sortOrder: "asc" } },
          createdBy: { select: { id: true, name: true } },
        },
      },
      invoices: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          number: true,
          status: true,
          total: true,
          documentDate: true,
          externalNumber: true,
        },
      },
    },
  });
  if (!order) throw new PurchaseError("El pedido no existe", 404);
  return order;
}

/** @summary Reemplaza las líneas de un pedido en Borrador. */
export async function updatePurchaseOrder(
  tenantId: number,
  orderId: number,
  input: {
    supplierId?: number;
    branchId?: number;
    orderDate?: string;
    expectedDate?: string | null;
    externalReference?: string;
    notes?: string;
    lines?: PurchaseOrderLineInput[];
  },
) {
  return prisma.$transaction(async (transaction) => {
    const order = await transaction.purchaseOrder.findFirst({ where: { id: orderId, tenantId } });
    if (!order) throw new PurchaseError("El pedido no existe", 404);
    if (order.status !== "draft") {
      throw new PurchaseError("Solo se pueden editar pedidos en Borrador", 409);
    }
    if (input.supplierId) await requireSupplier(tenantId, input.supplierId);

    const lines = input.lines?.map((line) => ({ ...line, ...validateOrderLine(line) }));
    if (lines && !lines.length) throw new PurchaseError("Agregá al menos un producto al pedido", 400);

    await transaction.purchaseOrderItem.deleteMany({ where: { orderId } });
    if (lines) {
      await transaction.purchaseOrderItem.createMany({
        data: lines.map((line, index) => ({
          orderId,
          productId: line.productId,
          quantity: line.quantity,
          unit: line.unit || "unidad",
          unitCost: line.unitCost,
          discountPercent: line.discountPercent ?? 0,
          taxPercent: line.taxPercent ?? 0,
          sortOrder: index,
        })),
      });
    }
    return transaction.purchaseOrder.update({
      where: { id: orderId },
      data: {
        ...(input.supplierId ? { supplierId: input.supplierId } : {}),
        ...(input.branchId ? { branchId: input.branchId } : {}),
        ...(input.orderDate ? { orderDate: new Date(input.orderDate) } : {}),
        ...(input.expectedDate !== undefined ? { expectedDate: input.expectedDate ? new Date(input.expectedDate) : null } : {}),
        ...(input.externalReference !== undefined ? { externalReference: input.externalReference.trim() || null } : {}),
        ...(input.notes !== undefined ? { notes: input.notes.trim() || null } : {}),
      },
    });
  });
}

/** @summary Cambia el estado de un pedido respetando las reglas documentales. */
export async function setPurchaseOrderStatus(tenantId: number, orderId: number, nextStatus: string) {
  const allowed = new Set<string>(["sent", "closed", "cancelled"]);
  if (!allowed.has(nextStatus)) throw new PurchaseError("Estado de pedido no permitido", 400);

  return prisma.$transaction(async (transaction) => {
    const order = await transaction.purchaseOrder.findFirst({
      where: { id: orderId, tenantId },
      include: { receipts: { select: { id: true } } },
    });
    if (!order) throw new PurchaseError("El pedido no existe", 404);

    if (nextStatus === "sent") {
      if (order.status !== "draft") throw new PurchaseError("Solo se envía un pedido en Borrador", 409);
    }
    if (nextStatus === "cancelled") {
      if (order.status === "cancelled" || order.status === "closed") {
        throw new PurchaseError("El pedido ya está finalizado", 409);
      }
      if (order.receipts.length) {
        throw new PurchaseError("No se puede cancelar un pedido con recepciones", 409);
      }
    }
    if (nextStatus === "closed") {
      if (!["received", "partially_received", "sent", "draft"].includes(order.status)) {
        throw new PurchaseError("No se puede cerrar el pedido en este estado", 409);
      }
    }
    return transaction.purchaseOrder.update({ where: { id: orderId }, data: { status: nextStatus } });
  });
}

/**
 * @summary Registra una recepción física y descuenta el pendiente de forma atómica.
 *
 * La guarda usa `updateMany` con la condición `receivedQuantity + cantidad <= pedido`,
 * por lo que dos recepciones simultáneas no pueden consumir el mismo pendiente.
 * El stock se incrementa reutilizando `InventoryStock` y cada línea crea un
 * `StockMovement` tipo `purchase_in` con snapshot del costo esperado.
 */
export async function receivePurchaseOrder(
  tenantId: number,
  branchId: number,
  userId: number | null,
  input: {
    orderId: number;
    notes?: string;
    receivedAt?: string;
    items: Array<{ orderItemId: number; quantity: number; unit: string; unitCost: number }>;
  },
) {
  if (!input.items.length) throw new PurchaseError("Indicá qué productos estás recibiendo", 400);

  return prisma.$transaction(async (transaction) => {
    const order = await transaction.purchaseOrder.findFirst({
      where: { id: input.orderId, tenantId },
      include: { items: true, supplier: { select: { id: true, name: true } } },
    });
    if (!order) throw new PurchaseError("El pedido no existe", 404);
    if (order.status === "cancelled" || order.status === "closed") {
      throw new PurchaseError("El pedido está cerrado o cancelado", 409);
    }
    const orderedItems = new Map(order.items.map((item) => [item.id, item]));
    const conversions = await transaction.unitConversion.findMany({
      where: { tenantId },
      select: { fromUnit: true, toUnit: true, factor: true },
    });
    const conversionRows: UnitConversionRow[] = conversions.map((row) => ({
      fromUnit: row.fromUnit,
      toUnit: row.toUnit,
      factor: Number(row.factor),
    }));

    // Validar las líneas antes de escribir nada.
    for (const line of input.items) {
      const ordered = orderedItems.get(line.orderItemId);
      if (!ordered) throw new PurchaseError("Una línea no pertenece al pedido", 400);
      const quantity = Number(line.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) throw new PurchaseError("La cantidad a recibir debe ser mayor a cero", 400);
      if (line.unit !== ordered.unit) {
        throw new PurchaseError("La unidad debe coincidir con la del pedido", 400);
      }
    }

    const number = await nextDocumentNumber(transaction, tenantId, "RC");
    const receipt = await transaction.purchaseReceipt.create({
      data: {
        tenantId,
        branchId,
        supplierId: order.supplierId,
        orderId: order.id,
        number,
        receivedAt: input.receivedAt ? new Date(input.receivedAt) : new Date(),
        notes: input.notes?.trim() || null,
        createdById: userId,
      },
    });

    let fullyReceived = true;
    const movements: Array<{ stockId: number; quantity: number; unitCost: number | null; unit: string }> = [];

    for (const line of input.items) {
      const ordered = orderedItems.get(line.orderItemId)!;
      const quantity = Number(line.quantity);
      // Guarda atómica contra recepciones duplicadas por carreras.
      const consumed = await transaction.purchaseOrderItem.updateMany({
        where: {
          id: line.orderItemId,
          orderId: order.id,
          receivedQuantity: { lte: Number(ordered.quantity) - quantity },
        },
        data: { receivedQuantity: { increment: quantity } },
      });
      if (consumed.count !== 1) {
        throw new PurchaseError(
          `La cantidad recibida de un producto supera lo pendiente del pedido (${Number(ordered.quantity) - Number(ordered.receivedQuantity)} pendientes)`,
          409,
        );
      }

      await transaction.purchaseReceiptItem.create({
        data: {
          receiptId: receipt.id,
          orderItemId: ordered.id,
          productId: ordered.productId,
          quantity,
          unit: line.unit || ordered.unit,
          unitCost: Number(line.unitCost) || Number(ordered.unitCost),
          sortOrder: ordered.sortOrder,
        },
      });

      // Impacto real en inventario de la sucursal.
      const stock = await transaction.inventoryStock.upsert({
        where: { branchId_productId: { branchId, productId: ordered.productId } },
        create: {
          tenantId,
          branchId,
          productId: ordered.productId,
          tracked: true,
          current: 0,
          unit: line.unit || "unidad",
        },
        update: {},
      });
      const inStockUnit = convertQuantity(quantity, line.unit || ordered.unit, stock.unit, conversionRows);
      if (!Number.isFinite(inStockUnit) || inStockUnit <= 0) {
        throw new PurchaseError("No se pudo convertir la unidad recibida al stock de la sucursal", 409);
      }
      const updated = await transaction.inventoryStock.update({
        where: { id: stock.id },
        data: { current: { increment: inStockUnit }, tracked: true },
      });
      const unitCostPerStockUnit =
        Number(line.unitCost) > 0
          ? Number(line.unitCost) / convertQuantity(1, line.unit || ordered.unit, stock.unit, conversionRows)!
          : null;
      await transaction.stockMovement.create({
        data: {
          tenantId,
          stockId: stock.id,
          userId,
          type: "purchase_in",
          quantity: inStockUnit,
          balanceAfter: Number(updated.current),
          unitCost: unitCostPerStockUnit,
          reference: `${number} · ${order.number}`,
          reason: `Recepción de compra · ${order.supplier.name}`,
        },
      });
      movements.push({ stockId: stock.id, quantity: inStockUnit, unitCost: unitCostPerStockUnit, unit: stock.unit });

      const newReceived = Number(ordered.receivedQuantity) + quantity;
      if (newReceived < Number(ordered.quantity)) fullyReceived = false;
    }

    // Recalcular estado del pedido: parcial o recibido por completo.
    if (order.status === "draft" || order.status === "sent") {
      await transaction.purchaseOrder.update({
        where: { id: order.id },
        data: { status: fullyReceived ? "received" : "partially_received" },
      });
    } else if (order.status === "partially_received" && fullyReceived) {
      await transaction.purchaseOrder.update({
        where: { id: order.id },
        data: { status: "received" },
      });
    }

    return { receipt, movements };
  });
}

export type PurchaseInvoiceLineInput = {
  productId?: number | null;
  description: string;
  quantity: number;
  unit: string;
  unitCost: number;
  discountPercent?: number;
  taxPercent?: number;
};

/**
 * @summary Crea una factura de compra, opcionalmente vinculada a recepciones.
 *
 * Con política `product`, los costos facturados actualizan el costo actual del
 * producto y quedan en el historial de costos; con `history`, solo historial.
 * Nunca se reescriben snapshots de costos de ventas pasadas.
 */
export async function createPurchaseInvoice(
  tenantId: number,
  userId: number | null,
  input: {
    supplierId: number;
    branchId?: number | null;
    orderId?: number | null;
    receiptIds?: number[];
    documentDate?: string;
    dueDate?: string | null;
    externalNumber?: string;
    financialCategory?: string;
    notes?: string;
    attachmentId?: number | null;
    items: PurchaseInvoiceLineInput[];
  },
) {
  if (!input.items.length) throw new PurchaseError("Agregá al menos una línea a la factura", 400);
  await requireSupplier(tenantId, input.supplierId);
  for (const line of input.items) {
    const quantity = Number(line.quantity);
    const unitCost = Number(line.unitCost);
    if (!Number.isFinite(quantity) || quantity <= 0) throw new PurchaseError("La cantidad debe ser mayor a cero", 400);
    if (!Number.isFinite(unitCost) || unitCost < 0) throw new PurchaseError("El costo no es válido", 400);
    if (!line.description.trim()) throw new PurchaseError("Toda línea necesita una descripción", 400);
  }

  return prisma.$transaction(async (transaction) => {
    // Validar que las recepciones pertenezcan al proveedor y a este tenant.
    const receiptIds = input.receiptIds ?? [];
    if (receiptIds.length) {
      const receipts = await transaction.purchaseReceipt.findMany({
        where: { id: { in: receiptIds }, tenantId, supplierId: input.supplierId },
        select: { id: true },
      });
      if (receipts.length !== new Set(receiptIds).size) {
        throw new PurchaseError("Una recepción no pertenece al proveedor", 400);
      }
    }

    const lines = input.items.map((line) => {
      const quantity = Number(line.quantity);
      const unitCost = Number(line.unitCost);
      const discountPercent = Number(line.discountPercent ?? 0);
      const taxPercent = Number(line.taxPercent ?? 0);
      const net = quantity * unitCost * (1 - discountPercent / 100);
      return {
        ...line,
        quantity,
        unitCost,
        discountPercent,
        taxPercent,
        lineNet: net,
        lineTax: (net * taxPercent) / 100,
      };
    });
    const subtotal = lines.reduce((sum, line) => sum + line.lineNet, 0);
    const taxAmount = lines.reduce((sum, line) => sum + line.lineTax, 0);

    const number = await nextDocumentNumber(transaction, tenantId, "GC");
    const invoice = await transaction.purchaseInvoice.create({
      data: {
        tenantId,
        branchId: input.branchId ?? null,
        supplierId: input.supplierId,
        orderId: input.orderId ?? null,
        number,
        status: "pending",
        documentDate: input.documentDate ? new Date(input.documentDate) : new Date(),
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        externalNumber: input.externalNumber?.trim() || null,
        financialCategory: input.financialCategory?.trim() || "insumos",
        subtotal: round2(subtotal),
        taxAmount: round2(taxAmount),
        total: round2(subtotal + taxAmount),
        notes: input.notes?.trim() || null,
        attachmentId: input.attachmentId ?? null,
        createdById: userId,
        items: {
          create: lines.map((line, index) => ({
            productId: line.productId ?? null,
            description: line.description.trim().slice(0, 200),
            quantity: line.quantity,
            unit: line.unit || "unidad",
            unitCost: line.unitCost,
            discountPercent: line.discountPercent,
            taxPercent: line.taxPercent,
            sortOrder: index,
          })),
        },
        receipts: receiptIds.length
          ? { create: receiptIds.map((receiptId) => ({ receiptId })) }
          : undefined,
      },
      include: { items: true, supplier: { select: { id: true, name: true } }, receipts: { include: { receipt: { select: { id: true, number: true } } } } },
    });

    await applyInvoicedCosts(transaction, tenantId, invoice, lines);

    return invoice;
  });
}

/**
 * @summary Aplica los costos facturados según la política del negocio.
 * `product`: actualiza `Product.cost` y registra historial; `history`: solo historial.
 */
async function applyInvoicedCosts(
  transaction: Prisma.TransactionClient,
  tenantId: number,
  invoice: { id: number; number: string },
  lines: Array<PurchaseInvoiceLineInput & { productId?: number | null; unit: string; unitCost: number }>,
) {
  const settings = await transaction.inventorySettings.findUnique({ where: { tenantId } });
  const updateCost = settings?.costPolicy === "product";
  const conversions = await transaction.unitConversion.findMany({
    where: { tenantId },
    select: { fromUnit: true, toUnit: true, factor: true },
  });
  const conversionRows: UnitConversionRow[] = conversions.map((row) => ({
    fromUnit: row.fromUnit,
    toUnit: row.toUnit,
    factor: Number(row.factor),
  }));

  for (const line of lines) {
    if (!line.productId || line.unitCost <= 0) continue;
    const product = await transaction.product.findUnique({
      where: { id: line.productId, tenantId },
      select: { id: true, cost: true, costUnit: true },
    });
    if (!product) continue;
    const base = product.costUnit || "unidad";
    const unit = line.unit || "unidad";
    // Costo facturado expresado en la unidad base del producto.
    const perBase = unit === base ? 1 : convertQuantity(1, unit, base, conversionRows);
    if (!perBase || perBase <= 0) continue;
    const newCost = line.unitCost * perBase;

    await transaction.ingredientCostHistory.create({
      data: {
        tenantId,
        productId: product.id,
        cost: newCost,
        unit: base,
        changedById: null,
        reason: `Factura de compra ${invoice.number} · costo ${unit === base ? "" : `por ${unit}`}`,
      },
    });
    if (updateCost && Number(product.cost) !== newCost) {
      await transaction.product.update({
        where: { id: product.id },
        data: { cost: newCost },
      });
    }
  }
}

/** @summary Recupera una factura de compra con sus relaciones. */
export async function loadPurchaseInvoice(tenantId: number, invoiceId: number) {
  const invoice = await prisma.purchaseInvoice.findFirst({
    where: { id: invoiceId, tenantId },
    include: {
      supplier: { select: { id: true, name: true, paymentTerms: true } },
      branch: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      order: { select: { id: true, number: true } },
      items: { orderBy: { sortOrder: "asc" } },
      receipts: { include: { receipt: { include: { items: { select: { id: true, quantity: true, unit: true, unitCost: true } } } } } },
      payments: { orderBy: { paidAt: "desc" }, include: { createdBy: { select: { id: true, name: true } } } },
    },
  });
  if (!invoice) throw new PurchaseError("La factura no existe", 404);
  return invoice;
}

/** @summary Registra un pago contra una factura con saldo, sin superar el total. */
export async function payPurchaseInvoice(
  tenantId: number,
  userId: number | null,
  input: { invoiceId: number; amount: number; method: string; paidAt?: string; notes?: string },
) {
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new PurchaseError("El monto del pago debe ser mayor a cero", 400);
  if (!PAYMENT_METHODS.includes(input.method as (typeof PAYMENT_METHODS)[number])) {
    throw new PurchaseError("Medio de pago no válido", 400);
  }

  return prisma.$transaction(async (transaction) => {
    const invoice = await transaction.purchaseInvoice.findFirst({ where: { id: input.invoiceId, tenantId } });
    if (!invoice) throw new PurchaseError("La factura no existe", 404);
    if (invoice.status === "cancelled") throw new PurchaseError("La factura está anulada", 409);

    // Guarda atómica: solo paga si el monto no supera el saldo pendiente.
    const paid = await transaction.purchaseInvoice.updateMany({
      where: { id: invoice.id, paidAmount: { lte: Number(invoice.total) - amount } },
      data: { paidAmount: { increment: amount } },
    });
    if (paid.count !== 1) {
      throw new PurchaseError(`El pago supera el saldo pendiente (${round2(Number(invoice.total) - Number(invoice.paidAmount))})`, 409);
    }

    const number = await nextDocumentNumber(transaction, tenantId, "PC");
    const payment = await transaction.purchasePayment.create({
      data: {
        tenantId,
        invoiceId: invoice.id,
        number,
        amount,
        method: input.method,
        paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
        notes: input.notes?.trim() || null,
        createdById: userId,
      },
    });

    const updated = await transaction.purchaseInvoice.findUniqueOrThrow({ where: { id: invoice.id } });
    const newPaid = Number(updated.paidAmount);
    const nextStatus = newPaid >= Number(updated.total) ? "paid" : "partially_paid";
    await transaction.purchaseInvoice.update({
      where: { id: invoice.id },
      data: { status: nextStatus, ...(newPaid >= Number(updated.total) ? { paidAmount: updated.total } : {}) },
    });
    return { payment, status: nextStatus, balance: round2(Number(updated.total) - newPaid) };
  });
}

/** @summary Anula una factura de compra; no se permite si tiene pagos. */
export async function annulPurchaseInvoice(tenantId: number, invoiceId: number) {
  return prisma.$transaction(async (transaction) => {
    const invoice = await transaction.purchaseInvoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: { payments: { select: { id: true } } },
    });
    if (!invoice) throw new PurchaseError("La factura no existe", 404);
    if (invoice.status === "cancelled") return invoice;
    if (invoice.payments.length) {
      throw new PurchaseError("No se puede anular una factura con pagos registrados", 409);
    }
    return transaction.purchaseInvoice.update({ where: { id: invoiceId }, data: { status: "cancelled" } });
  });
}

/** @summary Edita una factura pendiente (sin pagos ni anulación). */
export async function updatePurchaseInvoice(
  tenantId: number,
  invoiceId: number,
  input: {
    documentDate?: string;
    dueDate?: string | null;
    externalNumber?: string;
    financialCategory?: string;
    notes?: string;
  },
) {
  return prisma.$transaction(async (transaction) => {
    const invoice = await transaction.purchaseInvoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: { payments: { select: { id: true } } },
    });
    if (!invoice) throw new PurchaseError("La factura no existe", 404);
    if (invoice.status === "cancelled") throw new PurchaseError("La factura está anulada", 409);
    if (invoice.payments.length) throw new PurchaseError("No se puede editar una factura con pagos", 409);
    return transaction.purchaseInvoice.update({
      where: { id: invoiceId },
      data: {
        ...(input.documentDate ? { documentDate: new Date(input.documentDate) } : {}),
        ...(input.dueDate !== undefined ? { dueDate: input.dueDate ? new Date(input.dueDate) : null } : {}),
        ...(input.externalNumber !== undefined ? { externalNumber: input.externalNumber.trim() || null } : {}),
        ...(input.financialCategory !== undefined ? { financialCategory: input.financialCategory.trim() || "insumos" } : {}),
        ...(input.notes !== undefined ? { notes: input.notes.trim() || null } : {}),
      },
    });
  });
}

/** @summary Lista pedidos con filtros de operación. */
export async function listPurchaseOrders(
  tenantId: number,
  filters: { branchId?: number | null; supplierId?: number | null; status?: string; query?: string; from?: string; to?: string; limit?: number; offset?: number },
) {
  const where: Prisma.PurchaseOrderWhereInput = { tenantId };
  if (filters.branchId) where.branchId = filters.branchId;
  if (filters.supplierId) where.supplierId = filters.supplierId;
  if (filters.status) where.status = filters.status;
  if (filters.query) {
    where.OR = [
      { number: { contains: filters.query } },
      { externalReference: { contains: filters.query } },
      { supplier: { name: { contains: filters.query } } },
    ];
  }
  if (filters.from) where.orderDate = { ...(where.orderDate as object | undefined), gte: new Date(filters.from) };
  if (filters.to) where.orderDate = { ...(where.orderDate as object | undefined), lte: new Date(filters.to) };
  const [items, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        items: { select: { quantity: true, receivedQuantity: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: filters.limit ?? 60,
      skip: filters.offset ?? 0,
    }),
    prisma.purchaseOrder.count({ where }),
  ]);
  return { items, total };
}

/** @summary Lista recepciones con filtros. */
export async function listPurchaseReceipts(
  tenantId: number,
  filters: { branchId?: number | null; supplierId?: number | null; orderId?: number | null; query?: string; from?: string; to?: string; limit?: number; offset?: number },
) {
  const where: Prisma.PurchaseReceiptWhereInput = { tenantId };
  if (filters.branchId) where.branchId = filters.branchId;
  if (filters.supplierId) where.supplierId = filters.supplierId;
  if (filters.orderId) where.orderId = filters.orderId;
  if (filters.query) {
    where.OR = [
      { number: { contains: filters.query } },
      { order: { number: { contains: filters.query } } },
      { supplier: { name: { contains: filters.query } } },
    ];
  }
  if (filters.from) where.receivedAt = { ...(where.receivedAt as object | undefined), gte: new Date(filters.from) };
  if (filters.to) where.receivedAt = { ...(where.receivedAt as object | undefined), lte: new Date(filters.to) };
  const [items, total] = await Promise.all([
    prisma.purchaseReceipt.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        order: { select: { id: true, number: true } },
        items: { include: { product: { select: { id: true, name: true } } } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { receivedAt: "desc" },
      take: filters.limit ?? 60,
      skip: filters.offset ?? 0,
    }),
    prisma.purchaseReceipt.count({ where }),
  ]);
  return { items, total };
}

/** @summary Lista facturas de compra con filtros. */
export async function listPurchaseInvoices(
  tenantId: number,
  filters: { branchId?: number | null; supplierId?: number | null; status?: string; query?: string; from?: string; to?: string; limit?: number; offset?: number },
) {
  const where: Prisma.PurchaseInvoiceWhereInput = { tenantId };
  if (filters.branchId) where.branchId = filters.branchId;
  if (filters.supplierId) where.supplierId = filters.supplierId;
  if (filters.status) where.status = filters.status;
  if (filters.query) {
    where.OR = [
      { number: { contains: filters.query } },
      { externalNumber: { contains: filters.query } },
      { supplier: { name: { contains: filters.query } } },
    ];
  }
  if (filters.from) where.documentDate = { ...(where.documentDate as object | undefined), gte: new Date(filters.from) };
  if (filters.to) where.documentDate = { ...(where.documentDate as object | undefined), lte: new Date(filters.to) };
  const [items, total] = await Promise.all([
    prisma.purchaseInvoice.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        receipts: { select: { receipt: { select: { id: true, number: true } } } },
        payments: { select: { id: true, amount: true } },
      },
      orderBy: { documentDate: "desc" },
      take: filters.limit ?? 60,
      skip: filters.offset ?? 0,
    }),
    prisma.purchaseInvoice.count({ where }),
  ]);
  return { items, total };
}

/** @summary Lista proveedores activos del tenant. */
export async function listSuppliers(tenantId: number, query?: string) {
  return prisma.supplier.findMany({
    where: { tenantId, ...(query ? { name: { contains: query } } : {}) },
    orderBy: { name: "asc" },
  });
}

/** @summary Crea un proveedor. */
export async function createSupplier(
  tenantId: number,
  input: { name: string; taxId?: string; contactName?: string; phone?: string; email?: string; address?: string; paymentTerms?: string; notes?: string },
) {
  const name = input.name.trim();
  if (!name) throw new PurchaseError("Indicá el nombre del proveedor", 400);
  return prisma.supplier.create({
    data: {
      tenantId,
      name,
      taxId: input.taxId?.trim() || null,
      contactName: input.contactName?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      address: input.address?.trim() || null,
      paymentTerms: input.paymentTerms?.trim() || null,
      notes: input.notes?.trim() || null,
    },
  });
}

/** @summary Actualiza un proveedor. */
export async function updateSupplier(
  tenantId: number,
  supplierId: number,
  input: { name?: string; taxId?: string | null; contactName?: string | null; phone?: string | null; email?: string | null; address?: string | null; paymentTerms?: string | null; notes?: string | null; active?: boolean },
) {
  return prisma.supplier.updateMany({
    where: { id: supplierId, tenantId },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() || "Proveedor" } : {}),
      ...(input.taxId !== undefined ? { taxId: input.taxId?.trim() || null } : {}),
      ...(input.contactName !== undefined ? { contactName: input.contactName?.trim() || null } : {}),
      ...(input.phone !== undefined ? { phone: input.phone?.trim() || null } : {}),
      ...(input.email !== undefined ? { email: input.email?.trim() || null } : {}),
      ...(input.address !== undefined ? { address: input.address?.trim() || null } : {}),
      ...(input.paymentTerms !== undefined ? { paymentTerms: input.paymentTerms?.trim() || null } : {}),
      ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    },
  });
}

/** @summary Elimina un proveedor si no tiene documentos asociados. */
export async function removeSupplier(tenantId: number, supplierId: number) {
  return prisma.$transaction(async (transaction) => {
    const used = await transaction.purchaseOrder.count({ where: { tenantId, supplierId } });
    if (used) throw new PurchaseError("El proveedor tiene pedidos asociados", 409);
    const result = await transaction.supplier.deleteMany({ where: { id: supplierId, tenantId } });
    if (result.count !== 1) throw new PurchaseError("El proveedor no existe", 404);
    return { deleted: true };
  });
}

/** @summary Redondea un importe a dos decimales. */
export function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
