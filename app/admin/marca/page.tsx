import { BrandManager, type BrandData } from "@/components/admin/brand-manager";
import { requirePermission } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";

/** @summary Carga o inicializa la identidad visual del negocio para su edición centralizada. */
export default async function BrandPage() {
  const context = await requirePermission("brand.manage");
  const brand = await prisma.brandSettings.upsert({
    where: { tenantId: context.tenant.id },
    create: { tenantId: context.tenant.id },
    update: {},
  });
  return <BrandManager initialBrand={serialize(brand) as unknown as BrandData} />;
}
