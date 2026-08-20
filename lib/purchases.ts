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
    where: { id: supplierId, tenantId, status: "active" },
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

    // Actualizar invoicedQuantity en las líneas del pedido asociado.
    if (input.orderId && receiptIds.length) {
      const receiptItems = await transaction.purchaseReceiptItem.findMany({
        where: { receiptId: { in: receiptIds }, orderItemId: { not: null } },
        select: { orderItemId: true, quantity: true },
      });
      for (const ri of receiptItems) {
        if (!ri.orderItemId) continue;
        await transaction.purchaseOrderItem.update({
          where: { id: ri.orderItemId },
          data: { invoicedQuantity: { increment: Number(ri.quantity) } },
        });
      }
    }

    await createSupplierLedgerEntry(transaction, tenantId, userId, {
      supplierId: input.supplierId,
      branchId: input.branchId ?? null,
      type: "purchase_invoice",
      referenceType: "purchase_invoice",
      referenceId: invoice.id,
      documentNumber: invoice.number,
      originalAmount: Number(invoice.total),
      appliedAmount: 0,
      remainingAmount: Number(invoice.total),
      currency: "ARS",
      dueDate: input.dueDate ?? null,
      status: "open",
      notes: input.notes?.trim() || null,
    });

    await updateSupplierBalance(transaction, tenantId, input.supplierId, Number(invoice.total));

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

    const amount = Number(input.amount);
    const currentPaid = Number(invoice.paidAmount);
    const pending = Number(invoice.total) - currentPaid;
    if (amount > pending + 0.01) {
      throw new PurchaseError(`El pago supera el saldo pendiente (${round2(pending)})`, 409);
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

    const newPaid = currentPaid + amount;
    const nextStatus = newPaid >= Number(invoice.total) ? "paid" : "partially_paid";
    const finalPaid = nextStatus === "paid" ? Number(invoice.total) : newPaid;
    await transaction.purchaseInvoice.update({
      where: { id: invoice.id },
      data: { paidAmount: finalPaid, status: nextStatus },
    });

    const invoiceLedger = await transaction.supplierLedgerEntry.findFirst({
      where: { tenantId, supplierId: invoice.supplierId, referenceType: "purchase_invoice", referenceId: invoice.id, status: "open" },
    });

    if (invoiceLedger) {
      const newApplied = Number(invoiceLedger.appliedAmount) + amount;
      const newRemaining = Math.max(0, Number(invoiceLedger.remainingAmount) - amount);
      await transaction.supplierLedgerEntry.update({
        where: { id: invoiceLedger.id },
        data: {
          appliedAmount: newApplied,
          remainingAmount: newRemaining,
          status: newRemaining <= 0.01 ? "closed" : "open",
        },
      });
      await updateSupplierBalance(transaction, tenantId, invoice.supplierId, -amount);
    }

    await createSupplierLedgerEntry(transaction, tenantId, userId, {
      supplierId: invoice.supplierId,
      branchId: invoice.branchId ?? undefined,
      type: "payment",
      referenceType: "purchase_payment",
      referenceId: payment.id,
      documentNumber: payment.number,
      originalAmount: amount,
      appliedAmount: amount,
      remainingAmount: 0,
      currency: "ARS",
      paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
      status: "closed",
      notes: input.notes?.trim() || null,
    });

    return { payment, status: nextStatus, balance: round2(Number(invoice.total) - finalPaid) };
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

/** @summary Lista proveedores del tenant con datos para la tabla operativa. */
export async function listSuppliers(tenantId: number, query?: string) {
  return prisma.supplier.findMany({
    where: { tenantId, ...(query ? { name: { contains: query } } : {}) },
    orderBy: { name: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      taxId: true,
      contactName: true,
      phone: true,
      email: true,
      paymentTerms: true,
      currency: true,
      status: true,
      category: true,
      creditLimit: true,
      currentBalance: true,
      branches: { include: { branch: { select: { id: true, name: true } } } },
    },
  });
}

/** @summary Crea un proveedor con datos de maestro y cuenta corriente. */
export async function createSupplier(
  tenantId: number,
  input: {
    name: string;
    code?: string;
    taxId?: string;
    contactName?: string;
    phone?: string;
    email?: string;
    address?: string;
    paymentTerms?: string;
    currency?: string;
    status?: string;
    category?: string;
    creditLimit?: number | null;
    notes?: string;
    branchIds?: number[];
  },
) {
  const name = input.name.trim();
  if (!name) throw new PurchaseError("Indicá el nombre del proveedor", 400);
  const code = input.code?.trim() || null;
  const currency = input.currency?.trim() || "ARS";
  const status = ["active", "blocked", "suspended"].includes(input.status || "") ? input.status! : "active";

  return prisma.$transaction(async (transaction) => {
    const supplier = await transaction.supplier.create({
      data: {
        tenantId,
        name,
        code,
        taxId: input.taxId?.trim() || null,
        contactName: input.contactName?.trim() || null,
        phone: input.phone?.trim() || null,
        email: input.email?.trim() || null,
        address: input.address?.trim() || null,
        paymentTerms: input.paymentTerms?.trim() || null,
        currency,
        status,
        category: input.category?.trim() || null,
        creditLimit: input.creditLimit ?? null,
        notes: input.notes?.trim() || null,
      },
    });

    if (input.branchIds?.length) {
      await transaction.supplierBranch.createMany({
        data: input.branchIds.map((branchId) => ({
          tenantId,
          supplierId: supplier.id,
          branchId,
        })),
      });
    }

    return transaction.supplier.findUniqueOrThrow({
      where: { id: supplier.id },
      include: { branches: { include: { branch: { select: { id: true, name: true } } } } },
    });
  });
}

/** @summary Actualiza un proveedor. */
export async function updateSupplier(
  tenantId: number,
  supplierId: number,
  input: {
    name?: string;
    code?: string | null;
    taxId?: string | null;
    contactName?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    paymentTerms?: string | null;
    currency?: string | null;
    status?: string | null;
    category?: string | null;
    creditLimit?: number | null;
    blockedAt?: Date | null;
    blockedReason?: string | null;
    notes?: string | null;
    active?: boolean;
    branchIds?: number[];
  },
) {
  return prisma.$transaction(async (transaction) => {
    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name.trim() || "Proveedor";
    if (input.code !== undefined) data.code = input.code?.trim() || null;
    if (input.taxId !== undefined) data.taxId = input.taxId?.trim() || null;
    if (input.contactName !== undefined) data.contactName = input.contactName?.trim() || null;
    if (input.phone !== undefined) data.phone = input.phone?.trim() || null;
    if (input.email !== undefined) data.email = input.email?.trim() || null;
    if (input.address !== undefined) data.address = input.address?.trim() || null;
    if (input.paymentTerms !== undefined) data.paymentTerms = input.paymentTerms?.trim() || null;
    if (input.currency !== undefined) data.currency = input.currency?.trim() || "ARS";
    if (input.status !== undefined) data.status = ["active", "blocked", "suspended"].includes(input.status || "") ? input.status! : "active";
    if (input.category !== undefined) data.category = input.category?.trim() || null;
    if (input.creditLimit !== undefined) data.creditLimit = input.creditLimit;
    if (input.blockedAt !== undefined) data.blockedAt = input.blockedAt;
    if (input.blockedReason !== undefined) data.blockedReason = input.blockedReason?.trim() || null;
    if (input.notes !== undefined) data.notes = input.notes?.trim() || null;
    if (input.active !== undefined) data.status = input.active ? "active" : "blocked";

    const updated = await transaction.supplier.updateMany({
      where: { id: supplierId, tenantId },
      data,
    });
    if (!updated.count) throw new PurchaseError("El proveedor no existe", 404);

    if (input.branchIds !== undefined) {
      await transaction.supplierBranch.deleteMany({ where: { supplierId } });
      if (input.branchIds.length) {
        await transaction.supplierBranch.createMany({
          data: input.branchIds.map((branchId) => ({ tenantId, supplierId, branchId })),
        });
      }
    }

    return transaction.supplier.findUniqueOrThrow({
      where: { id: supplierId },
      include: { branches: { include: { branch: { select: { id: true, name: true } } } } },
    });
  });
}

/** @summary Verifica si un proveedor tiene documentos o movimientos asociados. */
export async function hasSupplierHistory(tenantId: number, supplierId: number) {
  const [orders, receipts, invoices, expenses, ledger] = await Promise.all([
    prisma.purchaseOrder.count({ where: { tenantId, supplierId } }),
    prisma.purchaseReceipt.count({ where: { tenantId, supplierId } }),
    prisma.purchaseInvoice.count({ where: { tenantId, supplierId } }),
    prisma.expense.count({ where: { tenantId, supplierId } }),
    prisma.supplierLedgerEntry.count({ where: { tenantId, supplierId } }),
  ]);
  return orders > 0 || receipts > 0 || invoices > 0 || expenses > 0 || ledger > 0;
}

/** @summary Elimina un proveedor si no tiene documentos asociados. */
export async function removeSupplier(tenantId: number, supplierId: number) {
  return prisma.$transaction(async (transaction) => {
    const [orders, receipts, invoices, expenses, ledger] = await Promise.all([
      transaction.purchaseOrder.count({ where: { tenantId, supplierId } }),
      transaction.purchaseReceipt.count({ where: { tenantId, supplierId } }),
      transaction.purchaseInvoice.count({ where: { tenantId, supplierId } }),
      transaction.expense.count({ where: { tenantId, supplierId } }),
      transaction.supplierLedgerEntry.count({ where: { tenantId, supplierId } }),
    ]);
    if (orders > 0 || receipts > 0 || invoices > 0 || expenses > 0 || ledger > 0) {
      throw new PurchaseError("El proveedor tiene historial (pedidos, recepciones, facturas, gastos o movimientos). Bloquealo en lugar de eliminarlo.", 409);
    }
    const result = await transaction.supplier.deleteMany({ where: { id: supplierId, tenantId } });
    if (result.count !== 1) throw new PurchaseError("El proveedor no existe", 404);
    return { deleted: true };
  });
}

/** @summary Obtiene la ficha completa de un proveedor con sucursales habilitadas. */
export async function getSupplierDetail(tenantId: number, supplierId: number) {
  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, tenantId },
    include: {
      branches: { include: { branch: { select: { id: true, name: true } } } },
    },
  });
  if (!supplier) throw new PurchaseError("El proveedor no existe", 404);
  return supplier;
}

