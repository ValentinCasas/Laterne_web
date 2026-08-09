import { MenuClient, type MenuCategory } from "@/components/menu/menu-client";
import { prisma } from "@/lib/prisma";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { getDefaultTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/** @summary Obtiene categorías y productos válidos para construir la carta pública. */
export default async function MenuPage() {
  const tenant = await getDefaultTenant();
  const [records, business, productImageFiles, categoryImageFiles] = await Promise.all([
    prisma.category.findMany({
      where: { tenantId: tenant.id, status: "published" },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        products: {
          where: { product: { status: "published" } },
          include: { product: true },
          orderBy: { product: { name: "asc" } },
        },
      },
    }),
    prisma.businessInfo.findUnique({ where: { tenantId: tenant.id } }),
    readdir(path.join(process.cwd(), "public", "images", "images_product")),
    readdir(path.join(process.cwd(), "public", "images", "images_categories")),
  ]);
  const productImages = new Set(productImageFiles);
  const categoryImages = new Set(categoryImageFiles);
  const categories: MenuCategory[] = records
    .map((category) => ({
      id: category.id,
      name: category.name,
      description: category.description,
      image:
        category.imageUrl?.trim() && categoryImages.has(category.imageUrl)
          ? category.imageUrl
          : "bottle-1-svgrepo-com.png",
      products: category.products.map(({ product }) => ({
        id: product.id,
        slug: product.slug,
        name: product.name,
        description: product.description,
        price: Number(product.promotionalPrice ?? product.price ?? 0),
        availability: product.availability,
        featured: product.featured,
        isNew: product.isNew,
        recommended: product.recommended,
        vegetarian: product.vegetarian,
        vegan: product.vegan,
        glutenFree: product.glutenFree,
        alcoholFree: product.alcoholFree,
        promotionalPrice: product.promotionalPrice ? Number(product.promotionalPrice) : null,
        previousPrice: product.previousPrice ? Number(product.previousPrice) : null,
        image:
          product.imageUrl?.trim() &&
          product.imageUrl !== "product_default.png" &&
          productImages.has(product.imageUrl)
            ? `/images/images_product/${product.imageUrl}`
            : "/images/image_defect/product_default.png",
      })),
    }))
    .filter((category) => category.products.length > 0);
  return <MenuClient categories={categories} phone={business?.phoneNumber?.toString() ?? ""} />;
}
