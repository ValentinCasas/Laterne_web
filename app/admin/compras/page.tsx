import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { adminHrefForContext } from "@/lib/routes";

/** @summary Redirige la ruta raíz de Compras a la vista de pedidos. */
export default async function ComprasPage() {
  const context = await requirePermission("purchase.manage");
  const activeBranch = context.branches.find((branch) => branch.id === context.activeBranchId);
  redirect(
    adminHrefForContext(
      context.tenant.slug,
      "/admin/compras/pedidos",
      activeBranch?.slug,
      context.tenant.publicGuid,
    ),
  );
}
