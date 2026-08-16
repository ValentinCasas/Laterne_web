import { ProductCatalogBoard } from "@/components/admin/product-catalog-board";
import { requirePermission } from "@/lib/auth";
import { loadProductCatalogData } from "@/lib/product-catalog-data";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

/**
 * @summary Genera los metadatos de la vista para el tenant autorizado.
 */
export async function generateMetadata(): Promise<Metadata> {
  const context = await requirePermission("product.manage");
  return { title: `${context.tenant.name} | Productos` };
}

/**
 * @summary Página del catálogo de productos dentro del contexto de tenant y sucursal de la URL.
 */
export default async function AdminProductsPage() {
  const context = await requirePermission("product.manage");
  const payload = await loadProductCatalogData(context);
  return <ProductCatalogBoard initial={payload} />;
}
