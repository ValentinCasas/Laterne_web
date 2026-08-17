import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { nextDocumentNumber, PurchaseError, round2, PAYMENT_METHODS } from "@/lib/purchases";

/**
 * Servicio de Gastos de MenuClick.
 *
 * Los gastos NO afectan inventario (alquiler, servicios, software…). Se
 * registran como documentos con estado de pago (pendiente/parcial/pagado) y
 * quedan disponibles para Finanzas. Los gastos recurrentes solo generan
 * previsiones: el usuario los confirma antes de convertirlos en gasto real.
 */

/** @summary Etiquetas legibles de los estados de un gasto. */
export const expenseStatusLabels: Record<string, string> = {
  draft: "Borrador",
  pending: "Pendiente",
  partially_paid: "Parcialmente pagado",
  paid: "Pagado",
  cancelled: "Anulado",
};

/** @summary Categorías financieras sugeridas para clasificar gastos sin inventario. */
export const FINANCIAL_CATEGORIES = [
  "alquiler",
  "servicios",
  "personal",
  "marketing",
  "administracion",
  "mantenimiento",
  "otros",
] as const;

export type ExpenseInput = {
  categoryId: number;
  supplierId?: number | null;
  branchId?: number | null;
  expenseDate?: string;
  dueDate?: string | null;
  amountNet: number;
  taxPercent?: number;
  paymentMethod?: string | null;
  financialCategory?: string | null;
  notes?: string;
  attachmentId?: number | null;
  recurringId?: number | null;
};

/** @summary Crea un gasto sin tocar inventario y con estado de pago inicial. */
export async function createExpense(tenantId: number, userId: number | null, input: ExpenseInput) {
  const amountNet = Number(input.amountNet);
  if (!Number.isFinite(amountNet) || amountNet < 0) {
    throw new PurchaseError("El importe del gasto no es válido", 400);
  }
  const category = await prisma.expenseCategory.findFirst({
    where: { id: input.categoryId, tenantId, active: true },
  });
  if (!category) throw new PurchaseError("La categoría no existe", 404);

  const taxPercent = Number(input.taxPercent ?? 0);
  const taxAmount = (amountNet * taxPercent) / 100;
  const total = amountNet + taxAmount;

  return prisma.$transaction(async (transaction) => {
    const number = await nextDocumentNumber(transaction, tenantId, "GA");
    return transaction.expense.create({
      data: {
        tenantId,
        branchId: input.branchId ?? null,
        supplierId: input.supplierId ?? null,
        categoryId: input.categoryId,
        recurringId: input.recurringId ?? null,
        number,
        status: total > 0 ? "pending" : "draft",
        expenseDate: input.expenseDate ? new Date(input.expenseDate) : new Date(),
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        amountNet: round2(amountNet),
        taxAmount: round2(taxAmount),
        total: round2(total),
        paymentMethod: input.paymentMethod?.trim() || null,
        financialCategory: input.financialCategory?.trim() || null,
        notes: input.notes?.trim() || null,
        attachmentId: input.attachmentId ?? null,
        createdById: userId,
      },
      include: {
        category: { select: { id: true, name: true, group: true } },
        supplier: { select: { id: true, name: true } },
      },
    });
  });
}

/** @summary Recupera un gasto con sus relaciones. */
export async function loadExpense(tenantId: number, expenseId: number) {
  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, tenantId },
    include: {
      category: { select: { id: true, name: true, group: true } },
      supplier: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      payments: { orderBy: { paidAt: "desc" }, include: { createdBy: { select: { id: true, name: true } } } },
      recurring: { select: { id: true, name: true } },
    },
  });
  if (!expense) throw new PurchaseError("El gasto no existe", 404);
  return expense;
}

