import type { AuthorizationContext } from "@/lib/auth";
import { branchProductWhere, resourceScopedWhere } from "@/lib/branch";
import { prisma } from "@/lib/prisma";

/**
 * Carga la configuración de impresión (áreas, asociaciones, destinos y cola)
 * para el contexto de tenant/sucursal autorizado.
 *
 * Devuelve un payload JSON-safe que alimenta la página de configuración de
 * impresión, marcada como etapa de preparación. El aislamiento multi-sucursal
 * es estructural: áreas y destinos se limitan a las sucursales de la membresía
 * y, si la URL indica una sucursal activa, solo a esa.
 */

export type PrintAreaView = {
  id: number;
  name: string;
  sortOrder: number;
  active: boolean;
  productCount: number;
  categoryCount: number;
  productIds: number[];
  categoryIds: number[];
  productNames: string[];
  categoryNames: string[];
};

export type PrintDestinationView = {
  id: number;
  name: string;
  type: string;
  connection: string | null;
  status: string;
  active: boolean;
  areaName: string | null;
};

export type PrintingPayload = {
  areas: PrintAreaView[];
  destinations: PrintDestinationView[];
  /** Productos disponibles en la sucursal para asociar a un área. */
  products: Array<{ id: number; name: string }>;
  /** Categorías visibles en la sucursal para asociar a un área. */
  categories: Array<{ id: number; name: string }>;
  /** Conteo de comandas en cola por estado conceptual (hoy siempre vacío). */
  jobs: Record<string, number>;
  activeBranch: { id: number; name: string; slug: string } | null;
  branches: Array<{ id: number; name: string }>;
  tenantName: string;
};

/** @summary Arma el payload completo de la configuración de impresión del contexto actual. */
export async function loadPrintingData(context: AuthorizationContext): Promise<PrintingPayload> {
  const activeId = context.activeBranchId && context.activeBranchId > 0 ? context.activeBranchId : null;
  const branchIds = context.branches.map((branch) => branch.id);
  const branchScope = activeId ? { branchId: activeId } : { branchId: { in: branchIds } };

  const [areas, destinations, products, categories, jobGroups, tenant, activeBranch] = await Promise.all([
    prisma.printArea.findMany({
      where: { tenantId: context.tenant.id, ...branchScope },
      include: {
        products: { select: { productId: true, product: { select: { name: true } } } },
        categories: { select: { categoryId: true, category: { select: { name: true } } } },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.printDestination.findMany({
      where: { tenantId: context.tenant.id, ...branchScope },
      include: { area: { select: { name: true } } },
      orderBy: [{ name: "asc" }],
    }),
    prisma.product.findMany({
      where: { ...branchProductWhere(context.tenant.id, activeId), OR: [{ status: "published" }, { status: "hidden" }] },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
    prisma.category.findMany({
      where: resourceScopedWhere("category", context.tenant.id, activeId),
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.printJob.groupBy({
      by: ["status"],
      where: { tenantId: context.tenant.id, ...branchScope },
      _count: { _all: true },
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

  const jobs: Record<string, number> = {};
  for (const group of jobGroups) jobs[group.status] = group._count._all;

  return {
    areas: areas.map((area) => ({
      id: area.id,
      name: area.name,
      sortOrder: area.sortOrder,
      active: area.active,
      productCount: area.products.length,
      categoryCount: area.categories.length,
      productIds: area.products.map((item) => item.productId),
      categoryIds: area.categories.map((item) => item.categoryId),
      productNames: area.products.map((item) => item.product.name),
      categoryNames: area.categories.map((item) => item.category.name),
    })),
    destinations: destinations.map((destination) => ({
      id: destination.id,
      name: destination.name,
      type: destination.type,
      connection: destination.connection,
      status: destination.status,
      active: destination.active,
      areaName: destination.area?.name ?? null,
    })),
    products,
    categories,
    jobs,
    activeBranch,
    branches: context.branches
      .filter((branch) => branch.active && branch.status === "active")
      .map((branch) => ({ id: branch.id, name: branch.name })),
    tenantName: tenant?.name ?? context.tenant.name,
  };
}
