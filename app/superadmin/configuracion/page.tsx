import { PlatformAppearance } from "@/components/platform/platform-appearance";
import { requireSuperAdmin } from "@/lib/auth";
import { menuClickPresets } from "@/lib/menuclick-theme";
import type { PaletteColors } from "@/lib/theme-palettes";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/format";

export default async function PlatformConfigurationPage() {
  await requireSuperAdmin();
  const settings = await prisma.platformSettings.upsert({ where: { id: 1 }, create: { id: 1, name: "MenuClick" }, update: {} });
  const palettes = await prisma.platformPalette.findMany({ where: { settingsId: 1 }, orderBy: [{ isSystem: "desc" }, { name: "asc" }] });
  return <PlatformAppearance initialSettings={serialize({ name: settings.name, logoUrl: settings.logoUrl, isotypeUrl: settings.isotypeUrl, faviconUrl: settings.faviconUrl, activePaletteId: settings.activePaletteId }) as { name: string; logoUrl: string | null; isotypeUrl: string | null; faviconUrl: string | null; activePaletteId: number | null }} initialPalettes={serialize(palettes) as unknown as Parameters<typeof PlatformAppearance>[0]["initialPalettes"]} presets={menuClickPresets as (PaletteColors & { key: string; name: string; description: string })[]} />;
}
