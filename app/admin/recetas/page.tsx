import { RecipeBoard } from "@/components/admin/recipe-board";
import { requirePermission } from "@/lib/auth";
import { loadRecipeBoardData } from "@/lib/recipe-data";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

/**
 * @summary Genera los metadatos de la vista para el tenant autorizado.
 */
export async function generateMetadata(): Promise<Metadata> {
  const context = await requirePermission("product.manage");
  return { title: `${context.tenant.name} | Recetas` };
}

/**
 * @summary Página de recetas e ingredientes dentro del contexto de tenant y sucursal de la URL.
 */
export default async function AdminRecipesPage() {
  const context = await requirePermission("product.manage");
  const payload = await loadRecipeBoardData(context);
  return <RecipeBoard initial={payload} />;
}
