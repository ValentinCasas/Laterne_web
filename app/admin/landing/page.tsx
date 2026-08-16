import { LandingEditor, type LandingData, type LandingSections } from "@/components/admin/landing-editor";
import { requirePermission } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { loadTenantLandingData } from "@/lib/landing-data";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
/**
 * @summary Genera los metadatos de la vista para el tenant autorizado.
 */
export async function generateMetadata(): Promise<Metadata> {
  const context = await requirePermission("brand.manage");
  return { title: `${context.tenant.name} | Landing` };
}

type LandingSectionsStored = {
  beerImages?: unknown;
  stories?: unknown;
};

/** @summary Carga la identidad, los textos y las secciones visuales del inicio para editarlas con vista previa en vivo. */
export default async function LandingPage() {
  const context = await requirePermission("brand.manage");
  const [brand, data, eventCount, testimonialCount] = await Promise.all([
    prisma.brandSettings.findUnique({ where: { tenantId: context.tenant.id } }),
    loadTenantLandingData(context.tenant),
    prisma.event.count({
      where: { tenantId: context.tenant.id, OR: [{ status: "published" }, { status: "scheduled" }] },
    }),
    prisma.testimonial.count({
      where: { tenantId: context.tenant.id, state: true, moderationStatus: "approved" },
    }),
  ]);
  const stored = (brand?.landingSections ?? {}) as LandingSectionsStored;
  const initialSections: LandingSections = {
    beerImages: Array.isArray(stored.beerImages)
      ? stored.beerImages.filter((value): value is string => typeof value === "string")
      : [],
    stories: Array.isArray(stored.stories)
      ? stored.stories.filter(
          (value): value is { title: string; subtitle: string; image: string } =>
            !!value && typeof value === "object",
        )
      : [],
  };
  return (
    <LandingEditor
      initialBrand={
        serialize({
          hero: data.hero,
          heroTitle: brand?.heroTitle ?? "",
          heroSubtitle: brand?.heroSubtitle ?? "",
          heroImageUrl: brand?.heroImageUrl ?? null,
          logoUrl: brand?.logoUrl ?? null,
          primaryColor: brand?.primaryColor ?? "#ec4899",
          secondaryColor: brand?.secondaryColor ?? "#f5c542",
          backgroundColor: brand?.backgroundColor ?? "#09090b",
          fontFamily: brand?.fontFamily ?? "Inter",
          tenantName: context.tenant.name,
          branchName: context.branches[0]?.name ?? "",
          contactPhone: data.phone,
          contactEmail: data.email ?? "",
          contactAddress: data.address,
          instagramUrl: data.instagramUrl ?? "",
          facebookUrl: data.facebookUrl ?? "",
          latitude: data.latitude,
          longitude: data.longitude,
          hasMap: data.hasMap,
          openingGroups: data.openingGroups,
        }) as unknown as LandingData
      }
      initialSections={initialSections}
      initialEvents={data.events}
      initialTestimonials={data.testimonials}
      eventCount={eventCount}
      testimonialCount={testimonialCount}
    />
  );
}
