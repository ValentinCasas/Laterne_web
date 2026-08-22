import { CustomerMaster, type LoyaltyCustomerData } from "@/components/admin/customer-master";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** @summary Carga la base maestra de clientes frecuentes para el panel administrativo. */
export default async function AdminClientsPage() {
  const context = await requirePermission("customer.manage");
  const [customers, totalCustomers] = await Promise.all([prisma.loyaltyCustomer.findMany({
    where: {
      tenantId: context.tenant.id,
      deletedAt: null,
    },
    orderBy: { name: "asc" },
    take: 25,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      birthday: true,
      points: true,
      tier: true,
      createdAt: true,
      address: true,
      paymentTerms: true,
      currentBalance: true,
      currency: true,
      _count: { select: { orders: true, transactions: true } },
    },
  }), prisma.loyaltyCustomer.count({ where: { tenantId: context.tenant.id, deletedAt: null } })]);
  const normalized: LoyaltyCustomerData[] = customers.map((customer) => ({
    ...customer,
    currentBalance: Number(customer.currentBalance),
    createdAt: customer.createdAt.toISOString(),
    birthday: customer.birthday ? customer.birthday.toISOString() : null,
    _count: {
      orders: customer._count.orders,
      transactions: customer._count.transactions,
    },
  }));
  return <CustomerMaster initialCustomers={normalized} initialTotal={totalCustomers} />;
}
