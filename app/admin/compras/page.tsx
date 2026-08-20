import { redirect } from "next/navigation";

/** @summary Redirige la ruta raíz de Compras a la vista de pedidos. */
export default function ComprasPage() {
  redirect("/admin/compras/pedidos");
}
