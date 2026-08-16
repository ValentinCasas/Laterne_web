import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { validatePalette, type PaletteColors } from "@/lib/theme-palettes";

/**
 * @summary Valida la entrada relacionada con las paletas visuales.
 */
const updateInput = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  colors: z.record(z.string(), z.string()).optional(),
});

/**
 * @summary Actualiza las paletas visuales tras validar contexto, permisos y entrada.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("brand.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  const parsed = updateInput.safeParse(await request.json().catch(() => null));
  if (!Number.isInteger(id) || !parsed.success)
    return NextResponse.json({ error: "Paleta inválida" }, { status: 400 });
  const current = await prisma.themePalette.findFirst({ where: { id, tenantId: auth.tenant.id } });
  if (!current) return NextResponse.json({ error: "Paleta no encontrada" }, { status: 404 });
  if (current.isSystem)
    return NextResponse.json({ error: "Duplicá los presets antes de editarlos" }, { status: 409 });
  const nextColors = { ...current, ...(parsed.data.colors ?? {}) } as unknown as PaletteColors;
  const errors = validatePalette(nextColors);
  if (errors.length) return NextResponse.json({ error: errors[0], contrastErrors: errors }, { status: 400 });
  const palette = await prisma.themePalette.update({
    where: { id },
    data: {
      name: parsed.data.name ?? current.name,
      ...Object.fromEntries(
        Object.entries(parsed.data.colors ?? {}).filter(([key]) => paletteColorKeys.has(key)),
      ),
    },
  });
  await recordAudit({
    context: auth,
    action: "palette-updated",
    entityType: "theme-palette",
    entityId: id,
    oldValues: toAuditValue(current),
    newValues: toAuditValue(palette),
    request,
  });
  return NextResponse.json({ palette: toAuditValue(palette) });
}

const paletteColorKeys = new Set([
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
]);

/**
 * @summary Elimina o desactiva datos de las paletas visuales dentro del contexto autorizado.
 */
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("brand.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  const [palette, tenant] = await Promise.all([
    prisma.themePalette.findFirst({ where: { id, tenantId: auth.tenant.id } }),
    prisma.tenant.findUnique({ where: { id: auth.tenant.id }, select: { activePaletteId: true } }),
  ]);
  if (!palette) return NextResponse.json({ error: "Paleta no encontrada" }, { status: 404 });
  if (palette.isSystem)
    return NextResponse.json({ error: "Las paletas predefinidas no se eliminan" }, { status: 409 });
  if (tenant?.activePaletteId === id)
    return NextResponse.json(
      { error: "Seleccioná otra paleta antes de eliminar la activa" },
      { status: 409 },
    );
  await prisma.themePalette.delete({ where: { id } });
  await recordAudit({
    context: auth,
    action: "palette-deleted",
    entityType: "theme-palette",
    entityId: id,
    oldValues: toAuditValue(palette),
    request,
  });
  return NextResponse.json({ ok: true });
}
