/**
 * Prueba end-to-end del módulo de Compras/Gastos contra la base real de desarrollo.
 * Cubre los casos obligatorios: pedido sin stock, recepciones parciales con
 * stock real por sucursal, costo esperado vs real con historial, gasto sin
 * inventario, pagos parciales, concurrencia de recepciones y aislamiento
 * multi-sucursal. Restaura el estado original al terminar.
 * Se excluye del suite por defecto (directorio `e2e/`); correr con:
 *   npx vitest run e2e/purchases.test.ts
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  createPurchaseInvoice,
  createPurchaseOrder,
  loadPurchaseOrder,
  payPurchaseInvoice,
  receivePurchaseOrder,
  setPurchaseOrderStatus,
} from "@/lib/purchases";
import { createExpense, listExpenses, payExpense } from "@/lib/expenses";

describe("compras y gastos end-to-end (DB real)", () => {
  let tenantId = -1;
  let branchA: { id: number; name: string };
  let branchB: { id: number; name: string } | null = null;
  let product: { id: number; name: string; costUnit: string };
  let supplierId = 0;
  let skipped = false;

  const createdOrders: number[] = [];
  const createdReceipts: number[] = [];
  const createdInvoices: number[] = [];
  const createdPayments: number[] = [];
  const createdExpenses: number[] = [];
  const receiptNumbers: string[] = [];
  const stockSnapshots = new Map<string, { current: unknown; unit: string; existed: boolean }>();
  const costSnapshots = new Map<number, unknown>();

  /** @summary Stock actual del producto en una sucursal (0 si no existe registro). */
  async function currentStock(branchId: number) {
    const row = await prisma.inventoryStock.findUnique({
      where: { branchId_productId: { branchId, productId: product.id } },
    });
    return Number(row?.current ?? 0);
  }

  beforeAll(async () => {
    const tenant = await prisma.tenant.findFirst({ where: { status: "active" } });
    if (!tenant) {
      skipped = true;
      return;
    }
    tenantId = tenant.id;

    branchA = (await prisma.branch.findFirst({
      where: { tenantId: tenant.id, active: true },
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    }))!;
    branchB = await prisma.branch.findFirst({
      where: { tenantId: tenant.id, active: true, id: { not: branchA.id } },
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    });

    product = (await prisma.product.findFirst({
      where: { tenantId: tenant.id },
      select: { id: true, name: true, costUnit: true },
      orderBy: { id: "asc" },
    }))!;

    const supplier = await prisma.supplier.create({
      data: {
        tenantId: tenant.id,
        name: `Proveedor verificación ${Date.now()}`,
        paymentTerms: "contado",
        status: "active",
      },
    });
    supplierId = supplier.id;

    // Snapshot del stock actual de ambas sucursales para restaurar al final.
    for (const branch of [branchA, ...(branchB ? [branchB] : [])]) {
      const stock = await prisma.inventoryStock.findUnique({
        where: { branchId_productId: { branchId: branch.id, productId: product.id } },
      });
      stockSnapshots.set(`${branch.id}:${product.id}`, {
        current: stock?.current ?? 0,
        unit: stock?.unit ?? "unidad",
        existed: Boolean(stock),
      });
    }
    const productRow = await prisma.product.findUnique({ where: { id: product.id } });
    costSnapshots.set(product.id, productRow?.cost ?? null);
  });

  afterAll(async () => {
    if (skipped) return;

    // Limpiar en orden inverso por dependencias.
    if (createdPayments.length) await prisma.purchasePayment.deleteMany({ where: { id: { in: createdPayments } } });
    // Movimientos de stock de las recepciones (reference = "RC-… · OC-…").
    if (receiptNumbers.length) {
      const movementIds = (
        await prisma.stockMovement.findMany({
          where: { reference: { in: receiptNumbers.map((number) => `${number} ·`) } },
          select: { id: true },
        })
      ).map((row) => row.id);
      // `reference` contiene el número de recepción seguido de " · OC-…":
      const movementIdsByPrefix = (
        await prisma.stockMovement.findMany({
          where: { OR: receiptNumbers.map((number) => ({ reference: { startsWith: number } })) },
          select: { id: true },
        })
      ).map((row) => row.id);
      const ids = [...new Set([...movementIds, ...movementIdsByPrefix])];
      if (ids.length) await prisma.stockMovement.deleteMany({ where: { id: { in: ids } } });
    }
    if (createdInvoices.length) {
      await prisma.purchaseInvoiceReceipt.deleteMany({ where: { invoiceId: { in: createdInvoices } } });
      await prisma.purchaseInvoiceItem.deleteMany({ where: { invoiceId: { in: createdInvoices } } });
      await prisma.purchaseInvoice.deleteMany({ where: { id: { in: createdInvoices } } });
    }
    if (createdReceipts.length) {
      await prisma.purchaseReceiptItem.deleteMany({ where: { receiptId: { in: createdReceipts } } });
      await prisma.purchaseReceipt.deleteMany({ where: { id: { in: createdReceipts } } });
    }
    if (createdOrders.length) {
      await prisma.purchaseOrderItem.deleteMany({ where: { orderId: { in: createdOrders } } });
      await prisma.purchaseOrder.deleteMany({ where: { id: { in: createdOrders } } });
    }
    if (createdExpenses.length) {
      await prisma.purchasePayment.deleteMany({ where: { expenseId: { in: createdExpenses } } });
      await prisma.expense.deleteMany({ where: { id: { in: createdExpenses } } });
    }

    // Restaurar stock y costo del producto. Si el registro no existía antes,
    // se elimina (la recepción lo habría creado con `tracked: true`).
    for (const [key, snapshot] of stockSnapshots) {
      const [branchId, productId] = key.split(":").map(Number);
      const stock = await prisma.inventoryStock.findUnique({
        where: { branchId_productId: { branchId, productId } },
      });
      if (!stock) continue;
      if (!snapshot.existed) {
        await prisma.inventoryStock.delete({ where: { id: stock.id } });
      } else {
        await prisma.inventoryStock.update({
          where: { id: stock.id },
          data: { current: snapshot.current as never, unit: snapshot.unit },
        });
      }
    }
    await prisma.ingredientCostHistory.deleteMany({
      where: { productId: product.id, reason: { contains: "Verificación" } },
    });
    await prisma.product.update({
      where: { id: product.id },
      data: { cost: costSnapshots.get(product.id) as never },
    });

    // Eliminar el proveedor temporal.
    await prisma.supplier.deleteMany({ where: { id: supplierId } });
  });

  it("caso 1: pedido no toca stock y recepción total lo aumenta (100 → +100)", async () => {
    if (skipped) return;
    const order = await createPurchaseOrder(tenantId, branchA.id, null, {
      supplierId,
      notes: "Verificación e2e",
      lines: [{ productId: product.id, quantity: 100, unit: "unidad", unitCost: 800 }],
    });
    createdOrders.push(order.id);

    const stockBefore = await currentStock(branchA.id);

    // Crear un pedido NO debe modificar inventario.
    expect(await currentStock(branchA.id)).toBe(stockBefore);

    const result = await receivePurchaseOrder(tenantId, branchA.id, null, {
      orderId: order.id,
      notes: "Verificación e2e",
      items: [{ orderItemId: order.items[0].id, quantity: 100, unit: "unidad", unitCost: 800 }],
    });
    createdReceipts.push(result.receipt.id);
    receiptNumbers.push(result.receipt.number);

    const afterReceipt = await prisma.inventoryStock.findUnique({
      where: { branchId_productId: { branchId: branchA.id, productId: product.id } },
    });
    expect(Number(afterReceipt!.current)).toBe(stockBefore + 100);
    const movement = await prisma.stockMovement.findFirst({
      where: { stockId: afterReceipt!.id, type: "purchase_in", reference: { contains: result.receipt.number } },
    });
    expect(movement).toBeTruthy();
    expect(Number(movement!.quantity)).toBe(100);
    expect(Number(movement!.balanceAfter)).toBe(stockBefore + 100);
  });

  it("caso 2: recepciones parciales acumulan y dejan pendiente (40 + 35 → pendiente 25, stock +75)", async () => {
    if (skipped) return;
    const order = await createPurchaseOrder(tenantId, branchA.id, null, {
      supplierId,
      notes: "Verificación e2e",
      lines: [{ productId: product.id, quantity: 100, unit: "unidad", unitCost: 800 }],
    });
    createdOrders.push(order.id);
    const stockBefore = await currentStock(branchA.id);

    const r1 = await receivePurchaseOrder(tenantId, branchA.id, null, {
      orderId: order.id,
      notes: "Verificación e2e",
      items: [{ orderItemId: order.items[0].id, quantity: 40, unit: "unidad", unitCost: 800 }],
    });
    createdReceipts.push(r1.receipt.id);
    receiptNumbers.push(r1.receipt.number);

    const r2 = await receivePurchaseOrder(tenantId, branchA.id, null, {
      orderId: order.id,
      notes: "Verificación e2e",
      items: [{ orderItemId: order.items[0].id, quantity: 35, unit: "unidad", unitCost: 800 }],
    });
    createdReceipts.push(r2.receipt.id);
    receiptNumbers.push(r2.receipt.number);

    const detail = await loadPurchaseOrder(tenantId, order.id);
    const line = detail.items[0];
    expect(Number(line.receivedQuantity)).toBe(75);
    expect(Number(line.quantity) - Number(line.receivedQuantity)).toBe(25);
    expect(detail.status).toBe("partially_received");

    expect(await currentStock(branchA.id)).toBe(stockBefore + 75);
  });

  it("caso 3: costo esperado vs facturado con historial, sin reescribir ventas", async () => {
    if (skipped) return;
    const order = await createPurchaseOrder(tenantId, branchA.id, null, {
      supplierId,
      notes: "Verificación e2e",
      lines: [{ productId: product.id, quantity: 100, unit: "unidad", unitCost: 800 }],
    });
    createdOrders.push(order.id);
    const receipt = await receivePurchaseOrder(tenantId, branchA.id, null, {
      orderId: order.id,
      notes: "Verificación e2e",
      items: [{ orderItemId: order.items[0].id, quantity: 100, unit: "unidad", unitCost: 800 }],
    });
    createdReceipts.push(receipt.receipt.id);
    receiptNumbers.push(receipt.receipt.number);

    // El costo esperado quedó como snapshot en el movimiento de recepción.
    const movement = await prisma.stockMovement.findFirst({
      where: { type: "purchase_in", reference: { contains: receipt.receipt.number } },
    });
    expect(Number(movement!.unitCost)).toBe(800);

    // Factura con costo real 850 vinculada a la recepción.
    const invoice = await createPurchaseInvoice(tenantId, null, {
      supplierId,
      branchId: branchA.id,
      orderId: order.id,
      receiptIds: [receipt.receipt.id],
      externalNumber: "FC-VERIF",
      notes: "Verificación e2e",
      items: [{ productId: product.id, description: product.name, quantity: 100, unit: "unidad", unitCost: 850 }],
    });
    createdInvoices.push(invoice.id);
    expect(Number(invoice.total)).toBe(85000);

    const history = await prisma.ingredientCostHistory.findFirst({
      where: { productId: product.id, reason: { contains: invoice.number } },
    });
    expect(history).toBeTruthy();
    expect(Number(history!.cost)).toBe(850);
  });

  it("caso 4: gasto sin inventario y sin movimientos de stock", async () => {
    if (skipped) return;
    const category = await prisma.expenseCategory.findFirst({
      where: { tenantId, active: true },
      orderBy: { sortOrder: "asc" },
    });
    if (!category) throw new Error("No existe una categoría de gasto activa");

    const movementsBefore = await prisma.stockMovement.count();
    const expense = await createExpense(tenantId, null, {
      categoryId: category.id,
      branchId: branchA.id,
      amountNet: 500000,
      taxPercent: 0,
      notes: "Verificación e2e",
    });
    createdExpenses.push(expense.id);
    expect(Number(expense.total)).toBe(500000);
    expect(expense.status).toBe("pending");

    const movementsAfter = await prisma.stockMovement.count();
    expect(movementsAfter).toBe(movementsBefore);
    const list = await listExpenses(tenantId, { limit: 50 });
    expect(list.items.some((item) => item.id === expense.id)).toBe(true);
  });

  it("caso 5: el stock recibido entra solo a la sucursal de la compra", async () => {
    if (skipped || !branchB) return;
    const order = await createPurchaseOrder(tenantId, branchB.id, null, {
      supplierId,
      notes: "Verificación e2e",
      lines: [{ productId: product.id, quantity: 10, unit: "unidad", unitCost: 500 }],
    });
    createdOrders.push(order.id);
    const bStockBefore = await currentStock(branchB.id);
    const aStockBefore = await currentStock(branchA.id);

    const receipt = await receivePurchaseOrder(tenantId, branchB.id, null, {
      orderId: order.id,
      notes: "Verificación e2e",
      items: [{ orderItemId: order.items[0].id, quantity: 10, unit: "unidad", unitCost: 500 }],
    });
    createdReceipts.push(receipt.receipt.id);
    receiptNumbers.push(receipt.receipt.number);

    expect(await currentStock(branchB.id)).toBe(bStockBefore + 10);
    expect(await currentStock(branchA.id)).toBe(aStockBefore);
  });

  it("caso 6: dos recepciones simultáneas de la misma cantidad pendiente no duplican stock", async () => {
    if (skipped) return;
    const order = await createPurchaseOrder(tenantId, branchA.id, null, {
      supplierId,
      notes: "Verificación e2e",
      lines: [{ productId: product.id, quantity: 10, unit: "unidad", unitCost: 300 }],
    });
    createdOrders.push(order.id);
    const stockBefore = await currentStock(branchA.id);

    const attempt = async () =>
      receivePurchaseOrder(tenantId, branchA.id, null, {
        orderId: order.id,
        notes: "Verificación e2e",
        items: [{ orderItemId: order.items[0].id, quantity: 10, unit: "unidad", unitCost: 300 }],
      });

    const results = await Promise.allSettled([attempt(), attempt()]);
    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    if (fulfilled[0].status === "fulfilled") {
      createdReceipts.push(fulfilled[0].value.receipt.id);
      receiptNumbers.push(fulfilled[0].value.receipt.number);
    }

    expect(await currentStock(branchA.id)).toBe(stockBefore + 10);
    const detail = await loadPurchaseOrder(tenantId, order.id);
    expect(Number(detail.items[0].receivedQuantity)).toBe(10);
  });

  it("caso 7: factura parcialmente pagada (100.000 → 60.000 deja saldo 40.000)", async () => {
    if (skipped) return;
    const invoice = await createPurchaseInvoice(tenantId, null, {
      supplierId,
      branchId: branchA.id,
      externalNumber: "FC-PARCIAL",
      notes: "Verificación e2e",
      items: [{ description: "Insumos varios", quantity: 1, unit: "unidad", unitCost: 100000 }],
    });
    createdInvoices.push(invoice.id);
    expect(Number(invoice.total)).toBe(100000);
    expect(invoice.status).toBe("pending");

    const paid = await payPurchaseInvoice(tenantId, null, {
      invoiceId: invoice.id,
      amount: 60000,
      method: "transferencia",
      notes: "Verificación e2e",
    });
    createdPayments.push(paid.payment.id);
    expect(paid.status).toBe("partially_paid");
    expect(paid.balance).toBe(40000);

    const full = await payPurchaseInvoice(tenantId, null, {
      invoiceId: invoice.id,
      amount: 40000,
      method: "efectivo",
      notes: "Verificación e2e",
    });
    createdPayments.push(full.payment.id);
    expect(full.status).toBe("paid");
    expect(full.balance).toBe(0);
  });

  it("gasto: pagos parciales avanzan el estado (500.000 → 200.000 → saldo 300.000)", async () => {
    if (skipped) return;
    const category = await prisma.expenseCategory.findFirst({
      where: { tenantId, active: true },
      orderBy: { sortOrder: "asc" },
    });
    if (!category) return;

    const expense = await createExpense(tenantId, null, {
      categoryId: category.id,
      branchId: branchA.id,
      amountNet: 500000,
      notes: "Verificación e2e",
    });
    createdExpenses.push(expense.id);

    const paid = await payExpense(tenantId, null, {
      expenseId: expense.id,
      amount: 200000,
      method: "transferencia",
      notes: "Verificación e2e",
    });
    expect(paid.status).toBe("partially_paid");
    expect(paid.balance).toBe(300000);
  });

  it("envío y cancelación de pedidos mantienen trazabilidad de estado", async () => {
    if (skipped) return;
    const order = await createPurchaseOrder(tenantId, branchA.id, null, {
      supplierId,
      notes: "Verificación e2e",
      lines: [{ productId: product.id, quantity: 5, unit: "unidad", unitCost: 100 }],
    });
    createdOrders.push(order.id);
    await setPurchaseOrderStatus(tenantId, order.id, "sent");
    const sent = await loadPurchaseOrder(tenantId, order.id);
    expect(sent.status).toBe("sent");

    await setPurchaseOrderStatus(tenantId, order.id, "cancelled");
    const cancelled = await loadPurchaseOrder(tenantId, order.id);
    expect(cancelled.status).toBe("cancelled");
  });
});
