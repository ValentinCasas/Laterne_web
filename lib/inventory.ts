import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { orderReference } from "@/lib/order-security";
import { convertQuantity, type UnitConversionRow } from "@/lib/recipe-units";

/**
 * Servicio de inventario de MenuClick.
 *
 * Opera sobre el modelo existente (`InventoryStock` + `StockMovement`) y lo
 * extiende sin duplicar: mermas, reservas, transferencias entre sucursales y
 * conteos físicos generan movimientos con tipo, cantidad, motivo, usuario,
 * referencia y saldo resultante. Toda mutación usa guardas atómicas
 * (`updateMany` con condición) para no dejar stock negativo por carreras cuando
 * la política lo prohíbe.
 */

export type StockPolicy = "strict" | "warn";

/** @summary Error de negocio de inventario con código HTTP sugerido. */
export class InventoryError extends Error {
  status: number;
  constructor(message: string, status = 409) {
    super(message);
    this.name = "InventoryError";
    this.status = status;
  }
}

/** @summary Devuelve la política de venta sin stock del negocio (por defecto estricta). */
export async function inventoryPolicy(
  tenantId: number,
  client: Pick<Prisma.TransactionClient, "inventorySettings"> = prisma,
): Promise<{ stockPolicy: StockPolicy }> {
  const settings = await client.inventorySettings.findUnique({
    where: { tenantId },
    select: { stockPolicy: true },
  });
  return { stockPolicy: settings?.stockPolicy === "warn" ? "warn" : "strict" };
}

/** @summary Crea la configuración de inventario si falta y actualiza la política. */
export async function updateInventoryPolicy(tenantId: number, stockPolicy: StockPolicy) {
  if (stockPolicy !== "strict" && stockPolicy !== "warn") {
    throw new InventoryError("Política de stock inválida", 400);
  }
  return prisma.inventorySettings.upsert({
    where: { tenantId },
    create: { tenantId, stockPolicy },
    update: { stockPolicy },
  });
}

/**
 * @summary Existencias controladas de un plan de consumo sin validar disponibilidad.
 * Se usa con política permisiva (warn): la venta avanza y puede quedar stock negativo.
 */
export async function trackedStocksForPlan(
  client: Pick<Prisma.TransactionClient, "inventoryStock">,
  tenantId: number,
  branchId: number,
  plan: Map<number, number>,
) {
  return client.inventoryStock.findMany({
    where: { tenantId, branchId, productId: { in: [...plan.keys()] }, tracked: true },
  });
}

/**
 * @summary Costo por unidad de existencia (stock.unit) usando el costo del producto
 * y las conversiones del negocio. Devuelve null si no hay costo o no se puede convertir.
 */
export function stockUnitCost(
  product: { cost: number | null; costUnit: string },
  stock: { unit: string },
  conversions: readonly UnitConversionRow[],
): number | null {
  if (product.cost === null || product.cost === undefined) return null;
  const base = product.costUnit || "unidad";
  const unit = stock.unit || "unidad";
  if (base === unit) return product.cost;
  try {
    const perBase = convertQuantity(1, base, unit, conversions);
    if (!Number.isFinite(perBase) || perBase <= 0) return null;
    return product.cost / perBase;
  } catch {
    return null;
  }
}

/** @summary Crea una notificación de stock bajo dentro de la transacción. */
async function notifyLowStock(
  transaction: Prisma.TransactionClient,
  input: {
    tenantId: number;
    branchId: number;
    productName: string;
    current: number;
    unit: string;
  },
) {
  await transaction.notification.create({
    data: {
      tenantId: input.tenantId,
      branchId: input.branchId,
      type: "stock.low",
      title: `Stock bajo · ${input.productName}`,
      message: `Quedaron ${input.current} ${input.unit}.`,
      link: "/admin/inventario",
    },
  });
}

/** @summary Recupera una existencia controlada de la sucursal o lanza error legible. */
async function requireTrackedStock(
  client: Prisma.TransactionClient | typeof prisma,
  tenantId: number,
  branchId: number,
  productId: number,
) {
  const stock = await client.inventoryStock.findUnique({
    where: { branchId_productId: { branchId, productId } },
    include: { product: { select: { id: true, name: true, cost: true, costUnit: true } } },
  });
  if (!stock) throw new InventoryError("El producto no tiene existencias en esta sucursal", 404);
  if (!stock.tracked) throw new InventoryError("El producto no tiene control de stock activado", 409);
  return stock;
}