/** @summary Asigna sucursales habilitadas a un proveedor (reemplaza la asignación actual). */
export async function setSupplierBranches(tenantId: number, supplierId: number, branchIds: number[]) {
  return prisma.$transaction(async (transaction) => {
    const supplier = await transaction.supplier.findFirst({ where: { id: supplierId, tenantId } });
    if (!supplier) throw new PurchaseError("El proveedor no existe", 404);

    await transaction.supplierBranch.deleteMany({ where: { supplierId } });
    if (branchIds.length) {
      await transaction.supplierBranch.createMany({
        data: branchIds.map((branchId) => ({ tenantId, supplierId, branchId })),
      });
    }
    return transaction.supplier.findUniqueOrThrow({
      where: { id: supplierId },
      include: { branches: { include: { branch: { select: { id: true, name: true } } } } },
    });
  });
}

/** @summary Actualiza el saldo actual del proveedor sumando el importe aplicado. */
export async function updateSupplierBalance(transaction: Prisma.TransactionClient | typeof prisma, tenantId: number, supplierId: number, delta: number) {
  await transaction.supplier.updateMany({
    where: { id: supplierId, tenantId },
    data: { currentBalance: { increment: delta } },
  });
}

/** @summary Aplica un pago a las partidas abiertas de un proveedor. */
export async function applySupplierPayment(
  tenantId: number,
  userId: number | null,
  supplierId: number,
  input: { amount: number; entryIds: number[]; method: string; notes?: string | null },
) {
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new PurchaseError("El monto del pago debe ser mayor a cero", 400);

  return prisma.$transaction(async (transaction) => {
    const supplier = await transaction.supplier.findFirst({ where: { id: supplierId, tenantId } });
    if (!supplier) throw new PurchaseError("El proveedor no existe", 404);

    const entries = await transaction.supplierLedgerEntry.findMany({
      where: { id: { in: input.entryIds }, tenantId, supplierId, status: "open" },
      orderBy: { dueDate: "asc", createdAt: "asc" },
    });

    if (!entries.length) throw new PurchaseError("No hay partidas abiertas seleccionadas", 409);

    const totalOpen = entries.reduce((sum, entry) => sum + Number(entry.remainingAmount), 0);
    if (amount > totalOpen + 0.01) {
      throw new PurchaseError(`El pago supera el saldo abierto (${round2(totalOpen)})`, 409);
    }

    const number = await nextDocumentNumber(transaction, tenantId, "PC");
    let remaining = amount;

    for (const entry of entries) {
      if (remaining <= 0) break;
      const apply = Math.min(remaining, Number(entry.remainingAmount));
      const newApplied = Number(entry.appliedAmount) + apply;
      const newRemaining = Number(entry.remainingAmount) - apply;

      await transaction.supplierLedgerEntry.update({
        where: { id: entry.id },
        data: {
          appliedAmount: newApplied,
          remainingAmount: newRemaining,
          status: newRemaining <= 0.01 ? "closed" : "open",
        },
      });

      remaining -= apply;
    }

    await createSupplierLedgerEntry(transaction, tenantId, userId, {
      supplierId,
      branchId: entries[0]?.branchId ?? null,
      type: "payment",
      referenceType: "manual_application",
      documentNumber: number,
      originalAmount: amount,
      appliedAmount: amount,
      remainingAmount: 0,
      currency: supplier.currency,
      paidAt: new Date(),
      status: "closed",
      notes: input.notes?.trim() || `Pago aplicado a ${entries.length} partida(s)`,
    });

    await updateSupplierBalance(transaction, tenantId, supplierId, -amount);

    const remainingEntries = await transaction.supplierLedgerEntry.findMany({
      where: { tenantId, supplierId, status: "open" },
      select: { id: true, remainingAmount: true },
    });
    const newBalance = remainingEntries.reduce((sum, entry) => sum + Number(entry.remainingAmount), 0);

    return { number, amount, appliedTo: entries.length, remainingBalance: round2(newBalance) };
  });
}

