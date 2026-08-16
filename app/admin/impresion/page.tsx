import { PrintConfigBoard } from "@/components/admin/print-config-board";
import { requirePermission } from "@/lib/auth";
import { loadPrintingData } from "@/lib/printing-data";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
/**
 * @summary Genera los metadatos de la vista para el tenant autorizado.
 */
export async function generateMetadata(): Promise<Metadata> {
  const context = await requirePermission("order.manage");
  return { title: `${context.tenant.name} | Impresión` };
}

/** @summary Carga la configuración de impresión dentro del contexto de tenant y sucursal de la URL. */
export default async function AdminPrintingPage() {
  const context = await requirePermission("order.manage");
  const payload = await loadPrintingData(context);
  return <PrintConfigBoard initial={payload} />;
}