/** @summary Costo por unidad de existencia con conversión o null. */
function unitCostForStock(
  stock: { product: { cost: Prisma.Decimal | number | null; costUnit: string }; unit: string },
  conversions: readonly UnitConversionRow[],
): number | null {
  return stockUnitCost(
    { cost: stock.product.cost === null || stock.product.cost === undefined ? null : Number(stock.product.cost), costUnit: stock.product.costUnit },
    { unit: stock.unit },
    conversions,
  );
}

/** @summary Registra una merma/desperdicio con motivo y costo estimado (snapshot). */
export async function registerWaste(
  tenantId: number,
  branchId: number,
  input: { productId: number; quantity: number; unit?: string; reason: string },
) {
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw new InventoryError("La cantidad de merma debe ser mayor a cero", 400);
  }
  return prisma.$transaction(async (transaction) => {
    const stock = await requireTrackedStock(transaction, tenantId, branchId, input.productId);
    const conversions = await transaction.unitConversion.findMany({
      where: { tenantId },
      select: { fromUnit: true, toUnit: true, factor: true },
    });
    const rows: UnitConversionRow[] = conversions.map((row) => ({
      fromUnit: row.fromUnit,
      toUnit: row.toUnit,
      factor: Number(row.factor),
    }));
    const converted = convertQuantity(input.quantity, input.unit ?? stock.unit, stock.unit, rows);

    const result = await transaction.inventoryStock.updateMany({
      where: { id: stock.id, current: { gte: converted } },
      data: { current: { decrement: converted } },
    });
    if (result.count !== 1) throw new InventoryError("No hay stock suficiente para registrar la merma", 409);

    const updated = await transaction.inventoryStock.findUniqueOrThrow({ where: { id: stock.id } });
    const unitCost = unitCostForStock(stock, rows);
    const reference = orderReference(new Date(), "MER");
    await transaction.stockMovement.create({
      data: {
        tenantId,
        stockId: stock.id,
        userId: null,
        type: "waste",
        quantity: -converted,
        balanceAfter: updated.current,
        unitCost,
        reference,
        reason: input.reason.trim() || `Merma ${reference}`,
      },
    });
    if (Number(updated.current) <= Number(updated.minimum)) {
      await notifyLowStock(transaction, {
        tenantId,
        branchId,
        productName: stock.product.name,
        current: Number(updated.current),
        unit: updated.unit,
      });
    }
    return { movement: { quantity: -converted, balanceAfter: Number(updated.current), unitCost, reference }, stockId: stock.id };
  });
}

/** @summary Reserva o libera stock de una sucursal con movimientos de reserva. */
export async function reserveStock(
  tenantId: number,
  branchId: number,
  input: { productId: number; quantity: number; reason: string; action: "reserve" | "release"; userId?: number | null },
) {
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw new InventoryError("La cantidad debe ser mayor a cero", 400);
  }
  const reserve = input.action === "reserve";
  return prisma.$transaction(async (transaction) => {
    const stock = await requireTrackedStock(transaction, tenantId, branchId, input.productId);
    // Guarda atómica: reservar nunca supera el físico disponible; liberar nunca baja de cero.
    const where = reserve
      ? { id: stock.id, current: { gte: Number(stock.reserved) + input.quantity } }
      : { id: stock.id, reserved: { gte: input.quantity } };
    const result = await transaction.inventoryStock.updateMany({
      where,
      data: reserve ? { reserved: { increment: input.quantity } } : { reserved: { decrement: input.quantity } },
    });
    if (result.count !== 1) {
      throw new InventoryError(
        reserve
          ? "No hay stock disponible para reservar esa cantidad"
          : "No hay tantas unidades reservadas para liberar",
        409,
      );
    }
    const updated = await transaction.inventoryStock.findUniqueOrThrow({ where: { id: stock.id } });
    await transaction.stockMovement.create({
      data: {
        tenantId,
        stockId: stock.id,
        userId: input.userId ?? null,
        type: reserve ? "reserve" : "release",
        quantity: reserve ? input.quantity : -input.quantity,
        balanceAfter: Number(updated.current),
        reservedAfter: Number(updated.reserved),
        reference: orderReference(new Date(), reserve ? "RES" : "LIB"),
        reason: input.reason.trim() || (reserve ? "Reserva de stock" : "Liberación de reserva"),
      },
    });
    return { stock: updated };
  });
}