/** @summary Revierte una entrada del ledger y crea la entrada de reversión. */
export async function reverseSupplierLedgerEntry(
  tenantId: number,
  userId: number | null,
  entryId: number,
  reason?: string,
) {
  return prisma.$transaction(async (transaction) => {
    const entry = await transaction.supplierLedgerEntry.findFirst({ where: { id: entryId, tenantId } });
    if (!entry) throw new PurchaseError("El movimiento no existe", 404);
    if (entry.status === "reversed") throw new PurchaseError("El movimiento ya fue revertido", 409);

    const reversal = await transaction.supplierLedgerEntry.create({
      data: {
        tenantId,
        supplierId: entry.supplierId,
        branchId: entry.branchId,
        type: "reversal",
        referenceType: entry.referenceType,
        referenceId: entry.referenceId,
        documentNumber: `REV-${entry.documentNumber}`,
        originalAmount: -Number(entry.originalAmount),
        appliedAmount: -Number(entry.appliedAmount),
        remainingAmount: -Number(entry.remainingAmount),
        currency: entry.currency,
        dueDate: entry.dueDate,
        paidAt: entry.paidAt,
        status: entry.status === "open" ? "closed" : "open",
        notes: `Reversión: ${reason ?? entry.notes ?? ""}`.trim(),
        createdById: userId,
      },
    });

    await transaction.supplierLedgerEntry.update({
      where: { id: entryId },
      data: { status: "reversed", notes: `${entry.notes ?? ""}\nRevertido: ${reason ?? ""}`.trim() },
    });

    if (entry.referenceType === "purchase_invoice" || entry.referenceType === "expense") {
      await transaction.supplier.updateMany({
        where: { id: entry.supplierId, tenantId },
        data: { currentBalance: { decrement: Number(entry.originalAmount) } },
      });
    }

    return reversal;
  });
}

