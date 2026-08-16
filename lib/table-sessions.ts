import { Prisma } from "@prisma/client";
import type { AuthorizationContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { orderPublicToken, orderReference, orderTokenHash } from "@/lib/order-security";
import { productAvailableAt } from "@/lib/product-availability";
import { assertStockAvailability, consumeOrderStock } from "@/lib/order-stock";
import {
  deriveSessionStatus,
  isTableSessionStatus,
  tableStatusLabel,
  tableSessionStatuses,
} from "@/lib/table-status";
import { awardOrderLoyalty } from "@/lib/loyalty";

/**
 * Lógica de negocio del salón de mesas.
 *
 * Todas las operaciones validan tenant + sucursal + permisos de la sesión de
 * administración y usan transacciones con guardas optimistas (updateMany sobre
 * el estado esperado) para evitar aperturas/cierres dobles o movimientos
 * inconsistentes. Los eventos quedan registrados en el timeline de la sesión y
 * las operaciones sensibles además se auditan desde las rutas.
 */

/** @summary Error de negocio con código HTTP sugerido, traducido a JSON por las rutas. */
export class TableServiceError extends Error {
  status: number;
  constructor(message: string, status = 409) {
    super(message);
    this.name = "TableServiceError";
    this.status = status;
  }
}

/** @summary Devuelve la sucursal accesible y operativa, o null si no hay acceso. */
function accessibleBranch(context: AuthorizationContext, branchId: number | null | undefined) {
  if (!branchId) return null;
  return (
    context.branches.find(
      (branch) => branch.id === branchId && branch.active && branch.status === "active",
    ) ?? null
  );
}

/** @summary Verifica que el camarero pertenezca a una membresía activa del tenant. */
async function assertTenantWaiter(context: AuthorizationContext, waiterUserId?: number | null) {
  if (!waiterUserId) return;
  const waiter = await prisma.user.findFirst({
    where: {
      id: waiterUserId,
      memberships: { some: { tenantId: context.tenant.id, status: "active" } },
    },
    select: { id: true },
  });
  if (!waiter) throw new TableServiceError("El camarero seleccionado no pertenece al negocio", 400);
}

/** @summary Genera una referencia de pedido que no se encuentre utilizada en la base. */
async function uniqueOrderReference(prefix: string) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const reference = orderReference(new Date(), prefix);
    const exists = await prisma.customerOrder.findUnique({ where: { reference }, select: { id: true } });
    if (!exists) return reference;
  }
  throw new TableServiceError("No se pudo generar la referencia del consumo");
}

/** @summary Estados de pedido que se consideran consumo abierto de la mesa. */
const openOrderStatusFilter = { notIn: ["delivered", "cancelled"] };

/** @summary Recalcula y persiste el estado de una sesión según sus pedidos abiertos. */
async function refreshSessionStatus(transaction: Prisma.TransactionClient, sessionId: number) {
  const statuses = await transaction.customerOrder.findMany({
    where: { tableSessionId: sessionId, status: openOrderStatusFilter },
    select: { status: true },
  });
  const status = deriveSessionStatus(statuses.map((item) => item.status));
  await transaction.tableSession.update({ where: { id: sessionId }, data: { status } });
  return status;
}

export type OpenTableSessionInput = {
  tableId: number;
  customerName?: string;
  phone?: string;
  partySize: number;
  waiterUserId?: number | null;
  notes?: string;
  reserved?: boolean;
};

/**
 * @summary Abre la mesa: crea la sesión solo si la mesa no tiene otra abierta.
 * El bloqueo FOR UPDATE sobre la fila de la mesa serializa aperturas simultáneas.
 */
