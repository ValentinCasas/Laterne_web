import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { palettePresets, presetByKey, validatePalette, type PaletteColors } from "@/lib/theme-palettes";
import type { Prisma } from "@prisma/client";

const colors = z.object({
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
/**
 * @summary Valida la entrada relacionada con las paletas visuales.
 */
const createInput = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  presetKey: z.string().trim().max(50).optional(),
  sourceId: z.coerce.number().int().positive().optional(),
  colors: colors.optional(),
});

const paletteFields = [
  "primary",
  "secondary",
  "accent",
  "background",
  "surface",
  "surfaceElevated",
  "text",
  "textMuted",
  "border",
  "success",
  "warning",
  "danger",
  "baseMode",
] as const;

/**
 * @summary Valida y normaliza los colores enviados para una paleta.
 */
function colorData(value: PaletteColors) {
  return Object.fromEntries(paletteFields.map((field) => [field, value[field]]));
}

/**
 * @summary Extrae los colores persistidos de una paleta.
 */
function recordColors(value: {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  surfaceElevated: string;
  text: string;
  textMuted: string;
  border: string;
  success: string;
  warning: string;
  danger: string;
  baseMode: string;
}): PaletteColors {
  return {
    primary: value.primary,
    secondary: value.secondary,
    accent: value.accent,
    background: value.background,
    surface: value.surface,
    surfaceElevated: value.surfaceElevated,
    text: value.text,
    textMuted: value.textMuted,
    border: value.border,
    success: value.success,
    warning: value.warning,
    danger: value.danger,
    baseMode: value.baseMode === "light" ? "light" : "dark",
  };
}

/** @summary Lista paletas propias del tenant junto con la paleta activa. */
export async function GET() {
  const auth = await authorize("brand.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const tenant = await prisma.tenant.findUnique({
    where: { id: auth.tenant.id },
    select: { activePaletteId: true },
  });
  const palettes = await prisma.themePalette.findMany({
    where: { tenantId: auth.tenant.id },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
  });
  return NextResponse.json({
    activePaletteId: tenant?.activePaletteId ?? null,
    palettes: toAuditValue(palettes),
    presets: palettePresets,
  });
}

/** @summary Crea una paleta personalizada, duplica una existente o activa un preset por tenant. */
export async function POST(request: Request) {
  const auth = await authorize("brand.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = createInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Revisá el nombre y los colores de la paleta" }, { status: 400 });
  let source: PaletteColors | null = null;
  let sourceName = "";
  let sourceSystem = false;
  if (parsed.data.sourceId) {
    const sourceRecord = await prisma.themePalette.findFirst({
      where: { id: parsed.data.sourceId, tenantId: auth.tenant.id },
    });
    if (!sourceRecord) return NextResponse.json({ error: "Paleta de origen no encontrada" }, { status: 404 });
    source = recordColors(sourceRecord);
    sourceName = sourceRecord.name;
    sourceSystem = sourceRecord.isSystem;
  } else if (parsed.data.presetKey) {
    const preset = presetByKey(parsed.data.presetKey);
    if (!preset) return NextResponse.json({ error: "Preset no encontrado" }, { status: 404 });
    source = preset;
    sourceName = preset.name;
    sourceSystem = true;
    const existing = await prisma.themePalette.findUnique({
      where: { tenantId_presetKey: { tenantId: auth.tenant.id, presetKey: preset.key } },
    });
    if (existing) {
      await prisma.tenant.update({ where: { id: auth.tenant.id }, data: { activePaletteId: existing.id } });
      return NextResponse.json({ palette: toAuditValue(existing), activePaletteId: existing.id });
    }
  }
  const selected = parsed.data.colors ?? source;
  if (!selected) return NextResponse.json({ error: "Definí una paleta o un preset" }, { status: 400 });
  const errors = validatePalette(selected);
  if (errors.length) return NextResponse.json({ error: errors[0], contrastErrors: errors }, { status: 400 });
  const palette = await prisma.themePalette.create({
    data: {
      tenantId: auth.tenant.id,
      name: parsed.data.name ?? (sourceSystem ? sourceName : "Mi paleta"),
      isSystem: Boolean(parsed.data.presetKey && !parsed.data.sourceId),
      presetKey: parsed.data.presetKey ?? null,
      ...colorData(selected),
    } as Prisma.ThemePaletteUncheckedCreateInput,
  });
  await prisma.tenant.update({ where: { id: auth.tenant.id }, data: { activePaletteId: palette.id } });
  await recordAudit({
    context: auth,
    action: "palette-created",
    entityType: "theme-palette",
    entityId: palette.id,
    newValues: toAuditValue(palette),
    request,
  });
  return NextResponse.json({ palette: toAuditValue(palette), activePaletteId: palette.id }, { status: 201 });
}

/** @summary Selecciona una paleta ya guardada como identidad visual activa del tenant. */
export async function PUT(request: Request) {
  const auth = await authorize("brand.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = z
    .object({ paletteId: z.coerce.number().int().positive() })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Paleta inválida" }, { status: 400 });
  const palette = await prisma.themePalette.findFirst({
    where: { id: parsed.data.paletteId, tenantId: auth.tenant.id },
  });
  if (!palette) return NextResponse.json({ error: "Paleta no encontrada" }, { status: 404 });
  await prisma.tenant.update({ where: { id: auth.tenant.id }, data: { activePaletteId: palette.id } });
  await recordAudit({
    context: auth,
    action: "palette-activated",
    entityType: "theme-palette",
    entityId: palette.id,
    request,
  });
  return NextResponse.json({ activePaletteId: palette.id, palette: toAuditValue(palette) });
}
