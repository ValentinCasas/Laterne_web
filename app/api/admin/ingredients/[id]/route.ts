import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize, canAccessBranch } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { removeProductEntirely } from "@/lib/product-catalog";
import { recordIngredientCostHistory } from "@/lib/recipes";

/**
 * @summary Actualización y baja de un ingrediente.
 *
 * PATCH ajusta costo (con historial), unidad base y existencias por sucursal.
 * DELETE elimina el producto maestro solo si no se usa en recetas ni pedidos.
 */

const updateInput = z.object({
  cost: z.coerce.number().min(0).max(100_000_000).optional().nullable(),
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
    .optional(),
});

/** @summary Actualiza costo, unidad base y stock del ingrediente dentro de una transacción. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("product.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Ingrediente inválido" }, { status: 404 });

  const parsed = updateInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisá los datos del ingrediente" }, { status: 400 });

  const previous = await prisma.product.findFirst({
    where: { id, tenantId: auth.tenant.id },
    select: { id: true, name: true, cost: true, costUnit: true },
  });
  if (!previous) return NextResponse.json({ error: "Ingrediente no encontrado" }, { status: 404 });

  const stockEntries = parsed.data.stocks ?? [];
  const branchIds = [...new Set(stockEntries.map((entry) => entry.branchId))];
  if (branchIds.length) {
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
  }

  const updated = await prisma.$transaction(async (transaction) => {
    const data: Record<string, unknown> = {};
    if (parsed.data.cost !== undefined) data.cost = parsed.data.cost;
    if (parsed.data.costUnit !== undefined) data.costUnit = parsed.data.costUnit;
    if (Object.keys(data).length) {
      await transaction.product.update({ where: { id }, data });
    }

    // El costo es histórico: solo se registra cuando cambió realmente.
    const saved = await transaction.product.findUniqueOrThrow({
      where: { id },
      select: { cost: true, costUnit: true },
    });
    const oldCost = previous.cost === null || previous.cost === undefined ? null : Number(previous.cost);
    const newCost = saved.cost === null || saved.cost === undefined ? null : Number(saved.cost);
    if (oldCost !== newCost || previous.costUnit !== saved.costUnit) {
      await recordIngredientCostHistory(transaction, {
        tenantId: auth.tenant.id,
        productId: id,
        cost: newCost ?? 0,
        unit: saved.costUnit,
        changedById: auth.session.userId,
        reason: parsed.data.reason || "Ajuste de costo de ingrediente",
      });
    }

    for (const entry of stockEntries) {
      await transaction.inventoryStock.upsert({
        where: { branchId_productId: { branchId: entry.branchId, productId: id } },
        create: {
          tenantId: auth.tenant.id,
          branchId: entry.branchId,
          productId: id,
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
    return transaction.product.findUniqueOrThrow({ where: { id } });
  });

  await recordAudit({
    context: auth,
    action: "ingredient.update",
    entityType: "ingredientes",
    entityId: id,
    oldValues: toAuditValue(serialize(previous)),
    newValues: toAuditValue(serialize(updated)),
    request,
  });
  return NextResponse.json({ item: serialize(updated) });
}

/** @summary Elimina el ingrediente maestro si no se usa en recetas ni pedidos. */
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("product.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Ingrediente inválido" }, { status: 404 });

  try {
    const product = await prisma.product.findFirst({
      where: { id, tenantId: auth.tenant.id },
      select: { id: true, name: true },
    });
    if (!product) return NextResponse.json({ error: "Ingrediente no encontrado" }, { status: 404 });

    const usedIn = await prisma.recipeIngredient.count({ where: { tenantId: auth.tenant.id, ingredientProductId: id } });
    if (usedIn > 0) {
      return NextResponse.json(
        { error: `No se puede eliminar: se usa como ingrediente en ${usedIn} receta${usedIn === 1 ? "" : "s"}` },
        { status: 409 },
      );
    }
    await removeProductEntirely(auth.tenant.id, id);

    await recordAudit({
      context: auth,
      action: "ingredient.delete",
      entityType: "ingredientes",
      entityId: id,
      oldValues: toAuditValue(serialize(product)),
      request,
    });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json(
      { error: "No se pudo eliminar el ingrediente. Puede que tenga pedidos asociados." },
      { status: 409 },
    );
  }
}