export async function openTableSession(context: AuthorizationContext, input: OpenTableSessionInput) {
  const table = await prisma.diningTable.findFirst({
    where: { id: input.tableId, tenantId: context.tenant.id, active: true },
  });
  if (!table) throw new TableServiceError("La mesa no existe o no está activa", 404);
  if (!table.branchId) throw new TableServiceError("La mesa no tiene una sucursal asignada", 409);
  const branchId = table.branchId;
  if (!accessibleBranch(context, branchId)) {
    throw new TableServiceError("No tenés acceso a la sucursal de esta mesa", 403);
  }
  await assertTenantWaiter(context, input.waiterUserId);

  const session = await prisma.$transaction(async (transaction) => {
    const locked = await transaction.$queryRaw<Array<{ id: number }>>(
      Prisma.sql`SELECT id FROM diningtable WHERE tenantId = ${context.tenant.id} AND id = ${table.id} FOR UPDATE`,
    );
    if (locked.length === 0) throw new TableServiceError("La mesa ya no está disponible", 404);
    const existing = await transaction.tableSession.findFirst({
      where: { tenantId: context.tenant.id, tableId: table.id, closedAt: null },
      select: { id: true },
    });
    if (existing) throw new TableServiceError("La mesa ya está ocupada", 409);

    const created = await transaction.tableSession.create({
      data: {
        tenantId: context.tenant.id,
        branchId,
        tableId: table.id,
        status: input.reserved ? "reserved" : "occupied",
        customerName: input.customerName?.trim() || null,
        phone: input.phone?.trim() || null,
        partySize: input.partySize,
        notes: input.notes?.trim() || null,
        waiterUserId: input.waiterUserId ?? undefined,
      },
    });
    await transaction.tableSessionEvent.create({
      data: {
        tenantId: context.tenant.id,
        branchId,
        sessionId: created.id,
        eventType: input.reserved ? "reserved" : "opened",
        note: input.reserved ? "Mesa reservada" : "Mesa abierta",
        userId: context.session.userId,
      },
    });
    return created;
  });
  return { session, table: { id: table.id, name: table.name, code: table.code, branchId: table.branchId } };
}

export type TableOrderItemInput = {
  productId: number;
  quantity: number;
  variantId?: number | null;
  extraIds?: number[];
  notes?: string;
};

/**
 * @summary Agrega un consumo (comanda) a la mesa con precios validados en el servidor.
 * Descuenta stock cuando corresponde, notifica y mantiene el estado de la sesión.
 */
