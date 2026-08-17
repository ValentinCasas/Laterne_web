import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** @summary Resumen financiero del negocio para el dashboard. */
export type FinanceDashboard = {
  totalBalance: number;
  cashBalance: number;
  bankBalance: number;
  receivablesTotal: number;
  receivablesOverdue: number;
  payablesTotal: number;
  payablesOverdue: number;
  operatingResult: number;
  recentMovements: Array<{
    id: number;
    date: string;
    accountName: string;
    type: string;
    direction: string;
    amount: number;
    concept: string;
    reference?: string | null;
    origin: string;
  }>;
};

/** @summary Cuenta financiera con saldo calculado. */
export type FinanceAccount = {
  id: number;
  name: string;
  code: string | null;
  type: string;
  currency: string;
  status: string;
  openingBalance: number;
  balance: number;
  notes?: string | null;
  branchId?: number | null;
};

/** @summary Movimiento financiero. */
export type FinanceMovement = {
  id: number;
  date: string;
  accountId: number;
  accountName: string;
  type: string;
  direction: string;
  amount: number;
  concept: string;
  reference?: string | null;
  origin: string;
  referenceType?: string | null;
  userName?: string | null;
};

/** @summary Flujo de caja por período. */
export type CashFlowPeriod = {
  startDate: string;
  endDate: string;
  openingBalance: number;
  sales: number;
  collections: number;
  otherIncome: number;
  suppliers: number;
  expenses: number;
  otherExpenses: number;
  transfers: number;
  closingBalance: number;
  details: Array<{
    id: number;
    date: string;
    type: string;
    category: string;
    direction: string;
    amount: number;
    concept: string;
    accountName: string;
  }>;
};

/** @summary Resumen de aging para cuentas a cobrar. */
export type ReceivablesAging = {
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  daysOver90: number;
  total: number;
};

/** @summary Documento de cuenta a cobrar. */
export type ReceivableDocument = {
  id: number;
  number: string;
  customerName: string;
  orderNumber?: string | null;
  documentDate: string;
  dueDate: string;
  originalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  status: string;
  daysOverdue: number;
  branchId?: number | null;
};

/** @summary Item de cuenta a pagar (desde SupplierLedgerEntry). */
export type PayableItem = {
  id: number;
  supplierName: string;
  documentNumber?: string | null;
  type: string;
  date: string;
  dueDate?: string | null;
  originalAmount: number;
  appliedAmount: number;
  remainingAmount: number;
  currency: string;
  status: string;
  daysOverdue: number;
  branchId?: number | null;
};

/** @summary Aging de cuentas a pagar. */
export type PayablesAging = {
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  daysOver90: number;
  total: number;
};

/** @summary Estado de resultados. */
export type ProfitLoss = {
  grossSales: number;
  discounts: number;
  netSales: number;
  cog: number;
  grossProfit: number;
  operatingExpenses: number;
  operatingResult: number;
  otherIncome: number;
  otherExpenses: number;
  netResult: number;
  previousPeriod: {
    grossSales: number;
    discounts: number;
    netSales: number;
    cog: number;
    grossProfit: number;
    operatingExpenses: number;
    operatingResult: number;
    otherIncome: number;
    otherExpenses: number;
    netResult: number;
  };
  expensesByCategory: Array<{
    category: string;
    amount: number;
    previousAmount: number;
  }>;
};

/** @summary Calcula el saldo de una cuenta financiera. */
function calculateAccountBalance(account: {
  openingBalance: number | Prisma.Decimal;
  movements: Array<{ direction: string; amount: number | Prisma.Decimal }>;
}): number {
  let balance = Number(account.openingBalance);
  for (const movement of account.movements) {
    const amount = Number(movement.amount);
    if (movement.direction === "in") balance += amount;
    else if (movement.direction === "out") balance -= amount;
  }
  return balance;
}

