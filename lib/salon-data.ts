import type { AuthorizationContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Carga los datos del salón para el contexto de tenant/sucursal autorizado.
 *
 * Devuelve un payload JSON-safe (números y fechas ya convertidos) para alimentar
 * tanto el render inicial del panel como el refresco del tablero desde el cliente.
 */

export type SalonOrderItem = {
  id: number;
  productName: string;
  quantity: number;
  variantName: string | null;
  extras: unknown;
  extrasTotal: number;
  notes: string | null;
  lineTotal: number;
};

export type SalonOrder = {
  id: number;
  reference: string;
  status: string;
  customerName: string;
  createdAt: string;
  subtotal: number;
  discount: number;
  deliveryFee: number;
  tip: number;
  total: number;
  currency: string;
  paymentStatus: string;
  source: string;
  invoice: { id: number; number: string | null; status: string } | null;
  items: SalonOrderItem[];
  history: Array<{ fromStatus: string | null; toStatus: string; note: string | null; createdAt: string }>;
};

export type SalonEvent = {
  id: number;
  eventType: string;
  note: string | null;
  createdAt: string;
  userName: string | null;
};

export type SalonSession = {
  id: number;
  status: string;
  customerName: string | null;
  phone: string | null;
  partySize: number;
  notes: string | null;
  openedAt: string;
  waiter: { id: number; name: string } | null;
  orders: SalonOrder[];
  events: SalonEvent[];
  totals: { itemCount: number; subtotal: number; total: number; openItemCount: number };
};

export type SalonTable = {
  id: number;
  code: string;
  name: string;
  sector: string | null;
  sectorId: number | null;
  capacity: number;
  active: boolean;
  branchId: number | null;
  positionX: number | null;
  positionY: number | null;
  session: SalonSession | null;
};

export type SalonProduct = {
  id: number;
  name: string;
  price: number;
  promotionalPrice: number | null;
  availability: string | null;
  imageUrl: string;
  branchIds: number[];
  variants: Array<{ id: number; name: string; priceAdjustment: number; groupId: number | null }>;
  extras: Array<{ id: number; name: string; price: number; groupId: number | null }>;
  optionGroups: Array<{
    id: number;
    name: string;
    kind: string;
    required: boolean;
    minSelections: number;
    maxSelections: number;
    variantIds: number[];
    extraIds: number[];
  }>;
};

export type SalonPayload = {
  tables: SalonTable[];
  sectors: Array<{ id: number; branchId: number; name: string; sortOrder: number; active: boolean }>;
  waiters: Array<{ id: number; name: string }>;
  products: SalonProduct[];
  currency: string;
  activeBranch: { id: number; name: string; slug: string } | null;
  branches: Array<{ id: number; name: string }>;
  tenantName: string;
};

/** @summary Convierte una orden de Prisma en la forma JSON-safe que consume el tablero. */
function mapOrder(
  order: {
    id: number;
    reference: string;
    status: string;
    customerName: string;
    createdAt: Date;
    subtotal: { toString(): string };
    discount: { toString(): string };
    deliveryFee: { toString(): string };
    tip: { toString(): string };
    total: { toString(): string };
    currency: string;
    paymentStatus: string;
    source: string;
    invoice: { id: number; number: string | null; status: string } | null;
    items: Array<{
      id: number;
      productName: string;
      quantity: number;
      variantName: string | null;
      extras: unknown;
      extrasTotal: { toString(): string };
      notes: string | null;
      lineTotal: { toString(): string };
    }>;
    history: Array<{
      fromStatus: string | null;
      toStatus: string;
      note: string | null;
      createdAt: Date;
    }>;
  },
): SalonOrder {
  return {
    id: order.id,
    reference: order.reference,
    status: order.status,
    customerName: order.customerName,
    createdAt: order.createdAt.toISOString(),
    subtotal: Number(order.subtotal),
    discount: Number(order.discount),
    deliveryFee: Number(order.deliveryFee),
    tip: Number(order.tip),
    total: Number(order.total),
    currency: order.currency,
    paymentStatus: order.paymentStatus,
    source: order.source,
    invoice: order.invoice,
    items: order.items.map((item) => ({
      id: item.id,
      productName: item.productName,
      quantity: item.quantity,
      variantName: item.variantName,
      extras: item.extras,
      extrasTotal: Number(item.extrasTotal),
      notes: item.notes,
      lineTotal: Number(item.lineTotal),
    })),
    history: order.history.map((entry) => ({
      fromStatus: entry.fromStatus,
      toStatus: entry.toStatus,
      note: entry.note,
      createdAt: entry.createdAt.toISOString(),
    })),
  };
}

/** @summary Arma el payload completo del salón respetando el aislamiento tenant/sucursal. */
export async function loadSalonData(context: AuthorizationContext): Promise<SalonPayload> {
  const activeId = context.activeBranchId && context.activeBranchId > 0 ? context.activeBranchId : null;
  const branchIds = context.branches.map((branch) => branch.id);
  const branchScope = activeId ? { branchId: activeId } : { branchId: { in: branchIds } };

  const [tables, sectors, waiters, tenant, activeBranch] = await Promise.all([
    prisma.diningTable.findMany({
      where: { tenantId: context.tenant.id, active: true, ...branchScope },
      include: {
        sessions: {
          where: { closedAt: null },
          orderBy: { openedAt: "desc" },
          take: 1,
          include: {
            waiter: { select: { id: true, name: true } },
            orders: {
              orderBy: { createdAt: "asc" },
              include: {
                items: true,
                history: { orderBy: { createdAt: "asc" } },
                invoice: { select: { id: true, number: true, status: true } },
              },
            },
            events: {
              orderBy: { createdAt: "desc" },
              take: 80,
              include: { user: { select: { name: true } } },
            },
          },
        },
      },
      orderBy: [{ sector: "asc" }, { name: "asc" }],
    }),
    prisma.tableSector.findMany({
      where: { tenantId: context.tenant.id, ...branchScope },
      orderBy: [{ branchId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.user.findMany({
      where: { memberships: { some: { tenantId: context.tenant.id, status: "active" } } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.tenant.findUnique({
      where: { id: context.tenant.id },
      select: { defaultCurrency: true, name: true },
    }),
    activeId
      ? prisma.branch.findFirst({
          where: { id: activeId, tenantId: context.tenant.id },
          select: { id: true, name: true, slug: true },
        })
      : Promise.resolve(null),
  ]);

  const products = await prisma.product.findMany({
    where: {
      tenantId: context.tenant.id,
      ...(activeId
        ? { branchAssignments: { some: { branchId: activeId, active: true } } }
        : { branchAssignments: { some: { branchId: { in: branchIds }, active: true } } }),
      OR: [{ status: "published" }, { status: "scheduled", publishAt: { lte: new Date() } }],
    },
    include: {
      branchAssignments: { where: { active: true }, select: { branchId: true } },
      variants: { where: { active: true }, orderBy: { sortOrder: "asc" } },
      extras: { where: { active: true }, orderBy: { sortOrder: "asc" } },
      optionGroups: {
        where: { active: true },
        orderBy: { sortOrder: "asc" },
        include: {
          variants: { where: { active: true } },
          extras: { where: { active: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const tablesPayload: SalonTable[] = tables.map((table) => {
    const session = table.sessions[0] ?? null;
    const orders = session ? session.orders.map(mapOrder) : [];
    const openOrders = orders.filter((order) => !["delivered", "cancelled"].includes(order.status));
    return {
      id: table.id,
      code: table.code,
      name: table.name,
      sector: table.sector,
      sectorId: table.sectorId,
      capacity: table.capacity,
      active: table.active,
      branchId: table.branchId,
      positionX: table.positionX,
      positionY: table.positionY,
      session: session
        ? {
            id: session.id,
            status: session.status,
            customerName: session.customerName,
            phone: session.phone,
            partySize: session.partySize,
            notes: session.notes,
            openedAt: session.openedAt.toISOString(),
            waiter: session.waiter,
            orders,
            events: session.events.map((event) => ({
              id: event.id,
              eventType: event.eventType,
              note: event.note,
              createdAt: event.createdAt.toISOString(),
              userName: event.user?.name ?? null,
            })),
            totals: {
              itemCount: orders.reduce((sum, order) => sum + order.items.reduce((n, item) => n + item.quantity, 0), 0),
              openItemCount: openOrders.reduce(
                (sum, order) => sum + order.items.reduce((n, item) => n + item.quantity, 0),
                0,
              ),
              subtotal: orders.reduce((sum, order) => sum + order.subtotal, 0),
              total: orders.reduce((sum, order) => sum + order.total, 0),
            },
          }
        : null,
    };
  });

  return {
    tables: tablesPayload,
    branches: context.branches
      .filter((branch) => branch.active && branch.status === "active")
      .map((branch) => ({ id: branch.id, name: branch.name })),
    sectors: sectors.map((sector) => ({
      id: sector.id,
      branchId: sector.branchId,
      name: sector.name,
      sortOrder: sector.sortOrder,
      active: sector.active,
    })),
    waiters,
    products: products.map((product) => ({
      id: product.id,
      name: product.name,
      price: Number(product.price ?? 0),
      promotionalPrice: product.promotionalPrice === null ? null : Number(product.promotionalPrice),
      availability: product.availability,
      imageUrl: product.imageUrl,
      branchIds: product.branchAssignments.map((assignment) => assignment.branchId),
      variants: product.variants.map((variant) => ({
        id: variant.id,
        name: variant.name,
        priceAdjustment: Number(variant.priceAdjustment),
        groupId: variant.groupId,
      })),
      extras: product.extras.map((extra) => ({
        id: extra.id,
        name: extra.name,
        price: Number(extra.price),
        groupId: extra.groupId,
      })),
      optionGroups: product.optionGroups.map((group) => ({
        id: group.id,
        name: group.name,
        kind: group.kind,
        required: group.required,
        minSelections: group.minSelections,
        maxSelections: group.maxSelections,
        variantIds: group.variants.map((variant) => variant.id),
        extraIds: group.extras.map((extra) => extra.id),
      })),
    })),
    currency: tenant?.defaultCurrency ?? "ARS",
    activeBranch,
    tenantName: tenant?.name ?? context.tenant.name,
  };
}