export async function addTableOrder(
  context: AuthorizationContext,
  sessionId: number,
  items: TableOrderItemInput[],
) {
  const session = await prisma.tableSession.findFirst({
    where: { id: sessionId, tenantId: context.tenant.id, closedAt: null },
    include: { table: { select: { id: true, name: true, code: true } } },
  });
  if (!session) throw new TableServiceError("La mesa no está abierta o ya no existe", 404);
  if (!accessibleBranch(context, session.branchId)) {
    throw new TableServiceError("No tenés acceso a la sucursal de esta mesa", 403);
  }
  const branch = await prisma.branch.findFirst({
    where: { id: session.branchId, tenantId: context.tenant.id, active: true },
    select: { id: true, orderPrefix: true },
  });
  if (!branch) throw new TableServiceError("La sucursal de la mesa no está operativa", 409);
  const tenant = await prisma.tenant.findUnique({
    where: { id: context.tenant.id },
    select: { defaultCurrency: true, timeZone: true },
  });
  if (!tenant) throw new TableServiceError("El negocio no está disponible", 409);

  const productIds = [...new Set(items.map((item) => item.productId))];
  const products = await prisma.product.findMany({
    where: {
      tenantId: context.tenant.id,
      id: { in: productIds },
      OR: [{ status: "published" }, { status: "scheduled", publishAt: { lte: new Date() } }],
      branchAssignments: { some: { branchId: session.branchId, active: true } },
    },
    include: {
      variants: { where: { active: true } },
      extras: { where: { active: true } },
    },
  });
  const productMap = new Map(products.map((product) => [product.id, product]));
  if (products.length !== productIds.length) {
    throw new TableServiceError("Uno de los productos ya no está disponible", 409);
  }

  let calculatedItems: Array<{
    productId: number;
    productName: string;
    quantity: number;
    unitPrice: number;
    variantName: string | null;
    variantPrice: number;
    extras: Array<{ id: number; name: string; price: number }>;
    extrasTotal: number;
    notes: string | null;
    lineTotal: number;
  }>;
  try {
    calculatedItems = items.map((input) => {
      const product = productMap.get(input.productId);
      if (
        !product ||
        product.availability?.toLowerCase() === "agotado" ||
        !productAvailableAt(
          product.availableDays,
          product.availableStartTime,
          product.availableEndTime,
          new Date(),
          tenant.timeZone,
        )
      ) {
        throw new Error("Uno de los productos está agotado");
      }
      const variant = input.variantId ? product.variants.find((item) => item.id === input.variantId) : null;
      if (input.variantId && !variant) throw new Error("La variante seleccionada ya no está disponible");
      const extraIds = input.extraIds ?? [];
      const selectedExtras = product.extras.filter((extra) => extraIds.includes(extra.id));
      if (selectedExtras.length !== new Set(extraIds).size) {
        throw new Error("Uno de los agregados ya no está disponible");
      }
      const unitPrice = Number(product.promotionalPrice ?? product.price ?? 0);
      const variantPrice = Number(variant?.priceAdjustment ?? 0);
      const extrasTotal = selectedExtras.reduce((sum, extra) => sum + Number(extra.price), 0);
      const lineTotal = (unitPrice + variantPrice + extrasTotal) * input.quantity;
      return {
        productId: product.id,
        productName: product.name,
        quantity: input.quantity,
        unitPrice,
        variantName: variant?.name ?? null,
        variantPrice,
        extras: selectedExtras.map((extra) => ({
          id: extra.id,
          name: extra.name,
          price: Number(extra.price),
        })),
        extrasTotal,
        notes: input.notes?.trim() || null,
        lineTotal,
      };
    });
  } catch (reason) {
    throw new TableServiceError(
      reason instanceof Error ? reason.message : "No se pudo validar el consumo",
      409,
    );
  }

  const subtotal = calculatedItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const quantities = new Map<number, number>();
  for (const item of calculatedItems) {
    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
  }
  const stocks = await assertStockAvailability(
    context.tenant.id,
    session.branchId,
    quantities,
    (productId) => productMap.get(productId)?.name ?? "Producto",
  );

  const reference = await uniqueOrderReference(branch.orderPrefix);
  const token = orderPublicToken();
  const itemCount = calculatedItems.reduce((sum, item) => sum + item.quantity, 0);

  const order = await prisma.$transaction(async (transaction) => {
    const stillOpen = await transaction.tableSession.findFirst({
      where: { id: session.id, tenantId: context.tenant.id, closedAt: null },
      select: { id: true },
    });
    if (!stillOpen) throw new TableServiceError("La mesa se cerró mientras cargabas el consumo", 409);

    const created = await transaction.customerOrder.create({
      data: {
        tenantId: context.tenant.id,
        branchId: session.branchId,
        tableId: session.tableId,
        tableSessionId: session.id,
        reference,
        publicTokenHash: orderTokenHash(token),
        status: "received",
        orderType: "dine_in",
        customerName: session.customerName ?? `Mesa ${session.table.name}`,
        phone: session.phone ?? "",
        subtotal,
        discount: 0,
        deliveryFee: 0,
        tip: 0,
        total: subtotal,
        currency: tenant.defaultCurrency,
        paymentMethod: "cash",
        paymentStatus: "pending",
        source: `salon:${session.table.code}`,
        items: { create: calculatedItems },
        history: { create: { toStatus: "received", note: "Consumo cargado desde el salón" } },
      },
    });
    await consumeOrderStock(transaction, {
      tenantId: context.tenant.id,
      branchId: session.branchId,
      orderId: created.id,
      reference,
      quantities,
      stocks,
      productName: (productId) => productMap.get(productId)?.name ?? "Producto",
    });
    await refreshSessionStatus(transaction, session.id);
    await transaction.tableSessionEvent.create({
      data: {
        tenantId: context.tenant.id,
        branchId: session.branchId,
        sessionId: session.id,
        eventType: "order_added",
        note: `Comanda ${reference} · ${itemCount} producto${itemCount === 1 ? "" : "s"}`,
        userId: context.session.userId,
      },
    });
    await transaction.notification.create({
      data: {
        tenantId: context.tenant.id,
        branchId: session.branchId,
        type: "order.new",
        title: `Nuevo consumo · ${reference}`,
        message: `${session.table.name}: ${itemCount} producto${itemCount === 1 ? "" : "s"} por ${tenant.defaultCurrency} ${subtotal.toFixed(2)}.`,
        link: "/admin/pedidos",
      },
    });
    await transaction.analyticsEvent.create({
      data: {
        tenantId: context.tenant.id,
        branchId: session.branchId,
        eventType: "order.completed",
        path: "/admin/salon",
        entityType: "order",
        entityId: created.id,
        metadata: { total: subtotal, itemCount, source: "salon" },
      },
    });
    return created;
  });

  return { order, reference, token, total: subtotal, sessionStatus: undefined };
}

export type UpdateTableSessionInput = {
  customerName?: string;
  phone?: string;
  partySize?: number;
  waiterUserId?: number | null;
  notes?: string;
  status?: string;
};

