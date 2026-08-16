import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { loadRecipeEditorData } from "@/lib/recipe-data";
import { saveRecipeLines } from "@/lib/recipes";

/**
 * @summary Detalle y guardado de la receta de un producto.
 *
 * GET devuelve el payload del editor visual (líneas, costo en vivo, candidatos
 * y alertas de receta incompleta). PUT reemplaza las líneas validando tenant y
 * que no se generen ciclos de subrecetas.
 */

const saveInput = z.object({
  lines: z
    .array(
      z.object({
        ingredientProductId: z.coerce.number().int().positive(),
        quantity: z.coerce.number().min(0.001).max(9999),
        unit: z.string().trim().min(1).max(40),
        yieldPercent: z.coerce.number().min(0.001).max(999).default(100),
      }),
    )
    .max(200),
});

/** @summary Detalle de la receta para el editor. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("product.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Producto inválido" }, { status: 404 });

  const payload = await loadRecipeEditorData(auth, id);
  if (!payload) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  return NextResponse.json({ payload: serialize(payload) });
}

/** @summary Reemplaza la receta del producto validando tenant y ciclos de subrecetas. */
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("product.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Producto inválido" }, { status: 404 });

  const parsed = saveInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisá las líneas de la receta" }, { status: 400 });

  try {
    const product = await prisma.product.findFirst({
      where: { id, tenantId: auth.tenant.id },
      select: { id: true, name: true },
    });
    if (!product) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });

    const lines = parsed.data.lines.map((line) => ({
      ingredientProductId: line.ingredientProductId,
      quantity: line.quantity,
      unit: line.unit,
      yieldPercent: line.yieldPercent,
    }));

    await prisma.$transaction((transaction) =>
      saveRecipeLines(transaction, { tenantId: auth.tenant.id, productId: id, lines }),
    );

    await recordAudit({
      context: auth,
      action: "recipe.update",
      entityType: "recetas",
      entityId: id,
      newValues: toAuditValue({ productId: id, lines }),
      request,
    });
    const payload = await loadRecipeEditorData(auth, id);
    return NextResponse.json({ payload: serialize(payload) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo guardar la receta" },
      { status: 400 },
    );
  }
}
