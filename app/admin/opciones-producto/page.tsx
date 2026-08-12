import { ProductOptionsManager } from "@/components/admin/product-options-manager";
import { requirePermission } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { branchProductWhere } from "@/lib/branch";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> { const context = await requirePermission("product.manage"); return { title: `${context.tenant.name} | Variantes y agregados` }; }

/** @summary Carga productos y opciones existentes para administrar variantes y agregados. */
export default async function ProductOptionsPage() {
  const context = await requirePermission("product.manage");
  const productWhere = branchProductWhere(context.tenant.id, context.activeBranchId);
  const optionProductWhere = context.activeBranchId && context.activeBranchId > 0 ? { product: { branchAssignments: { some: { branchId: context.activeBranchId } } } } : {};
  const [products, variants, extras, groups] = await Promise.all([
    prisma.product.findMany({
      where: productWhere,
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.productVariant.findMany({
      where: { tenantId: context.tenant.id, ...optionProductWhere },
      orderBy: [{ productId: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.productExtra.findMany({
      where: { tenantId: context.tenant.id, ...optionProductWhere },
      orderBy: [{ productId: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.productOptionGroup.findMany({ where: { tenantId: context.tenant.id, ...optionProductWhere }, orderBy: [{ productId: "asc" }, { sortOrder: "asc" }] }),
  ]);
  return (
    <ProductOptionsManager
      products={products}
      initialVariants={
        serialize(variants) as unknown as Parameters<typeof ProductOptionsManager>[0]["initialVariants"]
      }
      initialExtras={
        serialize(extras) as unknown as Parameters<typeof ProductOptionsManager>[0]["initialExtras"]
      }
      initialGroups={serialize(groups) as unknown as Parameters<typeof ProductOptionsManager>[0]["initialGroups"]}
    />
  );
}