/** @summary Actualiza datos operativos de la sesión (cliente, comensales, camarero, estado). */
export async function updateTableSession(context: AuthorizationContext, sessionId: number, input: UpdateTableSessionInput) {
  const session = await prisma.tableSession.findFirst({
    where: { id: sessionId, tenantId: context.tenant.id, closedAt: null },
  });
  if (!session) throw new TableServiceError("La mesa no está abierta o ya no existe", 404);
  if (!accessibleBranch(context, session.branchId)) {
    throw new TableServiceError("No tenés acceso a la sucursal de esta mesa", 403);
  }
  if (input.waiterUserId !== undefined && input.waiterUserId !== null) {
    await assertTenantWaiter(context, input.waiterUserId);
  }
  if (input.status !== undefined && !isTableSessionStatus(input.status)) {
    throw new TableServiceError("Estado de mesa inválido", 400);
  }

  const data: Prisma.TableSessionUncheckedUpdateManyInput = {};
  if (input.customerName !== undefined) data.customerName = input.customerName.trim() || null;
  if (input.phone !== undefined) data.phone = input.phone.trim() || null;
  if (input.partySize !== undefined) data.partySize = input.partySize;
  if (input.waiterUserId !== undefined) data.waiterUserId = input.waiterUserId;
  if (input.notes !== undefined) data.notes = input.notes.trim() || null;
  if (input.status !== undefined) data.status = input.status;

  if (Object.keys(data).length === 0) return { session, changed: false };

  const updated = await prisma.$transaction(async (transaction) => {
    const guarded = await transaction.tableSession.updateMany({
      where: { id: session.id, tenantId: context.tenant.id, closedAt: null },
      data,
    });
    if (guarded.count !== 1) throw new TableServiceError("La mesa cambió de estado mientras tanto", 409);
    const fresh = await transaction.tableSession.findUniqueOrThrow({ where: { id: session.id } });
    const statusChanged = input.status !== undefined && input.status !== session.status;
    await transaction.tableSessionEvent.create({
      data: {
        tenantId: context.tenant.id,
        branchId: session.branchId,
        sessionId: session.id,
        eventType: statusChanged ? "status_changed" : "updated",
        note: statusChanged
          ? `Estado: ${tableStatusLabel(session.status)} → ${tableStatusLabel(input.status as string)}`
          : "Datos de la mesa actualizados",
        userId: context.session.userId,
      },
    });
    return fresh;
  });
  return { session: updated, changed: true };
}

/**
 * @summary Cierra la mesa: entrega los consumos abiertos, acredita fidelidad y cierra la sesión.
 * Solo el cierre guarda `closedAt`; los pedidos entregados quedan en el flujo de facturación existente.
 */
export async function closeTableSession(context: AuthorizationContext, sessionId: number) {
  const session = await prisma.tableSession.findFirst({
    where: { id: sessionId, tenantId: context.tenant.id, closedAt: null },
    include: {
      table: { select: { id: true, name: true, code: true } },
      orders: {
        where: { status: openOrderStatusFilter },
        select: { id: true, status: true, reference: true, total: true, customerId: true },
      },
    },
  });
  if (!session) throw new TableServiceError("La mesa no está abierta o ya no existe", 404);
  if (!accessibleBranch(context, session.branchId)) {
    throw new TableServiceError("No tenés acceso a la sucursal de esta mesa", 403);
  }

  const result = await prisma.$transaction(async (transaction) => {
    const guarded = await transaction.tableSession.updateMany({
      where: { id: session.id, tenantId: context.tenant.id, closedAt: null },
      data: { closedAt: new Date(), closedByUserId: context.session.userId },
    });
    if (guarded.count !== 1) throw new TableServiceError("La mesa ya fue cerrada", 409);

    let delivered = 0;
    for (const order of session.orders) {
      const updated = await transaction.customerOrder.updateMany({
        where: { id: order.id, tenantId: context.tenant.id, tableSessionId: session.id, status: order.status },
        data: { status: "delivered" },
      });
      if (updated.count === 1) {
        delivered += 1;
        await transaction.orderStatusHistory.create({
          data: {
            orderId: order.id,
            userId: context.session.userId,
            fromStatus: order.status,
            toStatus: "delivered",
            note: "Mesa cerrada",
          },
        });
        await awardOrderLoyalty(transaction, {
          id: order.id,
          customerId: order.customerId,
          reference: order.reference,
          total: Number(order.total),
        });
      }
    }
    const total = session.orders.reduce((sum, order) => sum + Number(order.total), 0);
    const currency = (await transaction.tenant.findUnique({
      where: { id: context.tenant.id },
      select: { defaultCurrency: true },
    }))?.defaultCurrency ?? "ARS";
    await transaction.tableSessionEvent.create({
      data: {
        tenantId: context.tenant.id,
        branchId: session.branchId,
        sessionId: session.id,
        eventType: "closed",
        note:
          delivered > 0
            ? `${delivered} comanda${delivered === 1 ? "" : "s"} entregada${delivered === 1 ? "" : "s"} · ${currency} ${total.toFixed(2)}`
            : "Mesa cerrada sin consumos",
        userId: context.session.userId,
      },
    });
    if (delivered > 0) {
      await transaction.notification.create({
        data: {
          tenantId: context.tenant.id,
          branchId: session.branchId,
          type: "table.closed",
          title: `Mesa ${session.table.name} cerrada`,
          message: `${delivered} comanda${delivered === 1 ? "" : "s"} entregada${delivered === 1 ? "" : "s"} por ${currency} ${total.toFixed(2)}.`,
          link: "/admin/facturacion",
        },
      });
    }
    return { delivered, total };
  });
  return result;
}

