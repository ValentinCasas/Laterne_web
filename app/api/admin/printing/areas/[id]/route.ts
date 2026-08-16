import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize, canAccessBranch } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const areaUpdate = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  active: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  /** Reemplaza las asociaciones de productos del área. */
  productIds: z.array(z.coerce.number().int().positive()).optional(),
  /** Reemplaza las asociaciones de categorías del área. */
  categoryIds: z.array(z.coerce.number().int().positive()).optional(),
});

/** @summary Actualiza un área de impresión y sus asociaciones verificando tenant y sucursal. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("order.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  const parsed = areaUpdate.safeParse(await request.json().catch(() => null));
  if (!Number.isInteger(id) || !parsed.success) {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
  const current = await prisma.printArea.findFirst({
    where: { id, tenantId: auth.tenant.id },
    include: { products: true, categories: true },
  });
  if (!current) return NextResponse.json({ error: "Área no encontrada" }, { status: 404 });
  if (!canAccessBranch(auth, current.branchId)) {
    return NextResponse.json({ error: "No tenés acceso a la sucursal de esta área" }, { status: 403 });
  }
  const data: { name?: string; active?: boolean; sortOrder?: number } = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name.trim();
  if (parsed.data.active !== undefined) data.active = parsed.data.active;
  if (parsed.data.sortOrder !== undefined) data.sortOrder = parsed.data.sortOrder;
  if (data.name && data.name !== current.name) {
    const collision = await prisma.printArea.findFirst({
      where: { tenantId: auth.tenant.id, branchId: current.branchId, name: data.name, id: { not: id } },
    });
    if (collision) return NextResponse.json({ error: "Ya existe un área con ese nombre" }, { status: 409 });
  }

  // Solo se reemplazan las asociaciones cuando el formulario las envía.
  const productIds = parsed.data.productIds ? [...new Set(parsed.data.productIds)] : null;
  const categoryIds = parsed.data.categoryIds ? [...new Set(parsed.data.categoryIds)] : null;
  if (productIds && productIds.length) {
    const owned = await prisma.product.count({
      where: { id: { in: productIds }, tenantId: auth.tenant.id },
    });
    if (owned !== productIds.length) {
      return NextResponse.json({ error: "Algunos productos no pertenecen a este negocio" }, { status: 400 });
    }
  }
  if (categoryIds && categoryIds.length) {
    const owned = await prisma.category.count({
      where: { id: { in: categoryIds }, tenantId: auth.tenant.id },
    });
    if (owned !== categoryIds.length) {
      return NextResponse.json({ error: "Algunas categorías no pertenecen a este negocio" }, { status: 400 });
    }
  }

  const area = await prisma.$transaction(async (transaction) => {
    const updated = await transaction.printArea.update({ where: { id }, data });
    if (productIds) {
      await transaction.printAreaProduct.deleteMany({ where: { areaId: id, tenantId: auth.tenant.id } });
      if (productIds.length) {
        await transaction.printAreaProduct.createMany({
          data: productIds.map((productId) => ({ tenantId: auth.tenant.id, areaId: id, productId })),
        });
      }
    }
    if (categoryIds) {
      await transaction.printAreaCategory.deleteMany({ where: { areaId: id, tenantId: auth.tenant.id } });
      if (categoryIds.length) {
        await transaction.printAreaCategory.createMany({
          data: categoryIds.map((categoryId) => ({ tenantId: auth.tenant.id, areaId: id, categoryId })),
        });
      }
    }
    return updated;
  });
  await recordAudit({
    context: auth,
    action: "print-area.update",
    entityType: "print-area",
    entityId: id,
    oldValues: toAuditValue(serialize(current)),
    newValues: toAuditValue(serialize(area)),
    request,
  });
  return NextResponse.json({ area: serialize(area) });
}

/** @summary Elimina un área de impresión; las asociaciones y trabajos se limpian en cascada. */
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("order.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  const current = await prisma.printArea.findFirst({
    where: { id, tenantId: auth.tenant.id },
    include: { products: true, categories: true, destinations: true },
  });
  if (!current) return NextResponse.json({ error: "Área no encontrada" }, { status: 404 });
  if (!canAccessBranch(auth, current.branchId)) {
    return NextResponse.json({ error: "No tenés acceso a la sucursal de esta área" }, { status: 403 });
  }
  if (current.destinations.length > 0) {
    return NextResponse.json(
      { error: "Desvinculá las impresoras de esta área antes de eliminarla" },
      { status: 409 },
    );
  }
  await prisma.printArea.delete({ where: { id } });
  await recordAudit({
    context: auth,
    action: "print-area.delete",
    entityType: "print-area",
    entityId: id,
    oldValues: toAuditValue(serialize(current)),
    request,
  });
  return new NextResponse(null, { status: 204 });
}
