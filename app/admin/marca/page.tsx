import { BrandManager, type BrandData } from "@/components/admin/brand-manager";
import { requirePermission } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { palettePresets } from "@/lib/theme-palettes";

/** @summary Carga o inicializa la identidad visual del negocio para su edición centralizada. */
export default async function BrandPage() {
  const context = await requirePermission("brand.manage");
  const brand = await prisma.brandSettings.upsert({
    where: { tenantId: context.tenant.id },
    create: { tenantId: context.tenant.id },
    update: {},
  });
  const [tenant, palettes] = await Promise.all([
    prisma.tenant.findUniqueOrThrow({
    where: { id: context.tenant.id },
    select: { defaultCurrency: true, locale: true, timeZone: true },
    }),
    prisma.themePalette.findMany({ where: { tenantId: context.tenant.id }, orderBy: [{ isSystem: "desc" }, { name: "asc" }] }),
  ]);
  const activeTenant = await prisma.tenant.findUniqueOrThrow({ where: { id: context.tenant.id }, select: { activePaletteId: true } });

  return <BrandManager initialBrand={serialize({ ...brand, ...tenant }) as unknown as BrandData} palettes={serialize(palettes) as unknown as Parameters<typeof BrandManager>[0]["palettes"]} activePaletteId={activeTenant.activePaletteId} presets={palettePresets} />;
}