/**
 * @summary Traslada la mesa: la sesión y sus consumos abiertos pasan a otra mesa de la misma sucursal.
 */
export async function moveTable(context: AuthorizationContext, sessionId: number, targetTableId: number) {
  const session = await prisma.tableSession.findFirst({
    where: { id: sessionId, tenantId: context.tenant.id, closedAt: null },
    include: { table: { select: { id: true, name: true } } },
  });
  if (!session) throw new TableServiceError("La mesa no está abierta o ya no existe", 404);
  if (!accessibleBranch(context, session.branchId)) {
    throw new TableServiceError("No tenés acceso a la sucursal de esta mesa", 403);
  }
  const target = await prisma.diningTable.findFirst({
    where: { id: targetTableId, tenantId: context.tenant.id, branchId: session.branchId, active: true },
  });
  if (!target) throw new TableServiceError("La mesa de destino no existe en esta sucursal", 404);
  if (target.id === session.tableId) throw new TableServiceError("La mesa de destino es la misma", 409);

  const result = await prisma.$transaction(async (transaction) => {
    const locked = await transaction.$queryRaw<Array<{ id: number }>>(
      Prisma.sql`SELECT id FROM diningtable WHERE tenantId = ${context.tenant.id} AND id = ${target.id} FOR UPDATE`,
    );
    if (locked.length === 0) throw new TableServiceError("La mesa de destino ya no existe", 404);
    const occupied = await transaction.tableSession.findFirst({
      where: { tenantId: context.tenant.id, tableId: target.id, closedAt: null },
      select: { id: true },
    });
    if (occupied) throw new TableServiceError("La mesa de destino ya está ocupada", 409);

    const guarded = await transaction.tableSession.updateMany({
      where: { id: session.id, tenantId: context.tenant.id, closedAt: null },
      data: { tableId: target.id },
    });
    if (guarded.count !== 1) throw new TableServiceError("La mesa cambió de estado mientras tanto", 409);
    const movedOrders = await transaction.customerOrder.updateMany({
      where: {
        tenantId: context.tenant.id,
        tableSessionId: session.id,
        tableId: session.tableId,
        status: openOrderStatusFilter,
      },
      data: { tableId: target.id },
    });
    await transaction.tableSessionEvent.create({
      data: {
        tenantId: context.tenant.id,
        branchId: session.branchId,
        sessionId: session.id,
        eventType: "table_moved",
        note: `Trasladada de ${session.table.name} a ${target.name}`,
        userId: context.session.userId,
      },
    });
    return { movedOrders: movedOrders.count };
  });
  return result;
}

/**
 * @summary Mueve comandas seleccionadas a otra sesión abierta de la misma sucursal.
 * Nunca cruza sucursales: el destino debe pertenecer a la misma rama operativa.
 */
