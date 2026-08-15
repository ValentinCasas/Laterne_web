import { CartaEditor, type CartaEditorData } from "@/components/admin/carta-editor";
import type { MenuCategory } from "@/components/menu/menu-client";
import { resolveCartaHeaderConfig } from "@/lib/carta-content";
import { requirePermission } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const context = await requirePermission("brand.manage");
  return { title: `${context.tenant.name} | Carta` };
}

const productFallback = "/images/image_defect/product_default.png";

/** @summary Carga la configuración de textos de la cabecera de la carta y un preview real de datos limitado. */
export default async function CartaPage() {
  const context = await requirePermission("brand.manage");
  const [brand, tenant, categories] = await Promise.all([
    prisma.brandSettings.findUnique({ where: { tenantId: context.tenant.id } }),
    prisma.tenant.findUnique({
      where: { id: context.tenant.id },
      select: { defaultCurrency: true, locale: true },
    }),
    prisma.category.findMany({
      where: { tenantId: context.tenant.id, status: "published" },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      take: 4,
      include: {
        products: {
          where: { product: { status: "published" } },
          include: {
            product: {
              include: {
                variants: { where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
                extras: { where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
              },
            },
          },
          orderBy: { product: { name: "asc" } },
          take: 4,
        },
      },
    }),
  ]);
  const previewCategories: MenuCategory[] = categories
    .map((category) => ({
      id: category.id,
      name: category.name,
      description: category.description,
      image: category.imageUrl?.trim() || "bottle-1-svgrepo-com.png",
      products: category.products.map(({ product }) => ({
        id: product.id,
        slug: product.slug,
        name: product.name,
        description: product.description,
        price: Number(product.promotionalPrice ?? product.price ?? 0),
        availability: "disponible",
        featured: product.featured,
        isNew: product.isNew,
        recommended: product.recommended,
        vegetarian: product.vegetarian,
        vegan: product.vegan,
        glutenFree: product.glutenFree,
        alcoholFree: product.alcoholFree,
        promotionalPrice: product.promotionalPrice ? Number(product.promotionalPrice) : null,
        previousPrice: product.previousPrice ? Number(product.previousPrice) : null,
        arEnabled: product.arEnabled && Boolean(product.model3dUrl),
        preparationMinutes: product.preparationMinutes,
        spiceLevel: product.spiceLevel,
        variants: product.variants.map((variant) => ({
          id: variant.id,
          name: variant.name,
          priceAdjustment: Number(variant.priceAdjustment),
        })),
        extras: product.extras.map((extra) => ({
          id: extra.id,
          name: extra.name,
          price: Number(extra.price),
        })),
        image:
          product.imageUrl?.trim() && product.imageUrl !== "product_default.png"
            ? `/images/images_product/${product.imageUrl}`
            : productFallback,
      })),
    }))
    .filter((category) => category.products.length > 0);

  const primaryBranch = context.branches.find((branch) => branch.isPrimary) ?? context.branches[0];
  const data: CartaEditorData = serialize({
    initialConfig: resolveCartaHeaderConfig(
      (brand?.landingSections as { carta?: unknown } | null)?.carta,
    ),
    businessName: context.tenant.name,
    branchName: primaryBranch?.name ?? "",
    tenantSlug: context.tenant.slug,
    branchSlug: primaryBranch?.slug,
    currency: tenant?.defaultCurrency ?? "ARS",
    locale: tenant?.locale ?? "es-AR",
    logoUrl: brand?.logoUrl ?? null,
    primaryColor: brand?.primaryColor ?? "#ec4899",
    secondaryColor: brand?.secondaryColor ?? "#f5c542",
    backgroundColor: brand?.backgroundColor ?? "#09090b",
    fontFamily: brand?.fontFamily ?? "Inter",
    previewCategories,
  }) as unknown as CartaEditorData;

  return <CartaEditor data={data} />;
}