/** @summary Edita un gasto que no tenga pagos ni esté anulado. */
export async function updateExpense(
  tenantId: number,
  expenseId: number,
  input: Omit<Partial<ExpenseInput>, "notes"> & { notes?: string | null; status?: string },
) {
  return prisma.$transaction(async (transaction) => {
    const expense = await transaction.expense.findFirst({
      where: { id: expenseId, tenantId },
      include: { payments: { select: { id: true } } },
    });
    if (!expense) throw new PurchaseError("El gasto no existe", 404);
    if (expense.status === "cancelled") throw new PurchaseError("El gasto está anulado", 409);
    if (expense.payments.length) throw new PurchaseError("No se puede editar un gasto con pagos", 409);

    const amountNet =
      input.amountNet !== undefined ? Number(input.amountNet) : Number(expense.amountNet);
    if (!Number.isFinite(amountNet) || amountNet < 0) {
      throw new PurchaseError("El importe del gasto no es válido", 400);
    }
    const taxPercent = input.taxPercent !== undefined ? Number(input.taxPercent) : 0;
    const taxAmount = (amountNet * taxPercent) / 100;

    return transaction.expense.update({
      where: { id: expenseId },
      data: {
        ...(input.categoryId ? { categoryId: input.categoryId } : {}),
        ...(input.supplierId !== undefined ? { supplierId: input.supplierId || null } : {}),
        ...(input.branchId !== undefined ? { branchId: input.branchId || null } : {}),
        ...(input.expenseDate ? { expenseDate: new Date(input.expenseDate) } : {}),
        ...(input.dueDate !== undefined ? { dueDate: input.dueDate ? new Date(input.dueDate) : null } : {}),
        ...(input.amountNet !== undefined ? { amountNet: round2(amountNet), taxAmount: round2(taxAmount), total: round2(amountNet + taxAmount) } : {}),
        ...(input.paymentMethod !== undefined ? { paymentMethod: input.paymentMethod?.trim() || null } : {}),
        ...(input.financialCategory !== undefined ? { financialCategory: input.financialCategory?.trim() || null } : {}),
        ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
        ...(input.attachmentId !== undefined ? { attachmentId: input.attachmentId || null } : {}),
        ...(input.status ? { status: input.status } : {}),
      },
    });
  });
}

/** @summary Registra un pago contra un gasto sin superar el total. */
export async function payExpense(
  tenantId: number,
  userId: number | null,
  input: { expenseId: number; amount: number; method: string; paidAt?: string; notes?: string },
) {
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new PurchaseError("El monto del pago debe ser mayor a cero", 400);
  if (!PAYMENT_METHODS.includes(input.method as (typeof PAYMENT_METHODS)[number])) {
    throw new PurchaseError("Medio de pago no válido", 400);
  }

  return prisma.$transaction(async (transaction) => {
    const expense = await transaction.expense.findFirst({ where: { id: input.expenseId, tenantId } });
    if (!expense) throw new PurchaseError("El gasto no existe", 404);
    if (expense.status === "cancelled") throw new PurchaseError("El gasto está anulado", 409);

    const paid = await transaction.expense.updateMany({
      where: { id: expense.id, paidAmount: { lte: Number(expense.total) - amount } },
      data: { paidAmount: { increment: amount } },
    });
    if (paid.count !== 1) {
      throw new PurchaseError(`El pago supera el saldo pendiente (${round2(Number(expense.total) - Number(expense.paidAmount))})`, 409);
    }

    const number = await nextDocumentNumber(transaction, tenantId, "PC");
    const payment = await transaction.purchasePayment.create({
      data: {
        tenantId,
        expenseId: expense.id,
        number,
        amount,
        method: input.method,
        paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
        notes: input.notes?.trim() || null,
        createdById: userId,
      },
    });

    const updated = await transaction.expense.findUniqueOrThrow({ where: { id: expense.id } });
    const newPaid = Number(updated.paidAmount);
    const nextStatus = newPaid >= Number(updated.total) ? "paid" : "partially_paid";
    await transaction.expense.update({
      where: { id: expense.id },
      data: { status: nextStatus, ...(newPaid >= Number(updated.total) ? { paidAmount: updated.total } : {}) },
    });
    return { payment, status: nextStatus, balance: round2(Number(updated.total) - newPaid) };
  });
}

/** @summary Anula un gasto sin pagos registrados. */
export async function annulExpense(tenantId: number, expenseId: number) {
  return prisma.$transaction(async (transaction) => {
    const expense = await transaction.expense.findFirst({
      where: { id: expenseId, tenantId },
      include: { payments: { select: { id: true } } },
    });
    if (!expense) throw new PurchaseError("El gasto no existe", 404);
    if (expense.status === "cancelled") return expense;
    if (expense.payments.length) throw new PurchaseError("No se puede anular un gasto con pagos", 409);
    return transaction.expense.update({ where: { id: expenseId }, data: { status: "cancelled" } });
  });
}

