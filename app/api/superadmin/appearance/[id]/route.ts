import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeSuperAdmin } from "@/lib/auth";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

const update = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  colors: z.record(z.string(), z.string()).optional(),
});
const keys = new Set([
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
 * @summary Actualiza la apariencia de la plataforma tras validar contexto, permisos y entrada.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorizeSuperAdmin();
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  const parsed = update.safeParse(await request.json().catch(() => null));
  if (!Number.isInteger(id) || !parsed.success)
    return NextResponse.json({ error: "Paleta inválida" }, { status: 400 });
  const current = await prisma.platformPalette.findFirst({ where: { id, settingsId: 1 } });
  if (!current) return NextResponse.json({ error: "Paleta no encontrada" }, { status: 404 });
  if (current.isSystem)
    return NextResponse.json({ error: "Duplicá los presets antes de editarlos" }, { status: 409 });
  const palette = await prisma.platformPalette.update({
    where: { id },
    data: {
      name: parsed.data.name ?? current.name,
      ...Object.fromEntries(Object.entries(parsed.data.colors ?? {}).filter(([key]) => keys.has(key))),
    },
  });
  await recordAudit({
    context: auth,
    action: "platform-palette-updated",
    entityType: "platform-palette",
    entityId: id,
    oldValues: toAuditValue(current),
    newValues: toAuditValue(palette),
    request,
  });
  return NextResponse.json({ palette: toAuditValue(palette) });
}

/**
 * @summary Elimina o desactiva datos de la apariencia de la plataforma dentro del contexto autorizado.
 */
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorizeSuperAdmin();
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  const [palette, current] = await Promise.all([
    prisma.platformPalette.findFirst({ where: { id, settingsId: 1 } }),
    prisma.platformSettings.findUnique({ where: { id: 1 }, select: { activePaletteId: true } }),
  ]);
  if (!palette) return NextResponse.json({ error: "Paleta no encontrada" }, { status: 404 });
  if (palette.isSystem)
    return NextResponse.json({ error: "Las paletas predefinidas no se eliminan" }, { status: 409 });
  if (current?.activePaletteId === id)
    return NextResponse.json(
      { error: "Seleccioná otra paleta antes de eliminar la activa" },
      { status: 409 },
    );
  await prisma.platformPalette.delete({ where: { id } });
  await recordAudit({
    context: auth,
    action: "platform-palette-deleted",
    entityType: "platform-palette",
    entityId: id,
    oldValues: toAuditValue(palette),
    request,
  });
  return NextResponse.json({ ok: true });
}
