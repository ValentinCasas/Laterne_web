import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeSuperAdmin } from "@/lib/auth";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { menuClickPresetByKey, menuClickPresets, type MenuClickTheme } from "@/lib/menuclick-theme";

/**
 * @summary Valida la entrada relacionada con la apariencia de la plataforma.
 */
const colorSchema = z.object({
  primary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  secondary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  background: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  surface: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  surfaceElevated: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  text: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  textMuted: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  border: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  success: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  warning: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  danger: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  baseMode: z.enum(["dark", "light"]),
});
const input = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  presetKey: z.string().trim().max(50).optional(),
  sourceId: z.coerce.number().int().positive().optional(),
  colors: colorSchema.optional(),
});

/**
 * @summary Normaliza una paleta de la plataforma para exponerla al cliente.
 */
function paletteData(theme: MenuClickTheme | Record<string, string>) {
  return {
    primary: theme.primary,
    secondary: theme.secondary,
    accent: theme.accent,
    background: theme.background,
    surface: theme.surface,
    surfaceElevated: theme.surfaceElevated,
    text: theme.text,
    textMuted: theme.textMuted,
    border: theme.border,
    success: theme.success,
    warning: theme.warning,
    danger: theme.danger,
    baseMode: theme.baseMode,
  };
}

/**
 * @summary Convierte la configuración visual persistida al formato utilizado por la interfaz.
 */
async function settings() {
  return prisma.platformSettings.upsert({
    where: { id: 1 },
    create: { id: 1, name: "MenuClick" },
    update: {},
  });
}

/** @summary Devuelve la identidad global de MenuClick y sus paletas guardadas. */
export async function GET() {
  const auth = await authorizeSuperAdmin();
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const current = await prisma.platformSettings.findUnique({
    where: { id: 1 },
    include: { activePalette: true, palettes: { orderBy: [{ isSystem: "desc" }, { name: "asc" }] } },
  });
  return NextResponse.json({ settings: toAuditValue(current), presets: menuClickPresets });
}

/** @summary Selecciona un preset o crea una paleta personalizada global de MenuClick. */
export async function POST(request: Request) {
  const auth = await authorizeSuperAdmin();
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisá la paleta" }, { status: 400 });
  const current = await settings();
  let source: MenuClickTheme | Record<string, string> | null = null;
  let name = parsed.data.name ?? "Mi paleta";
  if (parsed.data.sourceId) {
    const record = await prisma.platformPalette.findFirst({
      where: { id: parsed.data.sourceId, settingsId: current.id },
    });
    if (!record) return NextResponse.json({ error: "Paleta de origen no encontrada" }, { status: 404 });
    source = {
      primary: record.primary,
      secondary: record.secondary,
      accent: record.accent,
      background: record.background,
      surface: record.surface,
      surfaceElevated: record.surfaceElevated,
      text: record.text,
      textMuted: record.textMuted,
      border: record.border,
      success: record.success,
      warning: record.warning,
      danger: record.danger,
      baseMode: record.baseMode,
    };
    name = parsed.data.name ?? `${record.name} personalizada`;
  } else if (parsed.data.presetKey) {
    const preset = menuClickPresetByKey(parsed.data.presetKey);
    if (!preset) return NextResponse.json({ error: "Preset no encontrado" }, { status: 404 });
    const existing = await prisma.platformPalette.findUnique({
      where: { settingsId_presetKey: { settingsId: current.id, presetKey: preset.key } },
    });
    if (existing) {
      await prisma.platformSettings.update({
        where: { id: current.id },
        data: { activePaletteId: existing.id },
      });
      return NextResponse.json({ palette: toAuditValue(existing) });
    }
    source = preset;
    name = preset.name;
  }
  const selected = parsed.data.colors ?? source;
  if (!selected) return NextResponse.json({ error: "Definí colores o elegí un preset" }, { status: 400 });
  const palette = await prisma.platformPalette.create({
    data: {
      settingsId: current.id,
      name,
      isSystem: Boolean(parsed.data.presetKey && !parsed.data.sourceId),
      presetKey: parsed.data.presetKey ?? null,
      ...paletteData(selected),
    },
  });
  await prisma.platformSettings.update({ where: { id: current.id }, data: { activePaletteId: palette.id } });
  await recordAudit({
    context: auth,
    action: "platform-palette-created",
    entityType: "platform-palette",
    entityId: palette.id,
    newValues: toAuditValue(palette),
    request,
  });
  return NextResponse.json({ palette: toAuditValue(palette) }, { status: 201 });
}

/** @summary Cambia la paleta global activa sin tocar ninguna configuración de tenant. */
export async function PUT(request: Request) {
  const auth = await authorizeSuperAdmin();
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = z
    .object({ paletteId: z.coerce.number().int().positive() })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Paleta inválida" }, { status: 400 });
  const current = await settings();
  const palette = await prisma.platformPalette.findFirst({
    where: { id: parsed.data.paletteId, settingsId: current.id },
  });
  if (!palette) return NextResponse.json({ error: "Paleta no encontrada" }, { status: 404 });
  await prisma.platformSettings.update({ where: { id: current.id }, data: { activePaletteId: palette.id } });
  await recordAudit({
    context: auth,
    action: "platform-palette-activated",
    entityType: "platform-palette",
    entityId: palette.id,
    request,
  });
  return NextResponse.json({ palette: toAuditValue(palette) });
}
