import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { ensureBranchCategory, ensureBranchProduct } from "@/lib/branch";
import { prisma } from "@/lib/prisma";

const copyInput = z.object({
  sourceBranchId: z.coerce.number().int().positive().optional(),
});

/** @summary Copia categorías, publicaciones y existencias de la carta de una sucursal a otra. */
export async function POST(
  request: Request,
  context: { params: Promise<{ branchId: string }> },
) {
  const { branchId } = await context.params;
  const targetBranchId = Number(branchId);
  if (!Number.isInteger(targetBranchId) || targetBranchId <= 0) {
    return NextResponse.json({ error: "Sucursal inválida" }, { status: 400 });
  }
  const auth = await authorize("product.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  if (!auth.branches.some((branch) => branch.id === targetBranchId)) {
    return NextResponse.json({ error: "No tenés acceso a esa sucursal" }, { status: 403 });
  }
  const parsed = copyInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const sourceBranchId =
    parsed.data.sourceBranchId ??
    (
      await prisma.branch.findFirst({
        where: { tenantId: auth.tenant.id, active: true },
        orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
        select: { id: true },
      })
    )?.id;
  if (!sourceBranchId) {
    return NextResponse.json({ error: "No hay sucursal de origen disponible" }, { status: 409 });
  }
  if (sourceBranchId === targetBranchId) {
    return NextResponse.json({ error: "La sucursal de origen y destino deben ser distintas" }, { status: 400 });
  }

  const [categories, assignments, stocks] = await Promise.all([
    prisma.category.findMany({
      where: { tenantId: auth.tenant.id, branchId: sourceBranchId },
      orderBy: { id: "asc" },
    }),
    prisma.branchProduct.findMany({
      where: { tenantId: auth.tenant.id, branchId: sourceBranchId },
      orderBy: { id: "asc" },
    }),
    prisma.inventoryStock.findMany({
      where: { tenantId: auth.tenant.id, branchId: sourceBranchId },
    }),
  ]);

  const targetCategories = new Map<number, number>();
  for (const category of categories) {
    const created = await ensureBranchCategory(
      auth.tenant.id,
      targetBranchId,
      category.name,
      category.description,
      category.imageUrl,
    );
    targetCategories.set(category.id, created.id);
  }

  for (const assignment of assignments) {
    await ensureBranchProduct(auth.tenant.id, targetBranchId, assignment.productId);
  }

  for (const stock of stocks) {
    await prisma.inventoryStock.upsert({
      where: { branchId_productId: { branchId: targetBranchId, productId: stock.productId } },
      create: {
        tenantId: auth.tenant.id,
        branchId: targetBranchId,
        productId: stock.productId,
        tracked: stock.tracked,
        current: stock.current,
        minimum: stock.minimum,
        unit: stock.unit,
      },
      update: {},
    });
  }

  const links = await prisma.productCategory.findMany({
    where: { tenantId: auth.tenant.id, category: { branchId: sourceBranchId } },
    select: { productId: true, categoryId: true },
  });
  for (const link of links) {
    const targetCategoryId = targetCategories.get(link.categoryId);
    if (!targetCategoryId) continue;
    await prisma.productCategory.upsert({
      where: { productId_categoryId: { productId: link.productId, categoryId: targetCategoryId } },
      create: { tenantId: auth.tenant.id, productId: link.productId, categoryId: targetCategoryId },
      update: { tenantId: auth.tenant.id },
    });
  }

  await recordAudit({
    context: auth,
    action: "branch.copyCarta",
    entityType: "branch",
    entityId: targetBranchId,
    newValues: {
      sourceBranchId,
      categories: categories.length,
      products: assignments.length,
      stocks: stocks.length,
    },
    request,
  });

  return NextResponse.json({
    ok: true,
    categories: categories.length,
    products: assignments.length,
    stocks: stocks.length,
  });
}
