import { DataPortability } from "@/components/admin/data-portability";
import { requirePermission } from "@/lib/auth";

/** @summary Protege y presenta las herramientas de portabilidad del negocio. */
export default async function DataPage() {
  await requirePermission("admin.access");
  return <DataPortability />;
}
