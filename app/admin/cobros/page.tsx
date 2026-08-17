import { AccountManager, type CustomerPaymentData } from "@/components/admin/account-manager";
import { requirePermission } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ customerId?: string }>;

/** @summary Carga la cuenta corriente de un cliente o el listado global según el contexto. */
export default async function AccountPage({ searchParams }: { searchParams: SearchParams }) {
  const context = await requirePermission("customer.manage");
  const { customerId } = await searchParams;

  if (customerId) {
    const id = Number(customerId);
    if (Number.isInteger(id) && id > 0) {
      const found = await prisma.loyaltyCustomer.findFirst({
        where: { id, tenantId: context.tenant.id, deletedAt: null },
        select: { id: true, name: true, email: true, phone: true, currentBalance: true, currency: true },
      });
      if (found) {
        const customer = {
          ...serialize(found),
          currentBalance: Number(found.currentBalance),
        } as { id: number; name: string; email: string | null; phone: string | null; currentBalance: string | number; currency: string };
        const paymentsFound = await prisma.customerPayment.findMany({
          where: { customerId: id, tenantId: context.tenant.id },
          include: { order: { select: { reference: true } }, delivery: { select: { number: true } }, createdBy: { select: { name: true } } },
          orderBy: { paidAt: "desc" },
          take: 100,
        });
        const payments = serialize(paymentsFound) as unknown as CustomerPaymentData[];
        return <AccountManager initialCustomer={customer} initialPayments={payments} />;
      }
    }
  }

  const customers = await prisma.loyaltyCustomer.findMany({
    where: { tenantId: context.tenant.id, deletedAt: null, currentBalance: { not: 0 } },
    select: { id: true, name: true, email: true, phone: true, currentBalance: true, currency: true },
    orderBy: { currentBalance: "desc" },
    take: 200,
  });
  const customersWithBalance = customers.map((c) => ({
    ...serialize(c),
    currentBalance: Number(c.currentBalance),
  }));
  return <AccountManager initialCustomer={null} initialPayments={[]} customersWithBalance={customersWithBalance} />;
}