/**
 * @summary Transfiere stock entre sucursales de forma atómica.
 * Salida del origen + entrada del destino en la misma transacción, con dos
 * movimientos (`transfer_out` / `transfer_in`) vinculados por `transferId`.
 */
export async function createStockTransfer(
  tenantId: number,
  input: {
    fromBranchId: number;
    toBranchId: number;
    productId: number;
    quantity: number;
    unit?: string;
    note?: string;
    userId?: number | null;
  },
) {
  if (input.fromBranchId === input.toBranchId) {
    throw new InventoryError("El origen y el destino deben ser sucursales distintas", 400);
  }
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw new InventoryError("La cantidad a transferir debe ser mayor a cero", 400);
  }
  const branches = await prisma.branch.findMany({
    where: { id: { in: [input.fromBranchId, input.toBranchId] }, tenantId },
    select: { id: true },
  });
  if (branches.length !== 2) throw new InventoryError("Una de las sucursales no pertenece al negocio", 400);

  return prisma.$transaction(async (transaction) => {
    const origin = await requireTrackedStock(transaction, tenantId, input.fromBranchId, input.productId);
    const unit = input.unit ?? origin.unit;
    const conversionsRows = await transaction.unitConversion.findMany({
      where: { tenantId },
      select: { fromUnit: true, toUnit: true, factor: true },
    });
    const conversions: UnitConversionRow[] = conversionsRows.map((row) => ({
      fromUnit: row.fromUnit,
      toUnit: row.toUnit,
      factor: Number(row.factor),
    }));

    // La cantidad se expresa en la unidad del origen y se convierte a la del destino.
    const converted = convertQuantity(input.quantity, unit, origin.unit, conversions);
    const result = await transaction.inventoryStock.updateMany({
      where: { id: origin.id, current: { gte: converted } },
      data: { current: { decrement: converted } },
    });
    if (result.count !== 1) throw new InventoryError("El origen no tiene stock suficiente para transferir", 409);
    const originAfter = await transaction.inventoryStock.findUniqueOrThrow({ where: { id: origin.id } });

    const destination = await transaction.inventoryStock.findUnique({
      where: { branchId_productId: { branchId: input.toBranchId, productId: input.productId } },
    });
    const destinationUnit = destination?.unit ?? unit;
    const incoming = convertQuantity(converted, origin.unit, destinationUnit, conversions);
    const destinationAfter = destination
      ? await transaction.inventoryStock.update({
          where: { id: destination.id },
          data: { current: { increment: incoming } },
        })
      : await transaction.inventoryStock.create({
          data: {
            tenantId,
            branchId: input.toBranchId,
            productId: input.productId,
            tracked: true,
            current: incoming,
            minimum: 0,
            unit: destinationUnit,
          },
        });

    const reference = orderReference(new Date(), "TRF");
    const transfer = await transaction.stockTransfer.create({
      data: {
        tenantId,
        reference,
        fromBranchId: input.fromBranchId,
        toBranchId: input.toBranchId,
        productId: input.productId,
        quantity: converted,
        unit: origin.unit,
        status: "completed",
        note: input.note?.trim() || null,
        createdById: input.userId ?? null,
      },
    });

    const unitCost = unitCostForStock(origin, conversions);
    await transaction.stockMovement.create({
      data: {
        tenantId,
        stockId: origin.id,
        transferId: transfer.id,
        userId: input.userId ?? null,
        type: "transfer_out",
        quantity: -converted,
        balanceAfter: Number(originAfter.current),
        unitCost,
        reference,
        reason: `Transferencia a sucursal · ${reference}`,
      },
    });
    await transaction.stockMovement.create({
      data: {
        tenantId,
        stockId: destinationAfter.id,
        transferId: transfer.id,
        userId: input.userId ?? null,
        type: "transfer_in",
        quantity: incoming,
        balanceAfter: Number(destinationAfter.current),
        unitCost,
        reference,
        reason: `Transferencia desde sucursal · ${reference}`,
      },
    });
    return { transfer, originAfter, destinationAfter };
  });
}