/** @summary Lista gastos con filtros y KPIs de resumen. */
export async function listExpenses(
  tenantId: number,
  filters: {
    branchId?: number | null;
    supplierId?: number | null;
    categoryId?: number | null;
    status?: string;
    query?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  },
) {
  const where: Prisma.ExpenseWhereInput = { tenantId, status: { not: "cancelled" } };
  if (filters.branchId) where.branchId = filters.branchId;
  if (filters.supplierId) where.supplierId = filters.supplierId;
  if (filters.categoryId) where.categoryId = filters.categoryId;
  if (filters.status) where.status = filters.status;
  if (filters.query) {
    where.OR = [{ number: { contains: filters.query } }, { notes: { contains: filters.query } }];
  }
  if (filters.from) where.expenseDate = { ...(where.expenseDate as object | undefined), gte: new Date(filters.from) };
  if (filters.to) where.expenseDate = { ...(where.expenseDate as object | undefined), lte: new Date(filters.to) };

  const [items, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, group: true } },
        supplier: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
      orderBy: { expenseDate: "desc" },
      take: filters.limit ?? 60,
      skip: filters.offset ?? 0,
    }),
    prisma.expense.count({ where }),
  ]);
  return { items, total };
}

/** @summary KPIs pequeños para la cabecera de Gastos. */
export async function expenseSummary(tenantId: number, now = new Date()) {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const [pendingMonth, paidMonth, overdue, upcoming] = await Promise.all([
    prisma.expense.aggregate({
      where: {
        tenantId,
        status: { in: ["pending", "partially_paid"] },
        expenseDate: { gte: monthStart, lt: monthEnd },
      },
      _sum: { total: true, paidAmount: true },
    }),
    prisma.expense.aggregate({
      where: { tenantId, status: "paid", expenseDate: { gte: monthStart, lt: monthEnd } },
      _sum: { total: true },
    }),
    prisma.expense.findMany({
      where: { tenantId, status: { in: ["pending", "partially_paid"] }, dueDate: { lt: now } },
      select: { total: true, paidAmount: true },
    }),
    prisma.expense.findMany({
      where: { tenantId, status: { in: ["pending", "partially_paid"] }, dueDate: { gte: now, lte: new Date(now.getTime() + 7 * 86400000) } },
      select: { id: true, number: true, total: true, paidAmount: true, dueDate: true },
    }),
  ]);
  const pendingBalance = Number(pendingMonth._sum.total ?? 0) - Number(pendingMonth._sum.paidAmount ?? 0);
  return {
    pendingMonth: round2(Math.max(0, pendingBalance)),
    paidMonth: round2(Number(paidMonth._sum.total ?? 0)),
    overdue: round2(overdue.reduce((sum, item) => sum + Number(item.total) - Number(item.paidAmount), 0)),
    upcoming: upcoming
      .map((item) => ({ id: item.id, number: item.number, amount: round2(Number(item.total) - Number(item.paidAmount)), dueDate: item.dueDate }))
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()),
  };
}

