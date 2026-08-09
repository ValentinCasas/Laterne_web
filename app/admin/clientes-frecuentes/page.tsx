import { CustomerManager, type LoyaltyCustomerData } from "@/components/admin/customer-manager";
import { requirePermission } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";

/** @summary Carga perfiles frecuentes no eliminados y sus contadores de actividad. */
export default async function CustomersPage() {
  const context = await requirePermission("customer.manage");
  const customers = await prisma.loyaltyCustomer.findMany({
    where: { tenantId: context.tenant.id, deletedAt: null },
    include: { _count: { select: { orders: true, transactions: true } } },
    orderBy: { points: "desc" },
    take: 2000,
  });
  return <CustomerManager initialCustomers={serialize(customers) as unknown as LoyaltyCustomerData[]} />;
}
