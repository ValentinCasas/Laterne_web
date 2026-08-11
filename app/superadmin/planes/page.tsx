import Link from "next/link";
import { PlanManager } from "@/components/admin/plan-manager";
import { requireSuperAdmin } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";

/** @summary Administra el catálogo global de MenuClick fuera del panel de cualquier tenant. */
export default async function PlatformPlansPage() {
  await requireSuperAdmin();
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
    <main className="shell py-8 sm:py-12">
      <Link className="mb-6 inline-block text-sm font-bold text-pink-300" href="/superadmin">
        ← Volver a clientes
      </Link>
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
    </main>
  );
}
