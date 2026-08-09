import { PlanManager } from "@/components/admin/plan-manager";
import { requirePermission } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";

/** @summary Carga el catálogo comercial completo para administrarlo desde el panel. */
export default async function AdminPlansPage() {
  await requirePermission("plan.manage");
  const [plans, features] = await Promise.all([
    prisma.plan.findMany({
      include: {
        prices: { where: { active: true }, orderBy: { validFrom: "desc" }, take: 1 },
        features: { include: { feature: true }, orderBy: { displayOrder: "asc" } },
      },
      orderBy: [{ type: "asc" }, { displayOrder: "asc" }],
    }),
    prisma.feature.findMany({
      where: { active: true },
      orderBy: [{ category: "asc" }, { displayOrder: "asc" }],
    }),
  ]);
  return (
    <PlanManager
      initialPlans={plans.map((plan) => ({
        ...serialize(plan),
        prices: plan.prices.map((price) => ({
          currency: price.currency,
          amount: price.amount ? Number(price.amount) : null,
          billingPeriod: price.billingPeriod,
        })),
      }))}
      featureOptions={serialize(features)}
    />
  );
}
