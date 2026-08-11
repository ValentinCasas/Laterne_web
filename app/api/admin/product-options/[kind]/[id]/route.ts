import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const optionUpdate = z.object({
  name: z.string().trim().min(1).max(120),
  price: z.coerce.number().min(-1_000_000).max(1_000_000),
  active: z.boolean(),
  sortOrder: z.coerce.number().int().min(-1000).max(1000),
  groupId: z.coerce.number().int().positive().nullable().optional(),
});

/** @summary Recupera una opción de producto comprobando tipo, negocio e identificador. */
async function currentOption(kind: string, id: number, tenantId: number) {
  if (kind === "variant") return prisma.productVariant.findFirst({ where: { id, tenantId } });
  if (kind === "extra") return prisma.productExtra.findFirst({ where: { id, tenantId } });
  return null;
}

/** @summary Actualiza una variante o agregado manteniendo el aislamiento entre negocios. */
export async function PATCH(request: Request, context: { params: Promise<{ kind: string; id: string }> }) {
  const auth = await authorize("product.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { kind, id: rawId } = await context.params;
  const id = Number(rawId);
  const parsed = optionUpdate.safeParse(await request.json().catch(() => null));
  if (!Number.isInteger(id) || !parsed.success || !["variant", "extra"].includes(kind))
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  const current = await currentOption(kind, id, auth.tenant.id);
  if (!current) return NextResponse.json({ error: "Opción no encontrada" }, { status: 404 });
  const group = parsed.data.groupId ? await prisma.productOptionGroup.findFirst({ where: { id: parsed.data.groupId, tenantId: auth.tenant.id, productId: current.productId, kind } }) : null;
  if (parsed.data.groupId && !group) return NextResponse.json({ error: "Grupo de opciones inválido" }, { status: 400 });
  const common = { name: parsed.data.name, active: parsed.data.active, sortOrder: parsed.data.sortOrder, groupId: parsed.data.groupId ?? null };
  const item =
    kind === "variant"
      ? await prisma.productVariant.update({
          where: { id },
          data: { ...common, priceAdjustment: parsed.data.price },
        })
      : await prisma.productExtra.update({
          where: { id },
          data: { ...common, price: Math.max(0, parsed.data.price) },
        });
  await recordAudit({
    context: auth,
    action: "update",
    entityType: `product-${kind}`,
    entityId: id,
    oldValues: toAuditValue(serialize(current)),
    newValues: toAuditValue(serialize(item)),
    request,
  });
  return NextResponse.json({ item: serialize(item) });
}

/** @summary Elimina una opción sin afectar productos ni pedidos ya almacenados. */
export async function DELETE(request: Request, context: { params: Promise<{ kind: string; id: string }> }) {
  const auth = await authorize("product.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { kind, id: rawId } = await context.params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || !["variant", "extra"].includes(kind))
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  const current = await currentOption(kind, id, auth.tenant.id);
  if (!current) return NextResponse.json({ error: "Opción no encontrada" }, { status: 404 });
  if (kind === "variant") await prisma.productVariant.delete({ where: { id } });
  else await prisma.productExtra.delete({ where: { id } });
  await recordAudit({
    context: auth,
    action: "delete",
    entityType: `product-${kind}`,
    entityId: id,
    oldValues: toAuditValue(serialize(current)),
    request,
  });
  return NextResponse.json({ ok: true });
}
