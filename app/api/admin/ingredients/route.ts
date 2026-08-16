import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize, canAccessBranch } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { recordIngredientCostHistory } from "@/lib/recipes";
import { uniqueProductSlug } from "@/lib/slug";
import { ensureTenantCapacity } from "@/lib/tenant-limits";

/**
 * @summary Ingredientes: listado con costo, stock por sucursal e historial.
 *
 * Un ingrediente es un producto real del catálogo con costo y/o control de
 * inventario. GET lista los candidatos; POST crea uno simple (costo, unidad
 * base y stock inicial por sucursal) sin pasar por el editor completo de carta.
 */

const createInput = z.object({
  name: z.string().trim().min(2).max(255),
  cost: z.coerce.number().min(0).max(100_000_000).optional(),
  costUnit: z.string().trim().min(1).max(40).optional(),
  reason: z.string().trim().max(300).optional(),
  stocks: z
    .array(
      z.object({
        branchId: z.coerce.number().int().positive(),
        current: z.coerce.number().min(0).max(100_000_000),
        minimum: z.coerce.number().min(0).max(100_000_000),
        tracked: z.boolean(),
        unit: z.string().trim().min(1).max(40).default("unidad"),
      }),
    )
    .max(100)
    .default([]),
});

/** @summary Lista los productos que se comportan como ingredientes (costo, stock o uso en recetas). */
export async function GET() {
  const auth = await authorize("product.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const [products, branches, tenant] = await Promise.all([
    prisma.product.findMany({
      where: { tenantId: auth.tenant.id, status: { not: "archived" } },
      select: {
        id: true,
        name: true,
        cost: true,
        costUnit: true,
        status: true,
        recipeItems: { select: { id: true } },
        _count: { select: { usedInRecipes: true } },
        inventoryStocks: {
          include: { branch: { select: { id: true, name: true } } },
        },
        costHistory: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { name: "asc" },
    }),
    prisma.branch.findMany({
      where: { id: { in: auth.branches.map((branch) => branch.id) } },
      select: { id: true, name: true },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
    prisma.tenant.findUnique({ where: { id: auth.tenant.id }, select: { defaultCurrency: true } }),
  ]);

  const ingredientIds = new Set(
    products
      .filter(
        (product) =>
          product.cost !== null ||
          product.recipeItems.length > 0 ||
          product._count.usedInRecipes > 0 ||
          product.inventoryStocks.some((stock) => stock.tracked),
      )
      .map((product) => product.id),
  );

  const rows = products
    .filter((product) => ingredientIds.has(product.id))
    .map((product) => {
      const lastCost = product.costHistory[0] ?? null;
      return {
        id: product.id,
        name: product.name,
        cost: product.cost === null || product.cost === undefined ? null : String(Number(product.cost)),
        costUnit: product.costUnit,
        status: product.status,
        hasRecipe: product.recipeItems.length > 0,
        usedInCount: product._count.usedInRecipes,
        stocks: product.inventoryStocks
          .filter((stock) => branches.some((branch) => branch.id === stock.branchId))
          .map((stock) => ({
            branchId: stock.branchId,
            branchName: stock.branch.name,
            current: String(Number(stock.current)),
            minimum: String(Number(stock.minimum)),
            tracked: stock.tracked,
            unit: stock.unit,
          })),
        lastCost: lastCost
          ? {
              cost: String(Number(lastCost.cost)),
              unit: lastCost.unit,
              reason: lastCost.reason,
              createdAt: lastCost.createdAt.toISOString(),
            }
          : null,
      };
    });

  return NextResponse.json({
    payload: serialize({
      ingredients: rows,
      branches: branches.map((branch) => ({ id: branch.id, name: branch.name })),
      currency: tenant?.defaultCurrency ?? "ARS",
    }),
  });
}

/** @summary Crea un ingrediente simple con costo, unidad base y stock por sucursal. */
export async function POST(request: Request) {
  const auth = await authorize("product.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const parsed = createInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisá los datos del ingrediente" }, { status: 400 });

  try {
    await ensureTenantCapacity(auth.tenant.id, "products");
    const name = parsed.data.name;
    const cost = parsed.data.cost ?? null;
    const costUnit = parsed.data.costUnit || "unidad";
    const stockEntries = parsed.data.stocks;

    // Las sucursales del stock deben pertenecer al tenant y al acceso de la sesión.
    const branchIds = [...new Set(stockEntries.map((entry) => entry.branchId))];
    const validBranches = await prisma.branch.findMany({
      where: { id: { in: branchIds }, tenantId: auth.tenant.id },
      select: { id: true },
    });
    if (validBranches.length !== branchIds.length) {
      return NextResponse.json({ error: "Alguna sucursal no pertenece al negocio" }, { status: 400 });
    }
    for (const branchId of branchIds) {
      if (!canAccessBranch(auth, branchId)) {
        return NextResponse.json({ error: "No tenés acceso a una de las sucursales" }, { status: 403 });
      }
    }

    const item = await prisma.$transaction(async (transaction) => {
      const product = await transaction.product.create({
        data: {
          tenantId: auth.tenant.id,
          name,
          slug: await uniqueProductSlug(auth.tenant.id, name),
          description: name,
          status: "draft",
          availability: "disponible",
          imageUrl: "",
          cost,
          costUnit,
        },
      });
      if (cost !== null) {
        await recordIngredientCostHistory(transaction, {
          tenantId: auth.tenant.id,
          productId: product.id,
          cost,
          unit: costUnit,
          changedById: auth.session.userId,
          reason: parsed.data.reason || "Alta de ingrediente",
        });
      }
      for (const entry of stockEntries) {
        await transaction.inventoryStock.upsert({
          where: { branchId_productId: { branchId: entry.branchId, productId: product.id } },
          create: {
            tenantId: auth.tenant.id,
            branchId: entry.branchId,
            productId: product.id,
            tracked: entry.tracked,
            current: entry.current,
            minimum: entry.minimum,
            unit: entry.unit,
          },
          update: {
            tracked: entry.tracked,
            current: entry.current,
            minimum: entry.minimum,
            unit: entry.unit,
          },
        });
      }
      return product;
    });

    await recordAudit({
      context: auth,
      action: "ingredient.create",
      entityType: "ingredientes",
      entityId: item.id,
      newValues: toAuditValue(serialize(item)),
      request,
    });
    return NextResponse.json({ item: serialize(item) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo crear el ingrediente" },
      { status: 400 },
    );
  }
}