/** @summary Crea una entrada en el ledger de proveedor. */
export async function createSupplierLedgerEntry(
  transaction: Prisma.TransactionClient | typeof prisma,
  tenantId: number,
  userId: number | null,
  input: {
    supplierId: number;
    branchId?: number | null;
    type: string;
    referenceType?: string | null;
    referenceId?: number | null;
    documentNumber?: string | null;
    originalAmount: number;
    appliedAmount?: number;
    remainingAmount?: number;
    currency?: string;
    dueDate?: Date | string | null;
    paidAt?: Date | string | null;
    status?: string;
    notes?: string | null;
  },
) {
  const originalAmount = Number(input.originalAmount);
  const appliedAmount = Number(input.appliedAmount ?? 0);
  const remainingAmount = Number(input.remainingAmount ?? originalAmount - appliedAmount);

  return transaction.supplierLedgerEntry.create({
    data: {
      tenantId,
      supplierId: input.supplierId,
      branchId: input.branchId ?? null,
      type: input.type,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      documentNumber: input.documentNumber?.trim() || null,
      originalAmount,
      appliedAmount,
      remainingAmount,
      currency: input.currency || "ARS",
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      paidAt: input.paidAt ? new Date(input.paidAt) : null,
      status: input.status || "open",
      notes: input.notes?.trim() || null,
      createdById: userId,
    },
  });
}

