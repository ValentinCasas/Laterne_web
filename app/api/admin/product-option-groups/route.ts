import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const input = z.object({
  productId: z.coerce.number().int().positive(),
  kind: z.enum(["variant", "extra"]),
  name: z.string().trim().min(1).max(120),
  required: z.boolean().default(false),
  minSelections: z.coerce.number().int().min(0).max(50).default(0),
  maxSelections: z.coerce.number().int().min(1).max(50).default(1),
  sortOrder: z.coerce.number().int().min(-1000).max(1000).default(0),
});

/**
 * @summary Procesa una creación o acción de los grupos de opciones de producto tras validar contexto y permisos.
 */
export async function POST(request: Request) {
  const auth = await authorize("product.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.minSelections > parsed.data.maxSelections)
    return NextResponse.json({ error: "Revisá los límites de selección" }, { status: 400 });
  const product = await prisma.product.findFirst({
    where: { id: parsed.data.productId, tenantId: auth.tenant.id },
    select: { id: true },
  });
  if (!product) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  const group = await prisma.productOptionGroup.create({
    data: { ...parsed.data, tenantId: auth.tenant.id },
  });
  await recordAudit({
    context: auth,
    action: "create",
    entityType: "product-option-group",
    entityId: group.id,
    newValues: toAuditValue(serialize(group)),
    request,
  });
  return NextResponse.json({ group: serialize(group) }, { status: 201 });
}