/** @summary Referencia de un conteo físico. */
export function countReference(date = new Date()) {
  return orderReference(date, "CNT");
}

/** @summary Abre una sesión de conteo físico con la cantidad de sistema de cada existencia. */
export async function createCountSession(
  tenantId: number,
  branchId: number,
  input: { note?: string; userId?: number | null },
) {
  return prisma.$transaction(async (transaction) => {
    const stocks = await transaction.inventoryStock.findMany({
      where: { tenantId, branchId },
      include: { product: { select: { id: true, name: true } } },
      orderBy: { product: { name: "asc" } },
    });
    if (stocks.length === 0) throw new InventoryError("Esta sucursal no tiene existencias para contar", 400);

    const session = await transaction.inventoryCountSession.create({
      data: {
        tenantId,
        branchId,
        reference: countReference(),
        status: "open",
        note: input.note?.trim() || null,
        startedById: input.userId ?? null,
        items: {
          create: stocks.map((stock) => ({
            stockId: stock.id,
            productId: stock.productId,
            systemQuantity: stock.current,
            countedQuantity: stock.current,
            difference: 0,
          })),
        },
      },
      include: {
        branch: { select: { name: true } },
        items: { include: { product: { select: { id: true, name: true } } } },
      },
    });
    return session;
  });
}

/** @summary Registra las cantidades contadas de una sesión abierta (recalcula diferencias). */
export async function updateCountSessionItems(
  tenantId: number,
  sessionId: number,
  items: Array<{ id: number; countedQuantity: number }>,
) {
  return prisma.$transaction(async (transaction) => {
    const session = await transaction.inventoryCountSession.findFirst({
      where: { id: sessionId, tenantId, status: "open" },
      select: { id: true },
    });
    if (!session) throw new InventoryError("La sesión de conteo no existe o ya está cerrada", 409);

    const updates = [];
    for (const item of items) {
      if (!Number.isFinite(item.countedQuantity) || item.countedQuantity < 0) {
        throw new InventoryError("Las cantidades contadas no pueden ser negativas", 400);
      }
      const row = await transaction.inventoryCountItem.findFirst({
        where: { id: item.id, sessionId },
        select: { id: true, systemQuantity: true },
      });
      if (!row) throw new InventoryError("Ítem de conteo inválido", 400);
      const difference = item.countedQuantity - Number(row.systemQuantity);
      updates.push(
        await transaction.inventoryCountItem.update({
          where: { id: item.id },
          data: { countedQuantity: item.countedQuantity, difference },
        }),
      );
    }
    return { items: updates };
  });
}

