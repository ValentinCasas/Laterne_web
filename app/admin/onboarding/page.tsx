import { OnboardingWizard } from "@/components/admin/onboarding-wizard";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** @summary Detecta la configuración existente y combina esos datos con el progreso guardado. */
export default async function OnboardingPage() {
  const context = await requirePermission("admin.access");
  const [progress, business, brand, hours, categories, products, reservationSettings] = await Promise.all([
    prisma.onboardingProgress.findUnique({ where: { tenantId: context.tenant.id } }),
    prisma.businessInfo.findUnique({ where: { tenantId: context.tenant.id } }),
    prisma.brandSettings.findUnique({ where: { tenantId: context.tenant.id } }),
    prisma.openingHour.count({ where: { tenantId: context.tenant.id } }),
    prisma.category.count({ where: { tenantId: context.tenant.id } }),
    prisma.product.count({ where: { tenantId: context.tenant.id } }),
    prisma.reservationSettings.findUnique({ where: { tenantId: context.tenant.id } }),
  ]);
  const automaticCompleted = [
    business?.address && business.phoneNumber ? 1 : 0,
    brand?.logoUrl ? 2 : 0,
    business?.latitude && business.longitude ? 3 : 0,
    hours > 0 ? 4 : 0,
    categories > 0 ? 5 : 0,
    products > 0 ? 6 : 0,
    business?.phoneNumber ? 7 : 0,
    reservationSettings ? 8 : 0,
    brand?.customDomain ? 9 : 0,
  ].filter(Boolean) as number[];
  return (
    <OnboardingWizard
      initialCompleted={
        Array.isArray(progress?.completedSteps)
          ? progress.completedSteps.filter((item): item is number => typeof item === "number")
          : []
      }
      automaticCompleted={automaticCompleted}
      publishedAt={progress?.publishedAt?.toISOString() ?? null}
    />
  );
}
