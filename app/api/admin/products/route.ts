import { NextResponse } from "next/server";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { applyProductWrite, productWriteData } from "@/lib/product-catalog";
import { loadProductCatalogData } from "@/lib/product-catalog-data";
import { ensureTenantCapacity } from "@/lib/tenant-limits";

/**
 * @summary Endpoint del catálogo de productos: listado con opciones y alta completa.
 *
 * GET devuelve el payload del listado (productos, categorías, sucursales,
 * estaciones y productos para combos/recetas). POST crea un producto maestro con
 * toda su estructura (precios por canal, modificadores, combo, receta y
 * disponibilidad por sucursal) validando tenant y alcance de sucursal.
 */
export async function GET() {
  const auth = await authorize("product.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const payload = await loadProductCatalogData(auth);
  return NextResponse.json({ payload: serialize(payload) });
}

/** @summary Crea un producto con su estructura completa dentro de una transacción. */
export async function POST(request: Request) {
  const auth = await authorize("product.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  try {
    const body = (await request.json()) as Record<string, unknown>;
    await ensureTenantCapacity(auth.tenant.id, "products");
    const published = body.status === "published" || body.status === "scheduled";
    const write = await productWriteData(body as never, auth.tenant.id, auth.activeBranchId, {
      requirePrice: published,
    });

    const item = await prisma.$transaction(async (transaction) => {
      const product = await transaction.product.create({
        data: { ...write.base, tenantId: auth.tenant.id } as never,
      });
      await applyProductWrite(transaction, auth.tenant.id, product.id, write);
      return product;
    });

    await recordAudit({
      context: auth,
      action: "create",
      entityType: "productos",
      entityId: item.id,
      newValues: toAuditValue(serialize(item)),
      request,
    });
    return NextResponse.json({ item: serialize(item) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo crear el producto" },
      { status: 400 },
    );
  }
}