export async function transferOrders(
  context: AuthorizationContext,
  sessionId: number,
  orderIds: number[],
  targetSessionId: number,
) {
  const [source, target] = await Promise.all([
    prisma.tableSession.findFirst({
      where: { id: sessionId, tenantId: context.tenant.id, closedAt: null },
      include: { table: { select: { id: true, name: true } } },
    }),
    prisma.tableSession.findFirst({
      where: { id: targetSessionId, tenantId: context.tenant.id, closedAt: null },
      include: { table: { select: { id: true, name: true } } },
    }),
  ]);
  if (!source || !target) throw new TableServiceError("Una de las mesas no está abierta", 404);
  if (!accessibleBranch(context, source.branchId) || !accessibleBranch(context, target.branchId)) {
    throw new TableServiceError("No tenés acceso a la sucursal de estas mesas", 403);
  }
  if (source.branchId !== target.branchId) {
    throw new TableServiceError("No se pueden mover consumos entre sucursales", 409);
  }
  if (source.id === target.id) throw new TableServiceError("El destino es la misma mesa", 409);
  if (orderIds.length === 0) throw new TableServiceError("Seleccioná al menos una comanda", 400);

  const result = await prisma.$transaction(async (transaction) => {
    let moved = 0;
    for (const orderId of orderIds) {
      const updated = await transaction.customerOrder.updateMany({
        where: {
          id: orderId,
          tenantId: context.tenant.id,
          tableSessionId: source.id,
          tableId: source.tableId,
          status: openOrderStatusFilter,
        },
        data: { tableSessionId: target.id, tableId: target.tableId, branchId: target.branchId },
      });
      if (updated.count === 1) moved += 1;
    }
    if (moved === 0) throw new TableServiceError("Ninguna comanda seleccionada pudo moverse", 409);
    await refreshSessionStatus(transaction, source.id);
    await refreshSessionStatus(transaction, target.id);
    await transaction.tableSessionEvent.create({
      data: {
        tenantId: context.tenant.id,
        branchId: source.branchId,
        sessionId: source.id,
        eventType: "orders_moved_out",
        note: `${moved} comanda${moved === 1 ? "" : "s"} movida${moved === 1 ? "" : "s"} a ${target.table.name}`,
        userId: context.session.userId,
      },
    });
    await transaction.tableSessionEvent.create({
      data: {
        tenantId: context.tenant.id,
        branchId: target.branchId,
        sessionId: target.id,
        eventType: "orders_moved_in",
        note: `${moved} comanda${moved === 1 ? "" : "s"} recibida${moved === 1 ? "" : "s"} de ${source.table.name}`,
        userId: context.session.userId,
      },
    });
    return { moved };
  });
  return result;
}

/**
 * @summary Une dos mesas: todos los consumos abiertos de la sesión pasan al destino y la fuente se cierra.
 */
export async function mergeSessions(context: AuthorizationContext, sessionId: number, targetSessionId: number) {
  const [source, target] = await Promise.all([
    prisma.tableSession.findFirst({
      where: { id: sessionId, tenantId: context.tenant.id, closedAt: null },
      include: { table: { select: { id: true, name: true } } },
    }),
    prisma.tableSession.findFirst({
      where: { id: targetSessionId, tenantId: context.tenant.id, closedAt: null },
      include: { table: { select: { id: true, name: true } } },
    }),
  ]);
  if (!source || !target) throw new TableServiceError("Una de las mesas no está abierta", 404);
  if (!accessibleBranch(context, source.branchId) || !accessibleBranch(context, target.branchId)) {
    throw new TableServiceError("No tenés acceso a la sucursal de estas mesas", 403);
  }
  if (source.branchId !== target.branchId) {
    throw new TableServiceError("No se pueden unir mesas de sucursales distintas", 409);
  }
  if (source.id === target.id) throw new TableServiceError("La mesa de destino es la misma", 409);

  const result = await prisma.$transaction(async (transaction) => {
    const orders = await transaction.customerOrder.findMany({
      where: {
        tenantId: context.tenant.id,
        tableSessionId: source.id,
        tableId: source.tableId,
        status: openOrderStatusFilter,
      },
      select: { id: true },
    });
    let moved = 0;
    for (const order of orders) {
      const updated = await transaction.customerOrder.updateMany({
        where: {
          id: order.id,
          tenantId: context.tenant.id,
          tableSessionId: source.id,
          status: openOrderStatusFilter,
        },
        data: { tableSessionId: target.id, tableId: target.tableId, branchId: target.branchId },
      });
      if (updated.count === 1) moved += 1;
    }
    await refreshSessionStatus(transaction, target.id);
    const closed = await transaction.tableSession.updateMany({
      where: { id: source.id, tenantId: context.tenant.id, closedAt: null },
      data: { closedAt: new Date(), closedByUserId: context.session.userId },
    });
    if (closed.count !== 1) throw new TableServiceError("La mesa fuente cambió mientras se unía", 409);
    await transaction.tableSessionEvent.create({
      data: {
        tenantId: context.tenant.id,
        branchId: target.branchId,
        sessionId: target.id,
        eventType: "merged",
        note: `Unida la mesa ${source.table.name} (${moved} comanda${moved === 1 ? "" : "s"})`,
        userId: context.session.userId,
      },
    });
    await transaction.tableSessionEvent.create({
      data: {
        tenantId: context.tenant.id,
        branchId: source.branchId,
        sessionId: source.id,
        eventType: "merged_into",
        note: `Unida a la mesa ${target.table.name}`,
        userId: context.session.userId,
      },
    });
    return { moved, mergedInto: target.table.name };
  });
  return result;
}

