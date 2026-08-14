import { RewardsManager } from "@/components/admin/rewards-manager";
import { requirePermission } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const context = await requirePermission("customer.manage");
  return { title: `${context.tenant.name} | Fidelización` };
}

/** @summary Carga las recompensas canjeables y el estado del programa para el panel. */
export default async function FidelizacionPage() {
  const context = await requirePermission("customer.manage");
  const [rewards, customerCount] = await Promise.all([
    prisma.loyaltyReward.findMany({
      where: { tenantId: context.tenant.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    }),
    prisma.loyaltyCustomer.count({ where: { tenantId: context.tenant.id, deletedAt: null } }),
  ]);
  return (
    <RewardsManager
      initialRewards={serialize(rewards) as unknown as Parameters<typeof RewardsManager>[0]["initialRewards"]}
      initialCustomerCount={customerCount}
    />
  );
}
