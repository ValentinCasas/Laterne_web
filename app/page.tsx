import { MenuClickHome } from "@/components/commercial/menuclick-home";
import { LandingRenderer } from "@/components/landing/landing-renderer";
import { classifyHost } from "@/lib/domains";
import { loadTenantLandingData } from "@/lib/landing-data";
import { prisma } from "@/lib/prisma";
import { requestRouteContext } from "@/lib/request-route-context";
import { publicHrefForVisiblePath } from "@/lib/routes";
import { getDefaultTenant } from "@/lib/tenant";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

/** @summary Construye la página pública con los datos actuales almacenados en MySQL. */
export default async function LandingPage() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "";
  const routeKind = requestHeaders.get("x-menuclick-route-kind") ?? "";
  if (routeKind.startsWith("platform") || (!routeKind && classifyHost(host).kind === "platform")) {
    const [plans, cases] = await Promise.all([
      prisma.plan.findMany({ where: { active: true }, include: { prices: { where: { active: true }, orderBy: { validFrom: "desc" }, take: 1 } }, orderBy: [{ type: "asc" }, { displayOrder: "asc" }], take: 4 }),
      prisma.successCase.findMany({ where: { isPublicCaseStudy: true, status: "published" }, include: { tenant: { select: { name: true } } }, orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] }),
    ]);
    return <MenuClickHome plans={plans.map((plan) => ({ id: plan.id, slug: plan.slug, name: plan.name, summary: plan.summary, highlighted: plan.highlighted, price: plan.prices[0] ? { amount: plan.prices[0].amount ? Number(plan.prices[0].amount) : null, currency: plan.prices[0].currency, billingPeriod: plan.prices[0].billingPeriod } : null }))} cases={cases.map((item) => ({ id: item.id, slug: item.slug, businessName: item.businessName, businessType: item.businessType, location: item.location, coverUrl: item.coverUrl, results: item.results, tenantName: item.tenant.name }))} />;
  }
  const [tenant, route] = await Promise.all([getDefaultTenant(), requestRouteContext()]);
  const data = await loadTenantLandingData(tenant);

  return (
    <main className="overflow-hidden">
      <LandingRenderer
        data={data}
        resolveHref={(href) =>
          href.startsWith("#")
            ? href
            : publicHrefForVisiblePath(route.originalPath, tenant.slug, href, route.branchSlug)
        }
      />
    </main>
  );
}