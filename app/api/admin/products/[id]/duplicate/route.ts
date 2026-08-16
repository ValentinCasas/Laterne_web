import { NextResponse } from "next/server";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { branchProductWhere } from "@/lib/branch";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { duplicateProduct } from "@/lib/product-catalog";

/**
 * @summary Duplica un producto de forma segura.
 *
 * Copia la configuración completa (categorías, modificadores, combo, receta,
 * precios por canal y sucursales) pero crea la copia en borrador y con stock en
 * cero para que cada local administre su propio inventario.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("product.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Producto inválido" }, { status: 404 });

  try {
    const existing = await prisma.product.findFirst({
      where: { ...branchProductWhere(auth.tenant.id, auth.activeBranchId), id },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });

    const copy = await duplicateProduct(auth.tenant.id, id);
    await recordAudit({
      context: auth,
      action: "duplicate",
      entityType: "productos",
      entityId: copy.id,
      newValues: toAuditValue(serialize({ sourceId: id, name: copy.name, slug: copy.slug })),
      request,
    });
    return NextResponse.json({ item: serialize(copy) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo duplicar el producto" },
      { status: 400 },
    );
  }
}