/** @summary Categorías de gasto del tenant. */
export async function listExpenseCategories(tenantId: number, includeInactive = false) {
  return prisma.expenseCategory.findMany({
    where: { tenantId, ...(includeInactive ? {} : { active: true }) },
    orderBy: [{ group: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
}

/** @summary Crea una categoría de gasto. */
export async function createExpenseCategory(tenantId: number, input: { group: string; name: string }) {
  const name = input.name.trim();
  if (!name) throw new PurchaseError("Indicá el nombre de la categoría", 400);
  const existing = await prisma.expenseCategory.findFirst({ where: { tenantId, name } });
  if (existing) throw new PurchaseError("Ya existe una categoría con ese nombre", 409);
  const maxOrder = await prisma.expenseCategory.aggregate({ where: { tenantId }, _max: { sortOrder: true } });
  return prisma.expenseCategory.create({
    data: {
      tenantId,
      group: input.group.trim() || "Operación",
      name,
      sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
    },
  });
}

/** @summary Actualiza o desactiva una categoría de gasto. */
export async function updateExpenseCategory(tenantId: number, categoryId: number, input: { group?: string; name?: string; active?: boolean }) {
  const result = await prisma.expenseCategory.updateMany({
    where: { id: categoryId, tenantId },
    data: {
      ...(input.group !== undefined ? { group: input.group.trim() || "Operación" } : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    },
  });
  if (result.count !== 1) throw new PurchaseError("La categoría no existe", 404);
  return prisma.expenseCategory.findUniqueOrThrow({ where: { id: categoryId } });
}

/** @summary Crea un gasto recurrente previsto (no genera movimientos reales). */
export async function createRecurringExpense(
  tenantId: number,
  input: { name: string; amount: number; periodicity: string; categoryId?: number | null; dayOfMonth?: number | null; dayOfWeek?: number | null; nextDueDate?: string; notes?: string },
) {
  const name = input.name.trim();
  const amount = Number(input.amount);
  if (!name) throw new PurchaseError("Indicá el nombre del gasto recurrente", 400);
  if (!Number.isFinite(amount) || amount <= 0) throw new PurchaseError("El importe debe ser mayor a cero", 400);
  if (!["monthly", "weekly", "yearly"].includes(input.periodicity)) {
    throw new PurchaseError("Periodicidad no válida", 400);
  }
  return prisma.recurringExpense.create({
    data: {
      tenantId,
      name,
      amount,
      periodicity: input.periodicity,
      categoryId: input.categoryId ?? null,
      dayOfMonth: input.dayOfMonth ?? null,
      dayOfWeek: input.dayOfWeek ?? null,
      nextDueDate: input.nextDueDate ? new Date(input.nextDueDate) : new Date(),
      notes: input.notes?.trim() || null,
    },
  });
}

/** @summary Lista los gastos recurrentes activos con su próxima previsión. */
export async function listRecurringExpenses(tenantId: number) {
  return prisma.recurringExpense.findMany({
    where: { tenantId },
    include: { category: { select: { id: true, name: true, group: true } } },
    orderBy: [{ active: "desc" }, { nextDueDate: "asc" }],
  });
}

/**
 * @summary Convierte un gasto recurrente previsto en un gasto real (confirmación explícita).
 * No automatiza nada: el usuario decide cuándo materializar la previsión.
 */
export async function materializeRecurringExpense(tenantId: number, userId: number | null, recurringId: number, dueDate?: string) {
  return prisma.$transaction(async (transaction) => {
    const recurring = await transaction.recurringExpense.findFirst({ where: { id: recurringId, tenantId, active: true } });
    if (!recurring) throw new PurchaseError("La previsión no existe o está desactivada", 404);
    const number = await nextDocumentNumber(transaction, tenantId, "GA");
    const expense = await transaction.expense.create({
      data: {
        tenantId,
        categoryId: recurring.categoryId ?? (await requireFallbackCategory(transaction, tenantId)),
        recurringId: recurring.id,
        number,
        status: "pending",
        expenseDate: dueDate ? new Date(dueDate) : new Date(),
        dueDate: dueDate ? new Date(dueDate) : null,
        amountNet: Number(recurring.amount),
        taxAmount: 0,
        total: Number(recurring.amount),
        notes: recurring.notes || `Gasto recurrente: ${recurring.name}`,
        createdById: userId,
      },
    });
    return expense;
  });
}

/** @summary Actualiza o desactiva un gasto recurrente. */
export async function updateRecurringExpense(tenantId: number, recurringId: number, input: { active?: boolean; name?: string; amount?: number }) {
  const result = await prisma.recurringExpense.updateMany({
    where: { id: recurringId, tenantId },
    data: {
      ...(input.active !== undefined ? { active: input.active } : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.amount !== undefined ? { amount: Number(input.amount) } : {}),
    },
  });
  if (result.count !== 1) throw new PurchaseError("La previsión no existe", 404);
  return prisma.recurringExpense.findUniqueOrThrow({ where: { id: recurringId } });
}

/** @summary Elimina un gasto recurrente. */
export async function removeRecurringExpense(tenantId: number, recurringId: number) {
  const result = await prisma.recurringExpense.deleteMany({
    where: { id: recurringId, tenantId },
  });
  if (result.count !== 1) throw new PurchaseError("La previsión no existe", 404);
  return { deleted: true };
}

/** @summary Categoría por defecto (la primera activa) para previsiones sin categoría. */
async function requireFallbackCategory(transaction: Prisma.TransactionClient, tenantId: number) {
  const category = await transaction.expenseCategory.findFirst({ where: { tenantId, active: true }, orderBy: { sortOrder: "asc" } });
  if (!category) throw new PurchaseError("Creá al menos una categoría de gasto", 409);
  return category.id;
}
