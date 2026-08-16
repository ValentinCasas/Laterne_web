import { SalonBoard, type SalonBoardProps } from "@/components/admin/salon-board";
import { requirePermission } from "@/lib/auth";
import { loadSalonData } from "@/lib/salon-data";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

/** @summary Genera los metadatos de la vista para el tenant autorizado. */
export async function generateMetadata(): Promise<Metadata> {
  const context = await requirePermission("table.manage");
  return { title: `${context.tenant.name} | Salón` };
}

/** @summary Carga el salón con el contexto de tenant y sucursal de la URL canónica. */
export default async function AdminSalonPage() {
  const context = await requirePermission("table.manage");
  const payload = await loadSalonData(context);
  const props: SalonBoardProps = {
    initial: payload,
    canManageOrders: context.permissions.includes("order.manage"),
  };
  return <SalonBoard {...props} />;
}
