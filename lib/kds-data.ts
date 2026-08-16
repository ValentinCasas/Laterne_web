import type { AuthorizationContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Carga los datos del monitor de cocina (KDS) para el contexto de tenant/sucursal
 * autorizado.
 *
 * Devuelve un payload JSON-safe (números y fechas ya convertidos) que alimenta
 * tanto el render inicial del panel como el refresco por polling desde el cliente.
 * El aislamiento multi-sucursal es estructural: la consulta se limita siempre a
 * las sucursales de la membresía y, si la URL indica una sucursal activa, solo a esa.
 */

/** Estados que el monitor de cocina considera activos (se muestran en columnas). */
const ACTIVE_STATUSES = ["received", "confirmed", "preparing", "ready"] as const;

export type KdsOrderItem = {
  id: number;
  productId: number | null;
  productName: string;
  quantity: number;
  variantName: string | null;
  extras: unknown;
  notes: string | null;
  /** Estación de preparación resuelta desde el producto en el momento del ruteo. */
  stationName: string | null;
};

export type KdsOrderHistory = {
  id: number;
  fromStatus: string | null;
  toStatus: string;
  note: string | null;
  createdAt: string;
  userName: string | null;
};

export type KdsOrder = {
  id: number;
  reference: string;
  status: string;
  orderType: string;
  source: string;
  customerName: string;
  phone: string;
  notes: string | null;
  createdAt: string;
  requestedAt: string | null;
  table: { id: number; name: string; code: string; sectorId: number | null; sector: string | null } | null;
  waiterName: string | null;
  items: KdsOrderItem[];
  history: KdsOrderHistory[];
};

export type KdsStation = {
  id: number;
  name: string;
  type: string;
  active: boolean;
  sortOrder: number;
  branchId: number;
  productCount: number;
};

export type KdsPayload = {
  orders: KdsOrder[];
  stations: KdsStation[];
  /** Sectores del salón presentes en los pedidos cargados, para el filtro. */
  sectors: string[];
  /** Orígenes de los pedidos (website, admin, etc.) para el filtro. */
  sources: string[];
  currency: string;
  activeBranch: { id: number; name: string; slug: string } | null;
  branches: Array<{ id: number; name: string }>;
  tenantName: string;
};

/** @summary Resuelve la estación de un ítem a partir del id de su producto. */
function stationNameFor(
  stationId: number | null | undefined,
  stationById: Map<number, KdsStation>,
): string | null {
  if (stationId === null || stationId === undefined) return null;
  return stationById.get(stationId)?.name ?? null;
}

/** @summary Arma el payload completo del monitor de cocina respetando tenant y sucursal. */
export async function loadKdsData(context: AuthorizationContext): Promise<KdsPayload> {
  const activeId = context.activeBranchId && context.activeBranchId > 0 ? context.activeBranchId : null;
  const branchIds = context.branches.map((branch) => branch.id);
  const branchScope = activeId ? { branchId: activeId } : { branchId: { in: branchIds } };
  // Los entregados se conservan solo un día para no llenar la columna de cierre.
  const deliveredSince = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [orders, stations, tenant, activeBranch] = await Promise.all([
    prisma.customerOrder.findMany({
      where: {
        tenantId: context.tenant.id,
        ...branchScope,
        OR: [
          { status: { in: [...ACTIVE_STATUSES] } },
          { status: "delivered", createdAt: { gte: deliveredSince } },
        ],
      },
      include: {
        table: { select: { id: true, name: true, code: true, sectorId: true, sector: true } },
        tableSession: { select: { waiter: { select: { name: true } } } },
        items: {
          select: {
            id: true,
            productId: true,
            productName: true,
            quantity: true,
            variantName: true,
            extras: true,
            notes: true,
            product: { select: { stationId: true } },
          },
        },
        history: {
          select: {
            id: true,
            userId: true,
            fromStatus: true,
            toStatus: true,
            note: true,
            createdAt: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 300,
    }),
    prisma.kitchenStation.findMany({
      where: { tenantId: context.tenant.id, ...branchScope },
      include: { _count: { select: { products: true } } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
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

  const stationById = new Map(
    stations.map((station) => [
      station.id,
      {
        id: station.id,
        name: station.name,
        type: station.type,
        active: station.active,
        sortOrder: station.sortOrder,
        branchId: station.branchId,
        productCount: station._count.products,
      },
    ]),
  );

  // El historial guarda el id de usuario; se resuelven los nombres en una sola
  // consulta adicional para no acoplar el modelo a relaciones nuevas.
  const userIds = new Set<number>();
  for (const order of orders) {
    for (const entry of order.history) {
      if (entry.userId) userIds.add(entry.userId);
    }
  }
  const historyUsers = userIds.size
    ? await prisma.user.findMany({
        where: { id: { in: [...userIds] } },
        select: { id: true, name: true },
      })
    : [];
  const userById = new Map(historyUsers.map((user) => [user.id, user.name]));

  const ordersPayload: KdsOrder[] = orders.map((order) => ({
    id: order.id,
    reference: order.reference,
    status: order.status,
    orderType: order.orderType,
    source: order.source,
    customerName: order.customerName,
    phone: order.phone,
    notes: order.notes,
    createdAt: order.createdAt.toISOString(),
    requestedAt: order.requestedAt ? order.requestedAt.toISOString() : null,
    table: order.table
      ? {
          id: order.table.id,
          name: order.table.name,
          code: order.table.code,
          sectorId: order.table.sectorId,
          sector: order.table.sector,
        }
      : null,
    waiterName: order.tableSession?.waiter?.name ?? null,
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      variantName: item.variantName,
      extras: item.extras,
      notes: item.notes,
      stationName: stationNameFor(item.product?.stationId, stationById),
    })),
    history: order.history.map((entry) => ({
      id: entry.id,
      fromStatus: entry.fromStatus,
      toStatus: entry.toStatus,
      note: entry.note,
      createdAt: entry.createdAt.toISOString(),
      userName: entry.userId ? (userById.get(entry.userId) ?? null) : null,
    })),
  }));

  const sectorNames = new Set<string>();
  const sources = new Set<string>();
  for (const order of ordersPayload) {
    const sector = order.table?.sector?.trim();
    if (sector) sectorNames.add(sector);
    if (order.source) sources.add(order.source);
  }

  return {
    orders: ordersPayload,
    stations: [...stationById.values()],
    sectors: [...sectorNames].sort((left, right) => left.localeCompare(right, "es")),
    sources: [...sources].sort((left, right) => left.localeCompare(right, "es")),
    currency: tenant?.defaultCurrency ?? "ARS",
    activeBranch,
    branches: context.branches
      .filter((branch) => branch.active && branch.status === "active")
      .map((branch) => ({ id: branch.id, name: branch.name })),
    tenantName: tenant?.name ?? context.tenant.name,
  };
}
