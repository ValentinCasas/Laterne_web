import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const input = z.object({
  name: z.string().trim().min(1).max(120),
  required: z.boolean(),
  minSelections: z.coerce.number().int().min(0).max(50),
  maxSelections: z.coerce.number().int().min(1).max(50),
  sortOrder: z.coerce.number().int().min(-1000).max(1000),
  active: z.boolean(),
});

/**
 * @summary Actualiza los grupos de opciones de producto tras validar contexto, permisos y entrada.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("product.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!Number.isInteger(id) || !parsed.success || parsed.data.minSelections > parsed.data.maxSelections)
    return NextResponse.json({ error: "Revisá los límites del grupo" }, { status: 400 });
  const current = await prisma.productOptionGroup.findFirst({ where: { id, tenantId: auth.tenant.id } });
  if (!current) return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });
  const group = await prisma.productOptionGroup.update({
    where: { id },
    data: {
      name: parsed.data.name,
      required: parsed.data.required,
      minSelections: parsed.data.minSelections,
      maxSelections: parsed.data.maxSelections,
      sortOrder: parsed.data.sortOrder,
      active: parsed.data.active,
    },
  });
  await recordAudit({
    context: auth,
    action: "update",
    entityType: "product-option-group",
    entityId: id,
    oldValues: toAuditValue(serialize(current)),
    newValues: toAuditValue(serialize(group)),
    request,
  });
  return NextResponse.json({ group: serialize(group) });
}

/**
 * @summary Elimina o desactiva datos de los grupos de opciones de producto dentro del contexto autorizado.
 */
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("product.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  const group = await prisma.productOptionGroup.findFirst({ where: { id, tenantId: auth.tenant.id } });
  if (!group) return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });
  await prisma.$transaction([
    prisma.productVariant.updateMany({ where: { groupId: id }, data: { groupId: null } }),
    prisma.productExtra.updateMany({ where: { groupId: id }, data: { groupId: null } }),
    prisma.productOptionGroup.delete({ where: { id } }),
  ]);
  await recordAudit({
    context: auth,
    action: "delete",
    entityType: "product-option-group",
    entityId: id,
    oldValues: toAuditValue(serialize(group)),
    request,
  });
  return NextResponse.json({ ok: true });
}