/**
 * @summary Separa la cuenta: mueve comandas seleccionadas a una mesa libre de la misma sucursal.
 * Crea una nueva sesión en el destino con los datos del grupo.
 */
export async function splitSession(
  context: AuthorizationContext,
  sessionId: number,
  orderIds: number[],
  targetTableId: number,
) {
  const source = await prisma.tableSession.findFirst({
    where: { id: sessionId, tenantId: context.tenant.id, closedAt: null },
    include: { table: { select: { id: true, name: true } } },
  });
  if (!source) throw new TableServiceError("La mesa no está abierta o ya no existe", 404);
  if (!accessibleBranch(context, source.branchId)) {
    throw new TableServiceError("No tenés acceso a la sucursal de esta mesa", 403);
  }
  const target = await prisma.diningTable.findFirst({
    where: { id: targetTableId, tenantId: context.tenant.id, branchId: source.branchId, active: true },
  });
  if (!target) throw new TableServiceError("La mesa de destino no existe en esta sucursal", 404);
  if (orderIds.length === 0) throw new TableServiceError("Seleccioná al menos una comanda", 400);

  const result = await prisma.$transaction(async (transaction) => {
    const locked = await transaction.$queryRaw<Array<{ id: number }>>(
      Prisma.sql`SELECT id FROM diningtable WHERE tenantId = ${context.tenant.id} AND id = ${target.id} FOR UPDATE`,
    );
    if (locked.length === 0) throw new TableServiceError("La mesa de destino ya no existe", 404);
    const occupied = await transaction.tableSession.findFirst({
      where: { tenantId: context.tenant.id, tableId: target.id, closedAt: null },
      select: { id: true },
    });
    if (occupied) throw new TableServiceError("La mesa de destino ya está ocupada", 409);

    const created = await transaction.tableSession.create({
      data: {
        tenantId: context.tenant.id,
        branchId: source.branchId,
        tableId: target.id,
        status: "occupied",
        customerName: source.customerName,
        phone: source.phone,
        partySize: source.partySize,
        notes: source.notes ? `Separada de ${source.table.name}. ${source.notes}` : `Separada de ${source.table.name}`,
        waiterUserId: source.waiterUserId ?? undefined,
      },
    });
    let moved = 0;
    for (const orderId of orderIds) {
      const updated = await transaction.customerOrder.updateMany({
        where: {
          id: orderId,
          tenantId: context.tenant.id,
          tableSessionId: source.id,
          tableId: source.tableId,
          status: openOrderStatusFilter,
        },
        data: { tableSessionId: created.id, tableId: target.id, branchId: target.branchId },
      });
      if (updated.count === 1) moved += 1;
    }
    if (moved === 0) {
      throw new TableServiceError("Ninguna comanda seleccionada pudo separarse", 409);
    }
    await refreshSessionStatus(transaction, source.id);
    await refreshSessionStatus(transaction, created.id);
    await transaction.tableSessionEvent.create({
      data: {
        tenantId: context.tenant.id,
        branchId: source.branchId,
        sessionId: source.id,
        eventType: "orders_moved_out",
        note: `${moved} comanda${moved === 1 ? "" : "s"} separada${moved === 1 ? "" : "s"} a ${target.name}`,
        userId: context.session.userId,
      },
    });
    await transaction.tableSessionEvent.create({
      data: {
        tenantId: context.tenant.id,
        branchId: source.branchId,
        sessionId: created.id,
        eventType: "split_from",
        note: `Separada de ${source.table.name}`,
        userId: context.session.userId,
      },
    });
    return { session: created, moved };
  });
  return result;
}