/** @summary Completa el conteo aplicando los ajustes de diferencia como movimientos. */
export async function completeCountSession(tenantId: number, sessionId: number, userId?: number | null) {
  return prisma.$transaction(async (transaction) => {
    const session = await transaction.inventoryCountSession.findFirst({
      where: { id: sessionId, tenantId, status: "open" },
      include: { items: { include: { stock: { include: { product: { select: { name: true, cost: true, costUnit: true } } } } } } },
    });
    if (!session) throw new InventoryError("La sesión de conteo no existe o ya está cerrada", 409);

    const conversionsRows = await transaction.unitConversion.findMany({
      where: { tenantId },
      select: { fromUnit: true, toUnit: true, factor: true },
    });
    const conversions: UnitConversionRow[] = conversionsRows.map((row) => ({
      fromUnit: row.fromUnit,
      toUnit: row.toUnit,
      factor: Number(row.factor),
    }));

    let adjustments = 0;
    for (const item of session.items) {
      const difference = Number(item.difference);
      if (difference === 0) continue;
      if (!item.stock || !item.stock.tracked) continue;

      // Ajuste atómico: nunca deja stock negativo por carreras.
      const where =
        difference > 0
          ? { id: item.stock.id }
          : { id: item.stock.id, current: { gte: -difference } };
      const result = await transaction.inventoryStock.updateMany({
        where,
        data: { current: { increment: difference } },
      });
      if (result.count !== 1) {
        throw new InventoryError(
          `${item.stock.product.name} no tiene stock suficiente para aplicar el ajuste del conteo. Recontalo.`,
          409,
        );
      }
      const updated = await transaction.inventoryStock.findUniqueOrThrow({ where: { id: item.stock.id } });
      await transaction.inventoryCountItem.update({
        where: { id: item.id },
        data: { adjusted: true },
      });
      await transaction.stockMovement.create({
        data: {
          tenantId,
          stockId: item.stock.id,
          userId,
          type: "count_adjustment",
          quantity: difference,
          balanceAfter: Number(updated.current),
          unitCost: unitCostForStock(item.stock, conversions),
          reference: session.reference,
          reason: `Conteo físico ${session.reference}`,
        },
      });
      adjustments += 1;
      if (Number(updated.current) <= Number(updated.minimum)) {
        await notifyLowStock(transaction, {
          tenantId,
          branchId: session.branchId,
          productName: item.stock.product.name,
          current: Number(updated.current),
          unit: updated.unit,
        });
      }
    }

    const completed = await transaction.inventoryCountSession.update({
      where: { id: session.id },
      data: { status: "completed", completedById: userId ?? null, completedAt: new Date() },
    });
    return { session: completed, adjustments };
  });
}

/** @summary Cancela una sesión de conteo sin aplicar ajustes. */
export async function cancelCountSession(tenantId: number, sessionId: number) {
  const session = await prisma.inventoryCountSession.findFirst({
    where: { id: sessionId, tenantId, status: "open" },
    select: { id: true },
  });
  if (!session) throw new InventoryError("La sesión de conteo no existe o ya está cerrada", 409);
  return prisma.inventoryCountSession.update({
    where: { id: session.id },
    data: { status: "cancelled" },
  });
}

export type MovementHistoryFilters = {
  tenantId: number;
  branchId?: number;
  productId?: number;
  type?: string;
  from?: Date;
  to?: Date;
  search?: string;
  limit?: number;
  offset?: number;
};

/** @summary Historial de movimientos con filtros grandes y paginación. */
export async function loadMovementHistory(filters: MovementHistoryFilters) {
  const where: Prisma.StockMovementWhereInput = { tenantId: filters.tenantId };
  if (filters.branchId) where.stock = { branchId: filters.branchId };
  if (filters.productId) where.stock = { ...(where.stock as object), productId: filters.productId };
  if (filters.type) where.type = filters.type;
  if (filters.from || filters.to) {
    where.createdAt = { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) };
  }
  if (filters.search) {
    const query = filters.search.trim();
    where.OR = [{ reason: { contains: query } }, { reference: { contains: query } }];
  }

  const [movements, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      include: {
        stock: { include: { product: { select: { id: true, name: true } }, branch: { select: { id: true, name: true } } } },
        user: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: filters.limit ?? 50,
      skip: filters.offset ?? 0,
    }),
    prisma.stockMovement.count({ where }),
  ]);
  return { movements, total };
}

export type InventoryDashboard = {
  value: number | null;
  valuedProducts: number;
  lowCount: number;
  outCount: number;
  totalStocks: number;
  wasteCount: number;
  wasteQuantity: number;
  wasteCost: number | null;
  recentMovements: Array<Record<string, unknown>>;
  lowStocks: Array<{ productId: number; name: string; current: number; minimum: number; unit: string }>;
};

