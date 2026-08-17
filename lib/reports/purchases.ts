import { prisma } from "@/lib/prisma";
import type { Period, ReportFilters, ComprasKpis, PurchaseItem } from "./index";

/** @summary Filtro base de compras: tenant y rango de fechas en recepciones. */
export function purchaseWhere(tenantId: number, period: Period, filters: ReportFilters) {
  const where = {
    tenantId,
    receivedAt: { gte: period.from, lte: period.to },
    ...(filters.branchId && filters.branchId > 0 ? { branchId: filters.branchId } : {}),
    ...(filters.supplierId ? { supplierId: filters.supplierId } : {}),
  } as Record<string, unknown>;

  if (filters.productId) {
    where.items = {
      some: { productId: filters.productId },
    };
  }

  return where;
}

/** @summary KPIs de compras. */
export async function computeComprasKpis(
  tenantId: number,
  period: Period,
  filters: ReportFilters,
): Promise<ComprasKpis> {
  const where = purchaseWhere(tenantId, period, filters);

  const [receiptCountResult, supplierCountResult] = await Promise.all([
    prisma.purchaseReceipt.count({ where }),
    prisma.purchaseReceipt.groupBy({
      by: ["supplierId"],
      where,
      _count: { _all: true },
    }),
  ]);

  const items = await prisma.purchaseReceiptItem.findMany({
    where: { receipt: where },
    select: { quantity: true, unitCost: true },
  });
  const totalPurchasedAccurate = items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitCost), 0);

  return {
    totalPurchased: totalPurchasedAccurate,
    operationCount: receiptCountResult,
    activeSuppliers: supplierCountResult.length,
  };
}

/** @summary Detalle cronológico de compras. */
export async function computePurchaseItems(
  tenantId: number,
  period: Period,
  filters: ReportFilters,
  page = 1,
  pageSize = 50,
): Promise<{ items: PurchaseItem[]; total: number }> {
  const where = purchaseWhere(tenantId, period, filters);

  const [items, total] = await Promise.all([
    prisma.purchaseReceiptItem.findMany({
      where: { receipt: where },
      select: {
        quantity: true,
        unit: true,
        unitCost: true,
        receipt: {
          select: {
            receivedAt: true,
            number: true,
            branch: { select: { name: true } },
            supplier: { select: { name: true } },
          },
        },
        product: { select: { name: true } },
      },
      orderBy: { receipt: { receivedAt: "desc" } },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.purchaseReceiptItem.count({ where: { receipt: where } }),
  ]);

  const mapped: PurchaseItem[] = items.map((item) => ({
    date: item.receipt.receivedAt.toISOString().slice(0, 10),
    supplierName: item.receipt.supplier.name,
    document: item.receipt.number,
    productName: item.product.name,
    quantity: Number(item.quantity),
    unit: item.unit,
    unitCost: Number(item.unitCost),
    total: Number(item.quantity) * Number(item.unitCost),
    branchName: item.receipt.branch.name,
  }));

  return { items: mapped, total };
}

/** @summary Evolución de costos por producto. */
export async function computeCostEvolution(
  tenantId: number,
  productId: number,
  period: Period,
  filters: ReportFilters,
) {
  const where = purchaseWhere(tenantId, period, filters);
  const items = await prisma.purchaseReceiptItem.findMany({
    where: {
      receipt: where,
      productId,
    },
    select: {
      quantity: true,
      unitCost: true,
      receipt: {
        select: { receivedAt: true, number: true },
      },
    },
    orderBy: { receipt: { receivedAt: "asc" } },
  });

  return items.map((item) => ({
    date: item.receipt.receivedAt.toISOString().slice(0, 10),
    unitCost: Number(item.unitCost),
    quantity: Number(item.quantity),
    document: item.receipt.number,
  }));
}