/** @summary Guarda la posición de una mesa en el plano del salón (coordenadas 0-1000). */
export async function saveTablePosition(context: AuthorizationContext, tableId: number, x: number, y: number) {
  const table = await prisma.diningTable.findFirst({ where: { id: tableId, tenantId: context.tenant.id } });
  if (!table) throw new TableServiceError("Mesa no encontrada", 404);
  if (table.branchId && !accessibleBranch(context, table.branchId)) {
    throw new TableServiceError("No tenés acceso a la sucursal de esta mesa", 403);
  }
  const clamp = (value: number) => Math.min(1000, Math.max(0, Math.round(Number.isFinite(value) ? value : 0)));
  const updated = await prisma.diningTable.update({
    where: { id: tableId },
    data: { positionX: clamp(x), positionY: clamp(y) },
  });
  return { table: { id: updated.id, positionX: updated.positionX, positionY: updated.positionY } };
}

/** @summary Crea un sector del salón con nombre único dentro de la sucursal. */
export async function createTableSector(
  context: AuthorizationContext,
  input: { branchId: number; name: string; sortOrder?: number },
) {
  if (!accessibleBranch(context, input.branchId)) {
    throw new TableServiceError("No tenés acceso a esa sucursal", 403);
  }
  const name = input.name.trim();
  if (!name) throw new TableServiceError("Escribí el nombre del sector", 400);
  const existing = await prisma.tableSector.findUnique({
    where: { tenantId_branchId_name: { tenantId: context.tenant.id, branchId: input.branchId, name } },
    select: { id: true },
  });
  if (existing) throw new TableServiceError("Ya existe un sector con ese nombre en esta sucursal", 409);
  const max = await prisma.tableSector.aggregate({
    where: { tenantId: context.tenant.id, branchId: input.branchId },
    _max: { sortOrder: true },
  });
  const created = await prisma.tableSector.create({
    data: {
      tenantId: context.tenant.id,
      branchId: input.branchId,
      name,
      sortOrder: input.sortOrder ?? (max._max.sortOrder ?? 0) + 1,
    },
  });
  return { sector: created };
}

/** @summary Renombra, reordena o activa/desactiva un sector conservando sus mesas. */
export async function updateTableSector(
  context: AuthorizationContext,
  sectorId: number,
  input: { name?: string; sortOrder?: number; active?: boolean },
) {
  const current = await prisma.tableSector.findFirst({ where: { id: sectorId, tenantId: context.tenant.id } });
  if (!current) throw new TableServiceError("Sector no encontrado", 404);
  if (!accessibleBranch(context, current.branchId)) {
    throw new TableServiceError("No tenés acceso a la sucursal de este sector", 403);
  }
  const data: Prisma.TableSectorUpdateInput = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new TableServiceError("Escribí el nombre del sector", 400);
    const existing = await prisma.tableSector.findFirst({
      where: { tenantId: context.tenant.id, branchId: current.branchId, name, id: { not: sectorId } },
      select: { id: true },
    });
    if (existing) throw new TableServiceError("Ya existe un sector con ese nombre en esta sucursal", 409);
    data.name = name;
    await prisma.diningTable.updateMany({
      where: { tenantId: context.tenant.id, sectorId },
      data: { sector: name },
    });
  }
  if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
  if (input.active !== undefined) data.active = input.active;
  const updated = await prisma.tableSector.update({ where: { id: sectorId }, data });
  return { sector: updated };
}

/** @summary Elimina un sector desvinculando sus mesas (el nombre histórico se conserva). */
export async function deleteTableSector(context: AuthorizationContext, sectorId: number) {
  const current = await prisma.tableSector.findFirst({ where: { id: sectorId, tenantId: context.tenant.id } });
  if (!current) throw new TableServiceError("Sector no encontrado", 404);
  if (!accessibleBranch(context, current.branchId)) {
    throw new TableServiceError("No tenés acceso a la sucursal de este sector", 403);
  }
  await prisma.$transaction([
    prisma.diningTable.updateMany({
      where: { tenantId: context.tenant.id, sectorId },
      data: { sectorId: null },
    }),
    prisma.tableSector.delete({ where: { id: sectorId } }),
  ]);
  return { ok: true };
}

export { tableSessionStatuses };