/** @summary Datos del dashboard: valor, alertas, mermas y movimientos recientes. */
export async function loadInventoryDashboard(
  tenantId: number,
  branchId: number | null,
  conversions: readonly UnitConversionRow[],
): Promise<InventoryDashboard> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [stocks, products, wastes, recent] = await Promise.all([
    prisma.inventoryStock.findMany({
      where: { tenantId, ...(branchId ? { branchId } : {}) },
      include: { product: { select: { id: true, name: true, cost: true, costUnit: true } } },
    }),
    prisma.product.findMany({ where: { tenantId }, select: { id: true, cost: true, costUnit: true } }),
    prisma.stockMovement.findMany({
      where: { tenantId, type: "waste", createdAt: { gte: since } },
      select: { quantity: true, unitCost: true },
    }),
    prisma.stockMovement.findMany({
      where: { tenantId, ...(branchId ? { stock: { branchId } } : {}) },
      include: {
        stock: { include: { product: { select: { name: true } }, branch: { select: { name: true } } } },
        user: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ]);

  const productCost = new Map(
    products.map((product) => [
      product.id,
      {
        cost: product.cost === null || product.cost === undefined ? null : Number(product.cost),
        costUnit: product.costUnit,
      },
    ]),
  );
  let value = 0;
  let valuedProducts = 0;
  let lowCount = 0;
  let outCount = 0;
  const lowStocks: InventoryDashboard["lowStocks"] = [];

  for (const stock of stocks) {
    if (!stock.tracked) continue;
    const current = Number(stock.current);
    if (current <= 0) outCount += 1;
    else if (current <= Number(stock.minimum)) lowCount += 1;
    if (current <= Number(stock.minimum)) {
      lowStocks.push({
        productId: stock.productId,
        name: stock.product.name,
        current,
        minimum: Number(stock.minimum),
        unit: stock.unit,
      });
    }
    const cost = stockUnitCost(productCost.get(stock.productId) ?? { cost: null, costUnit: "unidad" }, { unit: stock.unit }, conversions);
    if (cost !== null) {
      value += current * cost;
      valuedProducts += 1;
    }
  }

  const wasteQuantity = wastes.reduce((sum, waste) => sum + Math.abs(Number(waste.quantity)), 0);
  const wasteCost = wastes.some((waste) => waste.unitCost === null || waste.unitCost === undefined)
    ? null
    : wastes.reduce((sum, waste) => sum + Math.abs(Number(waste.quantity) * Number(waste.unitCost)), 0);

  lowStocks.sort((first, second) => second.current - first.current);

  return {
    value: Number.isFinite(value) ? value : null,
    valuedProducts,
    lowCount,
    outCount,
    totalStocks: stocks.length,
    wasteCount: wastes.length,
    wasteQuantity,
    wasteCost,
    recentMovements: recent.map((movement) => ({
      id: String(movement.id),
      type: movement.type,
      quantity: String(Number(movement.quantity)),
      balanceAfter: String(Number(movement.balanceAfter)),
      reason: movement.reason,
      reference: movement.reference,
      createdAt: movement.createdAt.toISOString(),
      product: movement.stock.product.name,
      branch: movement.stock.branch.name,
      user: movement.user?.name ?? null,
    })),
    lowStocks,
  };
}

/** @summary Lista sesiones de conteo con resumen para el historial. */
export async function loadCountSessions(tenantId: number, branchId?: number) {
  return prisma.inventoryCountSession.findMany({
    where: { tenantId, ...(branchId ? { branchId } : {}) },
    include: {
      branch: { select: { name: true } },
      startedBy: { select: { name: true } },
      completedBy: { select: { name: true } },
      _count: { select: { items: true } },
    },
    orderBy: { startedAt: "desc" },
    take: 60,
  });
}

/** @summary Detalle de una sesión de conteo con sus ítems. */
export async function loadCountSessionDetail(tenantId: number, sessionId: number) {
  return prisma.inventoryCountSession.findFirst({
    where: { id: sessionId, tenantId },
    include: {
      branch: { select: { name: true } },
      startedBy: { select: { name: true } },
      completedBy: { select: { name: true } },
      items: { include: { product: { select: { id: true, name: true } } }, orderBy: { product: { name: "asc" } } },
    },
  });
}

/** @summary Lista transferencias recientes para el historial. */
export async function loadTransfers(tenantId: number, branchId?: number) {
  return prisma.stockTransfer.findMany({
    where: {
      tenantId,
      ...(branchId ? { OR: [{ fromBranchId: branchId }, { toBranchId: branchId }] } : {}),
    },
    include: {
      fromBranch: { select: { name: true } },
      toBranch: { select: { name: true } },
      product: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 60,
  });
}
