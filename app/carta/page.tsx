import { MenuClient, type MenuCategory } from "@/components/menu/menu-client";
import { prisma } from "@/lib/prisma";
import { readdir } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

/** @summary Obtiene categorías y productos válidos para construir la carta pública. */
export default async function MenuPage() {
  const [records, business, productImageFiles, categoryImageFiles] = await Promise.all([
    prisma.category.findMany({
      orderBy: { name: "asc" },
      include: { products: { include: { product: true }, orderBy: { product: { name: "asc" } } } },
    }),
    prisma.businessInfo.findFirst(),
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
        name: product.name,
        description: product.description,
        price: Number(product.price ?? 0),
        availability: product.availability,
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
