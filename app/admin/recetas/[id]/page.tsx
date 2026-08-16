import { RecipeEditor } from "@/components/admin/recipe-editor";
import { requirePermission } from "@/lib/auth";
import { loadRecipeEditorData } from "@/lib/recipe-data";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

/**
 * @summary Genera los metadatos de la vista para el tenant autorizado.
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const context = await requirePermission("product.manage");
  const id = Number((await params).id);
  const product = Number.isInteger(id)
    ? await loadRecipeEditorData(context, id)
    : null;
  return { title: `${context.tenant.name} | ${product?.product.name ?? "Receta"}` };
}

/**
 * @summary Página del editor visual de receta de un producto.
 */
export default async function RecipeEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await requirePermission("product.manage");
  const id = Number((await params).id);
  const payload = await loadRecipeEditorData(context, id);
  if (!payload) {
    return (
      <div className="rounded-[1.5rem] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-10 text-center">
        <p className="text-lg font-bold">Producto no encontrado</p>
        <p className="mt-1 text-sm text-[var(--admin-muted)]">La receta que buscás no existe en esta sucursal.</p>
      </div>
    );
  }
  return <RecipeEditor initial={payload} />;
}
