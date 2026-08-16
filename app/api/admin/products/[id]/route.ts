import { NextResponse } from "next/server";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { branchProductWhere } from "@/lib/branch";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { applyProductWrite, productWriteData, removeProductEntirely, removeProductFromBranch } from "@/lib/product-catalog";
import { loadProductDetail } from "@/lib/product-catalog-data";

/**
 * @summary Detalle, edición y baja de un producto del catálogo.
 *
 * GET devuelve la estructura completa para el editor guiado. PUT reemplaza la
 * configuración del producto dentro de una transacción. DELETE, con sucursal
 * activa, quita la publicación en esa sucursal; sin sucursal activa elimina el
 * producto maestro y sus relaciones (falla si está protegido por pedidos).
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("product.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Producto inválido" }, { status: 404 });

  const detail = await loadProductDetail(auth, id);
  if (!detail) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  return NextResponse.json({ product: serialize(detail) });
}

/** @summary Actualiza un producto conservando su estructura completa. */
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
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

    const body = (await request.json()) as Record<string, unknown>;
    const published = body.status === "published" || body.status === "scheduled";
    const write = await productWriteData(body as never, auth.tenant.id, auth.activeBranchId, {
      excludeId: id,
      requirePrice: published,
    });
    const oldItem = await prisma.product.findUnique({ where: { id }, select: { name: true, status: true } });

    await prisma.$transaction((transaction) => applyProductWrite(transaction, auth.tenant.id, id, write));
    const item = await prisma.product.findUniqueOrThrow({ where: { id } });

    await recordAudit({
      context: auth,
      action: "update",
      entityType: "productos",
      entityId: id,
      oldValues: toAuditValue(serialize(oldItem)),
      newValues: toAuditValue(serialize(item)),
      request,
    });
    return NextResponse.json({ item: serialize(item) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo actualizar el producto" },
      { status: 400 },
    );
  }
}

/** @summary Elimina la publicación (sucursal activa) o el producto maestro completo. */
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("product.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Producto inválido" }, { status: 404 });

  try {
    const oldItem = await prisma.product.findFirst({
      where: { ...branchProductWhere(auth.tenant.id, auth.activeBranchId), id },
      select: { name: true, status: true },
    });
    if (!oldItem) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });

    if (auth.activeBranchId && auth.activeBranchId > 0) {
      await removeProductFromBranch(auth.tenant.id, id, auth.activeBranchId);
    } else {
      await removeProductEntirely(auth.tenant.id, id);
    }

    await recordAudit({
      context: auth,
      action: "delete",
      entityType: "productos",
      entityId: id,
      oldValues: toAuditValue(serialize(oldItem)),
      request,
    });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json(
      { error: "No se pudo eliminar el producto. Puede que tenga pedidos asociados." },
      { status: 409 },
    );
  }
}