/** @summary Lista el ledger de un proveedor con filtros. */
export async function listSupplierLedger(
  tenantId: number,
  supplierId: number,
  filters: { type?: string; status?: string; from?: string; to?: string; limit?: number; offset?: number } = {},
) {
  const where: Prisma.SupplierLedgerEntryWhereInput = { tenantId, supplierId };
  if (filters.type) where.type = filters.type;
  if (filters.status) where.status = filters.status;
  if (filters.from) where.createdAt = { ...(where.createdAt as object | undefined), gte: new Date(filters.from) };
  if (filters.to) where.createdAt = { ...(where.createdAt as object | undefined), lte: new Date(filters.to) };

  const [items, total] = await Promise.all([
    prisma.supplierLedgerEntry.findMany({
      where,
      include: { createdBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: filters.limit ?? 100,
      skip: filters.offset ?? 0,
    }),
    prisma.supplierLedgerEntry.count({ where }),
  ]);
  return { items, total };
}

/** @summary Resumen de cuenta del proveedor: saldo, vencido, próximos vencimientos. */
export async function getSupplierStatement(tenantId: number, supplierId: number) {
  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, tenantId },
    select: { id: true, name: true, currentBalance: true, currency: true },
  });
  if (!supplier) throw new PurchaseError("El proveedor no existe", 404);

  const now = new Date();
  const overdue = await prisma.supplierLedgerEntry.aggregate({
    where: { tenantId, supplierId, status: "open", dueDate: { lt: now } },
    _sum: { remainingAmount: true },
  });
  const upcoming = await prisma.supplierLedgerEntry.findMany({
    where: { tenantId, supplierId, status: "open", dueDate: { gte: now, lte: new Date(now.getTime() + 30 * 86400000) } },
    select: { id: true, documentNumber: true, type: true, originalAmount: true, appliedAmount: true, remainingAmount: true, dueDate: true },
    orderBy: { dueDate: "asc" },
    take: 20,
  });
  const recent = await prisma.supplierLedgerEntry.findMany({
    where: { tenantId, supplierId },
    include: { createdBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return {
    supplier,
    balance: Number(supplier.currentBalance),
    overdue: Number(overdue._sum.remainingAmount ?? 0),
    upcoming,
    recent,
  };
}

/** @summary Redondea un importe a dos decimales. */
export function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