/** @summary Obtiene el resumen financiero del dashboard. */
export async function getFinanceDashboard(
  tenantId: number,
  filters: {
    branchId?: number | null;
    from?: string;
    to?: string;
    dateFrom?: string;
    dateTo?: string;
  } = {},
): Promise<FinanceDashboard> {
  const branchFilter = filters.branchId && filters.branchId > 0 ? { branchId: filters.branchId } : {};
  const dateFilter: { date?: { gte?: Date; lte?: Date } } = {};
  if (filters.from || filters.to || filters.dateFrom || filters.dateTo) {
    dateFilter.date = {
      ...(filters.from || filters.dateFrom ? { gte: new Date(filters.from || filters.dateFrom!) } : {}),
      ...(filters.to || filters.dateTo ? { lte: new Date(filters.to || filters.dateTo!) } : {}),
    };
  }

  const [
    accounts,
    receivables,
    receivablesOverdue,
    payablesOpen,
    payablesOverdue,
    recentMovements,
  ] = await Promise.all([
    prisma.financialAccount.findMany({
      where: { tenantId, status: "active", ...branchFilter },
      include: {
        movements: {
          where: { tenantId, ...branchFilter, reversesId: null, ...dateFilter },
          select: { direction: true, amount: true },
        },
      },
    }),
    prisma.receivableDocument.findMany({
      where: { tenantId, status: { in: ["open", "partially_paid"] }, ...branchFilter },
      select: { originalAmount: true, paidAmount: true },
    }),
    prisma.receivableDocument.count({
      where: {
        tenantId,
        status: { in: ["open", "partially_paid"] },
        dueDate: { lt: new Date() },
        ...branchFilter,
      },
    }),
    prisma.supplierLedgerEntry.findMany({
      where: { tenantId, status: { in: ["open", "partially_paid"] }, ...branchFilter },
      select: { remainingAmount: true },
    }),
    prisma.supplierLedgerEntry.count({
      where: {
        tenantId,
        status: { in: ["open", "partially_paid"] },
        dueDate: { lt: new Date() },
        ...branchFilter,
      },
    }),
    prisma.financialMovement.findMany({
      where: { tenantId, reversesId: null, ...branchFilter, ...dateFilter },
      orderBy: { date: "desc" },
      take: 10,
      include: {
        account: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
    }),
  ]);

  const totalBalance = accounts.reduce((sum, acc) => sum + calculateAccountBalance(acc), 0);
  const cashBalance = accounts
    .filter((acc) => acc.type === "caja")
    .reduce((sum, acc) => sum + calculateAccountBalance(acc), 0);
  const bankBalance = accounts
    .filter((acc) => acc.type === "banco")
    .reduce((sum, acc) => sum + calculateAccountBalance(acc), 0);

  const receivablesTotal = receivables.reduce(
    (sum, doc) => sum + Number(doc.originalAmount) - Number(doc.paidAmount),
    0,
  );
  const payablesTotal = payablesOpen.reduce((sum, entry) => sum + Number(entry.remainingAmount), 0);

  const operatingResult = totalBalance - receivablesTotal + payablesTotal;

  return {
    totalBalance,
    cashBalance,
    bankBalance,
    receivablesTotal,
    receivablesOverdue,
    payablesTotal,
    payablesOverdue,
    operatingResult,
    recentMovements: recentMovements.map((m) => ({
      id: m.id,
      date: m.date.toISOString(),
      accountName: m.account.name,
      type: m.type,
      direction: m.direction,
      amount: Number(m.amount),
      concept: m.concept,
      reference: m.reference,
      origin: m.origin,
    })),
  };
}

/** @summary Lista cuentas financieras con saldo calculado. */
export async function listFinancialAccounts(
  tenantId: number,
  filters: {
    branchId?: number | null;
    type?: string | null;
    status?: string | null;
    q?: string | null;
    limit?: number;
    offset?: number;
  } = {},
): Promise<FinanceAccount[]> {
  const where: Prisma.FinancialAccountWhereInput = {
    tenantId,
    ...(filters.branchId && filters.branchId > 0 ? { branchId: filters.branchId } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.q
      ? {
          OR: [
            { name: { contains: filters.q } },
            { code: { contains: filters.q } },
          ],
        }
      : {}),
  };

  const accounts = await prisma.financialAccount.findMany({
    where,
    include: {
      movements: {
        where: { tenantId, reversesId: null },
        select: { direction: true, amount: true },
      },
    },
    orderBy: [{ type: "asc" }, { name: "asc" }],
    take: filters.limit ?? 60,
    skip: filters.offset ?? 0,
  });

  return accounts.map((acc) => ({
    id: acc.id,
    name: acc.name,
    code: acc.code,
    type: acc.type,
    currency: acc.currency,
    status: acc.status,
    openingBalance: Number(acc.openingBalance),
    balance: calculateAccountBalance(acc),
    notes: acc.notes,
    branchId: acc.branchId ?? undefined,
  }));
}

/** @summary Crea una cuenta financiera. */
export async function createFinancialAccount(
  tenantId: number,
  data: {
    name: string;
    code?: string | null;
    type: string;
    currency?: string | null;
    branchId?: number | null;
    openingBalance?: number;
    notes?: string | null;
  },
) {
  return prisma.financialAccount.create({
    data: {
      tenantId,
      name: data.name,
      code: data.code?.trim() || null,
      type: data.type,
      currency: data.currency || "ARS",
      branchId: data.branchId ?? null,
      openingBalance: data.openingBalance ?? 0,
      notes: data.notes?.trim() || null,
    },
  });
}

/** @summary Actualiza una cuenta financiera. */
export async function updateFinancialAccount(
  id: number,
  tenantId: number,
  data: {
    name?: string;
    code?: string | null;
    type?: string;
    status?: string;
    notes?: string | null;
  },
) {
  return prisma.financialAccount.updateMany({
    where: { id, tenantId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.code !== undefined && { code: data.code?.trim() || null }),
      ...(data.type !== undefined && { type: data.type }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.notes !== undefined && { notes: data.notes?.trim() || null }),
    },
  });
}

