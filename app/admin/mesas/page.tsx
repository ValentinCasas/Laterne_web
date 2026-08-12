import { TableManager, type DiningTableData } from "@/components/admin/table-manager";
import { requirePermission } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** @summary Carga las mesas del negocio para gestionar sus datos y códigos QR. */
export default async function AdminTablesPage() {
  const context = await requirePermission("table.manage");
  const activeId = context.activeBranchId && context.activeBranchId > 0 ? context.activeBranchId : null;
  const branchScope = activeId ? { branchId: activeId } : { branchId: { in: context.branches.map((branch) => branch.id) } };
  const [tables, branches] = await Promise.all([
    prisma.diningTable.findMany({
      where: { tenantId: context.tenant.id, ...branchScope },
      include: {
        orders: {
          where: { status: { notIn: ["delivered", "cancelled"] } },
          select: { reference: true, status: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: [{ sector: "asc" }, { name: "asc" }],
    }),
    prisma.branch.findMany({
      where: { tenantId: context.tenant.id, active: true, id: { in: context.branches.map((branch) => branch.id) } },
      select: { id: true, name: true },
      orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
    }),
  ]);
  return (
    <TableManager
      initialTables={
        serialize(
          tables.map(({ orders, ...table }) => ({ ...table, currentOrder: orders[0] ?? null })),
        ) as unknown as DiningTableData[]
      }
      branches={branches}
    />
  );
}
