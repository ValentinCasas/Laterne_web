import { LandingEditor, type LandingData } from "@/components/admin/landing-editor";
import { requirePermission } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> { const context = await requirePermission("brand.manage"); return { title: `${context.tenant.name} | Landing` }; }

/** @summary Carga la identidad y textos del inicio para editarlos con vista previa en vivo. */
export default async function LandingPage() {
  const context = await requirePermission("brand.manage");
  const brand = await prisma.brandSettings.findUnique({ where: { tenantId: context.tenant.id } });
  return (
    <LandingEditor
      initialBrand={
        serialize({
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
        }) as unknown as LandingData
      }
    />
  );
}