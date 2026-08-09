import { TableManager, type DiningTableData } from "@/components/admin/table-manager";
import { requirePermission } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** @summary Carga las mesas del negocio para gestionar sus datos y códigos QR. */
export default async function AdminTablesPage() {
  const context = await requirePermission("table.manage");
  const tables = await prisma.diningTable.findMany({
    where: { tenantId: context.tenant.id },
    orderBy: [{ sector: "asc" }, { name: "asc" }],
  });
  return <TableManager initialTables={serialize(tables) as unknown as DiningTableData[]} />;
}