/** @summary Lista movimientos financieros con filtros. */
export async function listFinancialMovements(
  tenantId: number,
  filters: {
    branchId?: number | null;
    accountId?: number | null;
    type?: string | null;
    direction?: string;
    from?: string;
    to?: string;
    dateFrom?: string;
    dateTo?: string;
    q?: string | null;
    limit?: number;
    offset?: number;
  } = {},
): Promise<{ items: FinanceMovement[]; total: number }> {
  const where: Prisma.FinancialMovementWhereInput = {
    tenantId,
    reversesId: null,
    ...(filters.branchId && filters.branchId > 0 ? { branchId: filters.branchId } : {}),
    ...(filters.accountId ? { accountId: filters.accountId } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.direction ? { direction: filters.direction } : {}),
    ...(filters.q
      ? {
          OR: [
            { concept: { contains: filters.q } },
            { reference: { contains: filters.q } },
          ],
        }
      : {}),
    ...((filters.from || filters.to || filters.dateFrom || filters.dateTo)
      ? {
          date: {
            ...(filters.from || filters.dateFrom ? { gte: new Date((filters.from || filters.dateFrom) as string) } : {}),
            ...(filters.to || filters.dateTo ? { lte: new Date((filters.to || filters.dateTo) as string) } : {}),
          },
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.financialMovement.findMany({
      where,
      orderBy: { date: "desc" },
      take: filters.limit ?? 50,
      skip: filters.offset ?? 0,
      include: {
        account: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
    }),
    prisma.financialMovement.count({ where }),
  ]);

  return {
    items: items.map((m) => ({
      id: m.id,
      date: m.date.toISOString(),
      accountId: m.accountId,
      accountName: m.account.name,
      type: m.type,
      direction: m.direction,
      amount: Number(m.amount),
      concept: m.concept,
      reference: m.reference,
      origin: m.origin,
      referenceType: m.referenceType,
      userName: m.createdBy?.name || null,
    })),
    total,
  };
}

/** @summary Crea un movimiento financiero. */
export async function createFinancialMovement(
  tenantId: number,
  userId: number | null,
  data: {
    accountId: number;
    branchId?: number | null;
    type: string;
    direction: string;
    amount: number;
    concept: string;
    reference?: string | null;
    origin?: string;
    referenceType?: string | null;
    referenceId?: number | null;
  },
) {
  return prisma.financialMovement.create({
    data: {
      tenantId,
      branchId: data.branchId ?? null,
      accountId: data.accountId,
      type: data.type,
      direction: data.direction,
      amount: data.amount,
      concept: data.concept,
      reference: data.reference?.trim() || null,
      origin: data.origin || "manual",
      referenceType: data.referenceType?.trim() || null,
      referenceId: data.referenceId ?? null,
      createdById: userId,
    },
  });
}

/** @summary Obtiene el flujo de caja por período. */
export async function getCashFlow(
  tenantId: number,
  filters: {
    branchId?: number | null;
    from?: string;
    to?: string;
    dateFrom?: string;
    dateTo?: string;
    period?: "day" | "week" | "month" | "custom";
  } = {},
): Promise<CashFlowPeriod> {
  const now = new Date();
  let startDate: Date;
  let endDate: Date = now;

  if (filters.period === "day") {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (filters.period === "week") {
    const day = now.getDay() || 7;
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1);
  } else if (filters.period === "month") {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if ((filters.from || filters.dateFrom) && (filters.to || filters.dateTo)) {
    startDate = new Date(filters.from || filters.dateFrom!);
    endDate = new Date(filters.to || filters.dateTo!);
  } else {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const branchFilter = filters.branchId && filters.branchId > 0 ? { branchId: filters.branchId } : {};

  const movements = await prisma.financialMovement.findMany({
    where: {
      tenantId,
      reversesId: null,
      ...branchFilter,
      date: { gte: startDate, lte: endDate },
    },
    include: { account: { select: { name: true, type: true } } },
  });

  const accounts = await prisma.financialAccount.findMany({
    where: { tenantId, ...branchFilter },
    include: {
      movements: {
        where: { tenantId, ...branchFilter, date: { lt: startDate }, reversesId: null },
        select: { direction: true, amount: true },
      },
    },
  });

  const openingBalance = accounts.reduce((sum, acc) => {
    let balance = Number(acc.openingBalance);
    for (const m of acc.movements) {
      const amount = Number(m.amount);
      if (m.direction === "in") balance += amount;
      else if (m.direction === "out") balance -= amount;
    }
    return sum + balance;
  }, 0);

  let sales = 0;
  let collections = 0;
  let otherIncome = 0;
  let suppliers = 0;
  let expenses = 0;
  let otherExpenses = 0;
  let transfers = 0;

  const details: CashFlowPeriod["details"] = [];

  for (const m of movements) {
    const amount = Number(m.amount);
    const entry = {
      id: m.id,
      date: m.date.toISOString(),
      type: m.type,
      category: m.concept,
      direction: m.direction,
      amount,
      concept: m.concept,
      accountName: m.account.name,
    };

    if (m.type === "sale" || m.origin === "order") {
      if (m.direction === "in") sales += amount;
      else sales += amount;
    } else if (m.type === "payment" && m.origin === "receivable") {
      if (m.direction === "in") collections += amount;
    } else if (m.direction === "in" && m.type !== "sale" && m.origin !== "order") {
      otherIncome += amount;
    } else if (m.type === "expense" || m.origin === "expense") {
      if (m.direction === "out") expenses += amount;
    } else if (m.type === "cog" || m.origin === "inventory") {
      if (m.direction === "out") suppliers += amount;
    } else if (m.direction === "out" && m.type !== "expense" && m.origin !== "inventory") {
      otherExpenses += amount;
    } else if (m.type === "transfer") {
      transfers += amount;
    }

    details.push(entry);
  }

  const closingBalance = openingBalance + sales + collections + otherIncome - suppliers - expenses - otherExpenses - transfers;

  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    openingBalance,
    sales,
    collections,
    otherIncome,
    suppliers,
    expenses,
    otherExpenses,
    transfers,
    closingBalance,
    details,
  };
}

/** @summary Lista documentos de cuentas a cobrar. */
export async function listReceivables(
  tenantId: number,
  filters: {
    branchId?: number | null;
    status?: string | null;
    customerId?: number | null;
    from?: string;
    to?: string;
    q?: string | null;
    limit?: number;
    offset?: number;
  } = {},
) {
  const where: Prisma.ReceivableDocumentWhereInput = {
    tenantId,
    ...(filters.branchId && filters.branchId > 0 ? { branchId: filters.branchId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.customerId ? { customerId: filters.customerId } : {}),
    ...(filters.q
      ? {
          OR: [
            { number: { contains: filters.q } },
            { notes: { contains: filters.q } },
          ],
        }
      : {}),
    ...(filters.from || filters.to
      ? {
          documentDate: {
            ...(filters.from ? { gte: new Date(filters.from) } : {}),
            ...(filters.to ? { lte: new Date(filters.to) } : {}),
          },
        }
      : {}),
  };

  const [docs, total] = await Promise.all([
    prisma.receivableDocument.findMany({
      where,
      include: {
        customer: { select: { name: true } },
        order: { select: { reference: true } },
      },
      orderBy: { dueDate: "asc" },
      take: filters.limit ?? 50,
      skip: filters.offset ?? 0,
    }),
    prisma.receivableDocument.count({ where }),
  ]);

  const now = new Date();

  return {
    items: docs.map((doc) => {
      const originalAmount = Number(doc.originalAmount);
      const paidAmount = Number(doc.paidAmount);
      const pendingAmount = originalAmount - paidAmount;
      const daysOverdue = doc.dueDate < now ? Math.floor((now.getTime() - doc.dueDate.getTime()) / 86400000) : 0;

      return {
        id: doc.id,
        number: doc.number,
        customerName: doc.customer.name,
        orderNumber: doc.order?.reference || null,
        documentDate: doc.documentDate.toISOString(),
        dueDate: doc.dueDate.toISOString(),
        originalAmount,
        paidAmount,
        pendingAmount,
        status: doc.status,
        daysOverdue,
        branchId: doc.branchId ?? undefined,
      };
    }),
    total,
  };
}

/** @summary Calcula el aging de cuentas a cobrar. */
export async function getReceivablesAging(
  tenantId: number,
  branchId?: number | null,
): Promise<ReceivablesAging> {
  const branchFilter = branchId && branchId > 0 ? { branchId } : {};
  const now = new Date();

  const docs = await prisma.receivableDocument.findMany({
    where: {
      tenantId,
      status: { in: ["open", "partially_paid"] },
      ...branchFilter,
    },
    select: { originalAmount: true, paidAmount: true, dueDate: true },
  });

  const aging: ReceivablesAging = {
    current: 0,
    days1to30: 0,
    days31to60: 0,
    days61to90: 0,
    daysOver90: 0,
    total: 0,
  };

  for (const doc of docs) {
    const pending = Number(doc.originalAmount) - Number(doc.paidAmount);
    if (pending <= 0) continue;
    const daysOverdue = doc.dueDate < now ? Math.floor((now.getTime() - doc.dueDate.getTime()) / 86400000) : 0;

    if (daysOverdue <= 0) aging.current += pending;
    else if (daysOverdue <= 30) aging.days1to30 += pending;
    else if (daysOverdue <= 60) aging.days31to60 += pending;
    else if (daysOverdue <= 90) aging.days61to90 += pending;
    else aging.daysOver90 += pending;
  }

  aging.total = aging.current + aging.days1to30 + aging.days31to60 + aging.days61to90 + aging.daysOver90;
  return aging;
}

/** @summary Registra un pago en cuentas a cobrar. */
export async function registerReceivablePayment(
  tenantId: number,
  userId: number | null,
  data: {
    documentId: number;
    amount: number;
    method?: string;
    accountId?: number | null;
    notes?: string | null;
  },
) {
  return prisma.$transaction(async (tx) => {
    const document = await tx.receivableDocument.findFirst({
      where: { id: data.documentId, tenantId },
    });
    if (!document) throw new Error("Documento no encontrado");

    const originalAmount = Number(document.originalAmount);
    const paidAmount = Number(document.paidAmount);
    const remaining = originalAmount - paidAmount;
    const paymentAmount = Math.min(data.amount, remaining);

    if (paymentAmount <= 0) throw new Error("El monto debe ser mayor a 0");

    const payment = await tx.receivablePayment.create({
      data: {
        tenantId,
        customerId: document.customerId,
        branchId: document.branchId,
        number: `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        amount: paymentAmount,
        method: data.method || "efectivo",
        accountId: data.accountId ?? null,
        notes: data.notes?.trim() || null,
        createdById: userId,
      },
    });

    await tx.receivableAllocation.create({
      data: {
        tenantId,
        paymentId: payment.id,
        documentId: document.id,
        amount: paymentAmount,
      },
    });

    const newPaidAmount = paidAmount + paymentAmount;
    let newStatus = "open";
    if (newPaidAmount >= originalAmount) newStatus = "paid";
    else if (newPaidAmount > 0) newStatus = "partially_paid";

    await tx.receivableDocument.update({
      where: { id: document.id },
      data: { paidAmount: newPaidAmount, status: newStatus },
    });

    return { payment, newPaidAmount, newStatus };
  });
}

/** @summary Lista items de cuentas a pagar desde SupplierLedgerEntry. */
export async function listPayables(
  tenantId: number,
  filters: {
    branchId?: number | null;
    status?: string | null;
    supplierId?: number | null;
    from?: string;
    to?: string;
    q?: string | null;
    limit?: number;
    offset?: number;
  } = {},
): Promise<{ items: PayableItem[]; total: number }> {
  const where: Prisma.SupplierLedgerEntryWhereInput = {
    tenantId,
    ...(filters.branchId && filters.branchId > 0 ? { branchId: filters.branchId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.supplierId ? { supplierId: filters.supplierId } : {}),
    ...(filters.q
      ? {
          OR: [
            { documentNumber: { contains: filters.q } },
            { notes: { contains: filters.q } },
          ],
        }
      : {}),
    ...(filters.from || filters.to
      ? {
          createdAt: {
            ...(filters.from ? { gte: new Date(filters.from) } : {}),
            ...(filters.to ? { lte: new Date(filters.to) } : {}),
          },
        }
      : {}),
  };

  const [entries, total] = await Promise.all([
    prisma.supplierLedgerEntry.findMany({
      where,
      include: {
        supplier: { select: { name: true } },
      },
      orderBy: { dueDate: "asc" },
      take: filters.limit ?? 50,
      skip: filters.offset ?? 0,
    }),
    prisma.supplierLedgerEntry.count({ where }),
  ]);

  const now = new Date();

  return {
    items: entries.map((entry) => {
      const originalAmount = Number(entry.originalAmount);
      const remainingAmount = Number(entry.remainingAmount);
      const daysOverdue = entry.dueDate && entry.dueDate < now
        ? Math.floor((now.getTime() - entry.dueDate.getTime()) / 86400000)
        : 0;

      return {
        id: entry.id,
        supplierName: entry.supplier.name,
        documentNumber: entry.documentNumber,
        type: entry.type,
        date: entry.createdAt.toISOString(),
        dueDate: entry.dueDate?.toISOString() || null,
        originalAmount,
        appliedAmount: Number(entry.appliedAmount),
        remainingAmount,
        currency: entry.currency,
        status: entry.status,
        daysOverdue,
        branchId: entry.branchId ?? undefined,
      };
    }),
    total,
  };
}

/** @summary Calcula el aging de cuentas a pagar. */
export async function getPayablesAging(
  tenantId: number,
  branchId?: number | null,
): Promise<PayablesAging> {
  const branchFilter = branchId && branchId > 0 ? { branchId } : {};
  const now = new Date();

  const entries = await prisma.supplierLedgerEntry.findMany({
    where: {
      tenantId,
      status: { in: ["open", "partially_paid"] },
      ...branchFilter,
    },
    select: { remainingAmount: true, dueDate: true },
  });

  const aging: PayablesAging = {
    current: 0,
    days1to30: 0,
    days31to60: 0,
    days61to90: 0,
    daysOver90: 0,
    total: 0,
  };

  for (const entry of entries) {
    const remaining = Number(entry.remainingAmount);
    if (remaining <= 0) continue;
    const daysOverdue = entry.dueDate && entry.dueDate < now
      ? Math.floor((now.getTime() - entry.dueDate.getTime()) / 86400000)
      : 0;

    if (daysOverdue <= 0) aging.current += remaining;
    else if (daysOverdue <= 30) aging.days1to30 += remaining;
    else if (daysOverdue <= 60) aging.days31to60 += remaining;
    else if (daysOverdue <= 90) aging.days61to90 += remaining;
    else aging.daysOver90 += remaining;
  }

  aging.total = aging.current + aging.days1to30 + aging.days31to60 + aging.days61to90 + aging.daysOver90;
  return aging;
}

/** @summary Obtiene el estado de resultados. */
export async function getProfitLoss(
  tenantId: number,
  filters: {
    branchId?: number | null;
    from?: string;
    to?: string;
    dateFrom?: string;
    dateTo?: string;
  } = {},
): Promise<ProfitLoss> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  const from = filters.from || filters.dateFrom ? new Date(filters.from || filters.dateFrom!) : startOfMonth;
  const to = filters.to || filters.dateTo ? new Date(filters.to || filters.dateTo!) : now;

  const branchFilter = filters.branchId && filters.branchId > 0 ? { branchId: filters.branchId } : {};

  const [currentMovements, previousMovements] = await Promise.all([
    prisma.financialMovement.findMany({
      where: {
        tenantId,
        reversesId: null,
        ...branchFilter,
        date: { gte: from, lte: to },
      },
      include: { account: { select: { type: true } } },
    }),
    prisma.financialMovement.findMany({
      where: {
        tenantId,
        reversesId: null,
        ...branchFilter,
        date: { gte: startOfPreviousMonth, lte: endOfPreviousMonth },
      },
      include: { account: { select: { type: true } } },
    }),
  ]);

  const processMovements = (movements: typeof currentMovements) => {
    let grossSales = 0;
    let discounts = 0;
    let cog = 0;
    let operatingExpenses = 0;
    let otherIncome = 0;
    let otherExpenses = 0;
    const expensesByCategory: Record<string, number> = {};

    for (const m of movements) {
      const amount = Number(m.amount);

      if (m.type === "sale" || m.origin === "order") {
        if (m.concept.toLowerCase().includes("descuento") || m.concept.toLowerCase().includes("bonificacion")) {
          discounts += Math.abs(amount);
        } else {
          grossSales += amount;
        }
      } else if (m.type === "cog" || m.origin === "inventory") {
        cog += Math.abs(amount);
      } else if (m.type === "expense" || m.origin === "expense") {
        operatingExpenses += Math.abs(amount);
        const category = m.concept.split(" ")[0] || "Otros";
        expensesByCategory[category] = (expensesByCategory[category] || 0) + Math.abs(amount);
      } else if (m.direction === "in" && m.type !== "sale") {
        otherIncome += amount;
      } else if (m.direction === "out" && m.type !== "expense" && m.type !== "cog") {
        otherExpenses += Math.abs(amount);
      }
    }

    const netSales = grossSales - discounts;
    const grossProfit = netSales - cog;
    const operatingResult = grossProfit - operatingExpenses;
    const netResult = operatingResult + otherIncome - otherExpenses;

    return {
      grossSales,
      discounts,
      netSales,
      cog,
      grossProfit,
      operatingExpenses,
      operatingResult,
      otherIncome,
      otherExpenses,
      netResult,
      expensesByCategory,
    };
  };

  const current = processMovements(currentMovements);
  const previous = processMovements(previousMovements);

  const expensesByCategoryList = Object.entries(current.expensesByCategory).map(
    ([category, amount]) => ({
      category,
      amount,
      previousAmount: previous.expensesByCategory[category] || 0,
    }),
  );

  return {
    ...current,
    previousPeriod: previous,
    expensesByCategory: expensesByCategoryList,
  };
}

/** @summary Cuenta financiera con saldo detallado. */
export type FinanceAccountDetail = FinanceAccount & {
  openingDate: string;
  createdAt: string;
  updatedAt: string;
};

/** @summary Transferencia financiera. */
export type FinanceTransfer = {
  id: number;
  reference: string;
  fromAccountId: number;
  toAccountId: number;
  amount: number;
  transferDate: string;
  notes: string | null;
  createdAt: string;
  fromAccountName: string;
  toAccountName: string;
  movements: FinanceMovement[];
};

/** @summary Obtiene una cuenta financiera con saldo. */
export async function getAccountWithBalance(tenantId: number, id: number): Promise<FinanceAccountDetail> {
  const account = await prisma.financialAccount.findFirst({
    where: { id, tenantId },
    include: {
      movements: {
        where: { tenantId, reversesId: null },
        select: { direction: true, amount: true },
      },
    },
  });
  if (!account) throw new Error("Cuenta no encontrada");

  return {
    id: account.id,
    name: account.name,
    code: account.code,
    type: account.type,
    currency: account.currency,
    status: account.status,
    openingBalance: Number(account.openingBalance),
    balance: calculateAccountBalance(account),
    notes: account.notes,
    branchId: account.branchId ?? undefined,
    openingDate: account.openingDate.toISOString(),
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
}

/** @summary Elimina lógicamente una cuenta financiera. */
export async function deleteFinancialAccount(tenantId: number, id: number) {
  const account = await prisma.financialAccount.findFirst({
    where: { id, tenantId },
    select: { id: true, status: true },
  });
  if (!account) throw new Error("Cuenta no encontrada");
  if (account.status === "inactive") throw new Error("La cuenta ya fue eliminada");

  await prisma.financialAccount.update({
    where: { id },
    data: { status: "inactive" },
  });
}

/** @summary Anula un movimiento financiero creando el reverso correspondiente. */
export async function reverseFinancialMovement(
  tenantId: number,
  userId: number | null,
  id: number,
  reason: string,
) {
  const movement = await prisma.financialMovement.findFirst({
    where: { id, tenantId },
    include: { account: { select: { name: true } } },
  });
  if (!movement) throw new Error("Movimiento no encontrado");
  if (movement.reversesId) throw new Error("El movimiento ya fue anulado");

  const reversed = await prisma.$transaction(async (tx) => {
    const reversal = await tx.financialMovement.create({
      data: {
        tenantId,
        branchId: movement.branchId,
        accountId: movement.accountId,
        type: movement.type,
        direction: movement.direction === "in" ? "out" : "in",
        amount: movement.amount,
        concept: `Reverso: ${movement.concept}`,
        reference: movement.reference,
        origin: "reversal",
        reversesId: movement.id,
        createdById: userId,
      },
    });

    await tx.financialMovement.update({
      where: { id: movement.id },
      data: { reversesId: reversal.id },
    });

    return reversal;
  });

  return {
    id: reversed.id,
    date: reversed.date.toISOString(),
    accountId: reversed.accountId,
    accountName: movement.account.name,
    type: reversed.type,
    direction: reversed.direction,
    amount: Number(reversed.amount),
    concept: reversed.concept,
    reference: reversed.reference,
    origin: reversed.origin,
    referenceType: reversed.referenceType,
    userName: null,
  };
}

/** @summary Lista transferencias financieras. */
export async function listTransfers(
  tenantId: number,
  filters: {
    branchId?: number | null;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  } = {},
) {
  const where: Prisma.FinancialTransferWhereInput = {
    tenantId,
    ...(filters.branchId && filters.branchId > 0 ? { branchId: filters.branchId } : {}),
    ...(filters.from || filters.to
      ? {
          transferDate: {
            ...(filters.from ? { gte: new Date(filters.from) } : {}),
            ...(filters.to ? { lte: new Date(filters.to) } : {}),
          },
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.financialTransfer.findMany({
      where,
      orderBy: { transferDate: "desc" },
      take: filters.limit ?? 50,
      skip: filters.offset ?? 0,
      include: {
        fromAccount: { select: { name: true } },
        toAccount: { select: { name: true } },
        movements: true,
      },
    }),
    prisma.financialTransfer.count({ where }),
  ]);

  return {
    items: items.map((t) => ({
      id: t.id,
      reference: t.reference,
      fromAccountId: t.fromAccountId,
      toAccountId: t.toAccountId,
      fromAccountName: t.fromAccount.name,
      toAccountName: t.toAccount.name,
      amount: Number(t.amount),
      transferDate: t.transferDate.toISOString(),
      notes: t.notes,
      createdAt: t.createdAt.toISOString(),
      movements: t.movements.map((m) => ({
        id: m.id,
        date: m.date.toISOString(),
        accountId: m.accountId,
        type: m.type,
        direction: m.direction,
        amount: Number(m.amount),
        concept: m.concept,
        reference: m.reference,
        origin: m.origin,
      })),
    })),
    total,
  };
}

/** @summary Crea una transferencia financiera con sus movimientos. */
export async function createTransfer(
  tenantId: number,
  userId: number | null,
  data: {
    fromAccountId: number;
    toAccountId: number;
    amount: number;
    transferDate?: string | null;
    notes?: string | null;
  },
) {
  if (data.fromAccountId === data.toAccountId) {
    throw new Error("Las cuentas de origen y destino deben ser diferentes");
  }

  const [fromAccount, toAccount] = await Promise.all([
    prisma.financialAccount.findFirst({ where: { id: data.fromAccountId, tenantId } }),
    prisma.financialAccount.findFirst({ where: { id: data.toAccountId, tenantId } }),
  ]);

  if (!fromAccount || !toAccount) throw new Error("Una de las cuentas no existe");
  if (fromAccount.status === "inactive" || toAccount.status === "inactive") {
    throw new Error("Una de las cuentas está inactiva");
  }

  const reference = `TRF-${Date.now().toString(36).toUpperCase()}`;

  const transfer = await prisma.$transaction(async (tx) => {
    const created = await tx.financialTransfer.create({
      data: {
        tenantId,
        reference,
        fromAccountId: data.fromAccountId,
        toAccountId: data.toAccountId,
        amount: data.amount,
        transferDate: data.transferDate ? new Date(data.transferDate) : new Date(),
        notes: data.notes?.trim() || null,
        createdById: userId,
      },
      include: {
        fromAccount: { select: { name: true } },
        toAccount: { select: { name: true } },
      },
    });

    await tx.financialMovement.createMany({
      data: [
        {
          tenantId,
          branchId: fromAccount.branchId,
          accountId: data.fromAccountId,
          type: "transfer",
          direction: "out",
          amount: data.amount,
          concept: `Transferencia a ${toAccount.name}`,
          reference,
          origin: "transfer",
          transferId: created.id,
          createdById: userId,
        },
        {
          tenantId,
          branchId: toAccount.branchId,
          accountId: data.toAccountId,
          type: "transfer",
          direction: "in",
          amount: data.amount,
          concept: `Transferencia desde ${fromAccount.name}`,
          reference,
          origin: "transfer",
          transferId: created.id,
          createdById: userId,
        },
      ],
    });

    return created;
  });

  const movements = await prisma.financialMovement.findMany({
    where: { transferId: transfer.id },
    include: { account: { select: { name: true } }, createdBy: { select: { name: true } } },
    orderBy: { date: "asc" },
  });

  return {
    id: transfer.id,
    reference: transfer.reference,
    fromAccountId: transfer.fromAccountId,
    toAccountId: transfer.toAccountId,
    amount: Number(transfer.amount),
    transferDate: transfer.transferDate.toISOString(),
    notes: transfer.notes,
    createdAt: transfer.createdAt.toISOString(),
    fromAccountName: transfer.fromAccount.name,
    toAccountName: transfer.toAccount.name,
    movements: movements.map((m) => ({
      id: m.id,
      date: m.date.toISOString(),
      accountId: m.accountId,
      accountName: m.account.name,
      type: m.type,
      direction: m.direction,
      amount: Number(m.amount),
      concept: m.concept,
      reference: m.reference,
      origin: m.origin,
      referenceType: m.referenceType,
      userName: m.createdBy?.name || null,
    })),
  };
}

/** @summary Obtiene un documento de cuenta a cobrar con sus asignaciones. */
export async function getReceivableDocument(tenantId: number, id: number) {
  const doc = await prisma.receivableDocument.findFirst({
    where: { id, tenantId },
    include: {
      customer: { select: { name: true } },
      order: { select: { reference: true } },
      allocations: {
        include: {
          payment: { select: { number: true, method: true, paidAt: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!doc) throw new Error("Documento no encontrado");

  return {
    id: doc.id,
    number: doc.number,
    customerId: doc.customerId,
    customerName: doc.customer.name,
    orderId: doc.orderId,
    orderNumber: doc.order?.reference || null,
    documentDate: doc.documentDate.toISOString(),
    dueDate: doc.dueDate.toISOString(),
    originalAmount: Number(doc.originalAmount),
    paidAmount: Number(doc.paidAmount),
    pendingAmount: Number(doc.originalAmount) - Number(doc.paidAmount),
    status: doc.status,
    notes: doc.notes,
    branchId: doc.branchId ?? undefined,
    allocations: doc.allocations.map((a) => ({
      id: a.id,
      paymentId: a.paymentId,
      paymentNumber: a.payment.number,
      paymentMethod: a.payment.method,
      paymentPaidAt: a.payment.paidAt.toISOString(),
      amount: Number(a.amount),
      status: a.status,
      reversedAt: a.reversedAt?.toISOString() || null,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}

/** @summary Actualiza un documento de cuenta a cobrar. */
export async function updateReceivableDocument(
  tenantId: number,
  id: number,
  data: { status?: string; notes?: string | null },
) {
  const doc = await prisma.receivableDocument.findFirst({
    where: { id, tenantId },
  });
  if (!doc) throw new Error("Documento no encontrado");

  return prisma.receivableDocument.update({
    where: { id },
    data: {
      ...(data.status !== undefined && { status: data.status }),
      ...(data.notes !== undefined && { notes: data.notes?.trim() || null }),
    },
  });
}

/** @summary Lista pagos de cuentas a cobrar. */
export async function listReceivablePayments(
  tenantId: number,
  filters: {
    customerId?: number | null;
    from?: string;
    to?: string;
    branchId?: number | null;
    limit?: number;
    offset?: number;
  } = {},
) {
  const where: Prisma.ReceivablePaymentWhereInput = {
    tenantId,
    ...(filters.branchId && filters.branchId > 0 ? { branchId: filters.branchId } : {}),
    ...(filters.customerId ? { customerId: filters.customerId } : {}),
    ...(filters.from || filters.to
      ? {
          paidAt: {
            ...(filters.from ? { gte: new Date(filters.from) } : {}),
            ...(filters.to ? { lte: new Date(filters.to) } : {}),
          },
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.receivablePayment.findMany({
      where,
      orderBy: { paidAt: "desc" },
      take: filters.limit ?? 50,
      skip: filters.offset ?? 0,
      include: {
        customer: { select: { name: true } },
        account: { select: { name: true } },
      },
    }),
    prisma.receivablePayment.count({ where }),
  ]);

  return {
    items: items.map((p) => ({
      id: p.id,
      number: p.number,
      customerId: p.customerId,
      customerName: p.customer.name,
      accountId: p.accountId,
      accountName: p.account?.name || null,
      amount: Number(p.amount),
      method: p.method,
      paidAt: p.paidAt.toISOString(),
      notes: p.notes,
      status: p.status,
      reversedAt: p.reversedAt?.toISOString() || null,
      createdAt: p.createdAt.toISOString(),
    })),
    total,
  };
}

/** @summary Crea un pago de cuenta a cobrar con asignaciones. */
export async function createReceivablePayment(
  tenantId: number,
  userId: number | null,
  data: {
    customerId: number;
    amount: number;
    method: string;
    accountId?: number | null;
    paidAt?: string | null;
    notes?: string | null;
    branchId?: number | null;
    allocations: Array<{ documentId: number; amount: number }>;
  },
) {
  if (data.allocations.length === 0) throw new Error("Debe asignar al menos un documento");
  const totalAllocated = data.allocations.reduce((sum, a) => sum + a.amount, 0);
  if (Math.abs(totalAllocated - data.amount) > 0.01) {
    throw new Error("El total asignado no coincide con el monto del pago");
  }

  return prisma.$transaction(async (tx) => {
    const docs = await tx.receivableDocument.findMany({
      where: { id: { in: data.allocations.map((a) => a.documentId) }, tenantId },
    });

    for (const alloc of data.allocations) {
      const doc = docs.find((d) => d.id === alloc.documentId);
      if (!doc) throw new Error(`Documento ${alloc.documentId} no encontrado`);

      const currentPaid = Number(doc.paidAmount);
      const allocAmount = alloc.amount;
      const newPaid = currentPaid + allocAmount;

      if (newPaid > Number(doc.originalAmount) + 0.01) {
        throw new Error(`El documento ${doc.number} está sobre-asignado`);
      }

      let newStatus = doc.status;
      if (newPaid >= Number(doc.originalAmount)) newStatus = "paid";
      else if (newPaid > 0 && doc.status === "open") newStatus = "partially_paid";

      await tx.receivableDocument.update({
        where: { id: doc.id },
        data: { paidAmount: newPaid, status: newStatus },
      });
    }

    const payment = await tx.receivablePayment.create({
      data: {
        tenantId,
        customerId: data.customerId,
        branchId: data.branchId ?? null,
        number: `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        amount: data.amount,
        method: data.method,
        accountId: data.accountId ?? null,
        paidAt: data.paidAt ? new Date(data.paidAt) : new Date(),
        notes: data.notes?.trim() || null,
        createdById: userId,
      },
    });

    await tx.receivableAllocation.createMany({
      data: data.allocations.map((a) => ({
        tenantId,
        paymentId: payment.id,
        documentId: a.documentId,
        amount: a.amount,
      })),
    });

    return payment;
  });
}

/** @summary Anula un pago de cuenta a cobrar deshaciendo asignaciones. */
export async function reverseReceivablePayment(
  tenantId: number,
  userId: number | null,
  id: number,
  reason: string,
) {
  const payment = await prisma.receivablePayment.findFirst({
    where: { id, tenantId },
    include: { allocations: { where: { status: "active" } } },
  });
  if (!payment) throw new Error("Pago no encontrado");
  if (payment.status === "reversed") throw new Error("El pago ya fue anulado");

  return prisma.$transaction(async (tx) => {
    for (const alloc of payment.allocations) {
      const doc = await tx.receivableDocument.findFirst({
        where: { id: alloc.documentId },
      });
      if (!doc) continue;

      const currentPaid = Number(doc.paidAmount);
      const newPaid = Math.max(0, currentPaid - Number(alloc.amount));
      let newStatus = doc.status;
      if (newPaid <= 0) newStatus = "open";
      else if (newPaid < Number(doc.originalAmount)) newStatus = "partially_paid";

      await tx.receivableDocument.update({
        where: { id: doc.id },
        data: { paidAmount: newPaid, status: newStatus },
      });

      await tx.receivableAllocation.update({
        where: { id: alloc.id },
        data: { status: "reversed", reversedAt: new Date(), reversedById: userId },
      });
    }

    const updated = await tx.receivablePayment.update({
      where: { id },
      data: { status: "reversed", reversedAt: new Date(), reversedById: userId },
    });

    return updated;
  });
}

/** @summary Lista pagos de cuentas a pagar (PurchasePayment). */
export async function listPayablePayments(
  tenantId: number,
  filters: {
    supplierId?: number | null;
    from?: string;
    to?: string;
    branchId?: number | null;
    limit?: number;
    offset?: number;
  } = {},
) {
  const where: Prisma.PurchasePaymentWhereInput = {
    tenantId,
    ...(filters.supplierId
      ? {
          OR: [
            { invoice: { supplierId: filters.supplierId } },
            { expense: { supplierId: filters.supplierId } },
          ],
        }
      : {}),
    ...(filters.from || filters.to
      ? {
          paidAt: {
            ...(filters.from ? { gte: new Date(filters.from) } : {}),
            ...(filters.to ? { lte: new Date(filters.to) } : {}),
          },
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.purchasePayment.findMany({
      where,
      orderBy: { paidAt: "desc" },
      take: filters.limit ?? 50,
      skip: filters.offset ?? 0,
      include: {
        invoice: { select: { number: true, supplier: { select: { name: true } } } },
        expense: { select: { number: true, supplier: { select: { name: true } } } },
      },
    }),
    prisma.purchasePayment.count({ where }),
  ]);

  return {
    items: items.map((p) => ({
      id: p.id,
      number: p.number,
      invoiceId: p.invoiceId,
      invoiceNumber: p.invoice?.number || null,
      expenseId: p.expenseId,
      expenseNumber: p.expense?.number || null,
      supplierName: p.invoice?.supplier.name || p.expense?.supplier?.name || null,
      amount: Number(p.amount),
      method: p.method,
      paidAt: p.paidAt.toISOString(),
      notes: p.notes,
      createdAt: p.createdAt.toISOString(),
    })),
    total,
  };
}

/** @summary Crea un pago de cuenta a pagar y actualiza el saldo. */
export async function createPayablePayment(
  tenantId: number,
  userId: number | null,
  data: {
    invoiceId?: number | null;
    expenseId?: number | null;
    amount: number;
    method: string;
    paidAt?: string | null;
    notes?: string | null;
    branchId?: number | null;
  },
) {
  if (!data.invoiceId && !data.expenseId) {
    throw new Error("Debe especificar una factura o un gasto");
  }

  let remaining = 0;
  let supplierName: string | null = null;
  let documentNumber: string | null = null;

  if (data.invoiceId) {
    const invoice = await prisma.purchaseInvoice.findFirst({
      where: { id: data.invoiceId, tenantId },
      include: { supplier: { select: { name: true } } },
    });
    if (!invoice) throw new Error("Factura no encontrada");
    remaining = Number(invoice.total) - Number(invoice.paidAmount);
    supplierName = invoice.supplier.name;
    documentNumber = invoice.number;
  } else if (data.expenseId) {
    const expense = await prisma.expense.findFirst({
      where: { id: data.expenseId, tenantId },
      include: { supplier: { select: { name: true } } },
    });
    if (!expense) throw new Error("Gasto no encontrado");
    remaining = Number(expense.total) - Number(expense.paidAmount);
    supplierName = expense.supplier?.name || null;
    documentNumber = expense.number;
  }

  if (data.amount > remaining + 0.01) {
    throw new Error(`El monto supera el saldo pendiente (${remaining.toFixed(2)})`);
  }

  const payment = await prisma.purchasePayment.create({
    data: {
      tenantId,
      invoiceId: data.invoiceId ?? null,
      expenseId: data.expenseId ?? null,
      number: `PC-${Date.now().toString(36).toUpperCase()}`,
      amount: data.amount,
      method: data.method,
      paidAt: data.paidAt ? new Date(data.paidAt) : new Date(),
      notes: data.notes?.trim() || null,
      createdById: userId,
    },
  });

  if (data.invoiceId) {
    await prisma.purchaseInvoice.update({
      where: { id: data.invoiceId },
      data: { paidAmount: { increment: data.amount } },
    });
  } else if (data.expenseId) {
    await prisma.expense.update({
      where: { id: data.expenseId },
      data: { paidAmount: { increment: data.amount } },
    });
  }

  return {
    id: payment.id,
    number: payment.number,
    invoiceId: payment.invoiceId,
    expenseId: payment.expenseId,
    supplierName,
    documentNumber,
    amount: Number(payment.amount),
    method: payment.method,
    paidAt: payment.paidAt.toISOString(),
    notes: payment.notes,
    createdAt: payment.createdAt.toISOString(),
  };
}

/** @summary Crea un documento de cuenta a cobrar. */
export async function createReceivableDocument(
  tenantId: number,
  userId: number | null,
  data: {
    customerId: number;
    orderId?: number | null;
    number?: string | null;
    dueDate: string;
    originalAmount: number;
    concept: string;
    branchId?: number | null;
    notes?: string | null;
  },
) {
  if (!data.number) {
    const counter = await prisma.documentSequence.upsert({
      where: { tenantId_prefix: { tenantId, prefix: "RC" } },
      create: { tenantId, prefix: "RC", lastValue: 0 },
      update: {},
    });
    data.number = `RC-${String(counter.lastValue + 1).padStart(6, "0")}`;
    await prisma.documentSequence.update({
      where: { tenantId_prefix: { tenantId, prefix: "RC" } },
      data: { lastValue: counter.lastValue + 1 },
    });
  }

  return prisma.receivableDocument.create({
    data: {
      tenantId,
      customerId: data.customerId,
      orderId: data.orderId ?? null,
      number: data.number,
      dueDate: new Date(data.dueDate),
      originalAmount: data.originalAmount,
      concept: data.concept,
      branchId: data.branchId ?? null,
      notes: data.notes?.trim() || null,
      createdById: userId,
    },
  });
}
