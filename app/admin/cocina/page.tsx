import { KitchenBoard } from "@/components/admin/kitchen-board";
import { requirePermission } from "@/lib/auth";
import { loadKdsData } from "@/lib/kds-data";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
/**
 * @summary Genera los metadatos de la vista para el tenant autorizado.
 */
export async function generateMetadata(): Promise<Metadata> {
  const context = await requirePermission("order.manage");
  return { title: `${context.tenant.name} | Cocina` };
}

/** @summary Carga los datos del monitor de cocina dentro del contexto de tenant y sucursal de la URL. */
export default async function AdminKitchenPage() {
  const context = await requirePermission("order.manage");
  const payload = await loadKdsData(context);
  return <KitchenBoard initial={payload} userName={context.user.name} />;
}
