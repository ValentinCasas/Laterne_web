import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const optionInput = z.object({
  kind: z.enum(["variant", "extra"]),
  productId: z.coerce.number().int().positive(),
  name: z.string().trim().min(1).max(120),
  price: z.coerce.number().min(-1_000_000).max(1_000_000),
  active: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(-1000).max(1000).default(0),
  groupId: z.coerce.number().int().positive().optional().nullable(),
});

/** @summary Crea una variante o agregado después de comprobar que el producto pertenece al negocio. */
export async function POST(request: Request) {
  const auth = await authorize("product.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = optionInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisá los datos de la opción" }, { status: 400 });
  const product = await prisma.product.findFirst({
    where: { id: parsed.data.productId, tenantId: auth.tenant.id },
    select: { id: true },
  });
  if (!product) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  if (parsed.data.groupId) {
    const group = await prisma.productOptionGroup.findFirst({ where: { id: parsed.data.groupId, tenantId: auth.tenant.id, productId: product.id, kind: parsed.data.kind } });
    if (!group) return NextResponse.json({ error: "Grupo de opciones inválido" }, { status: 400 });
  }
  const common = {
    tenantId: auth.tenant.id,
    productId: product.id,
    name: parsed.data.name,
    active: parsed.data.active,
    sortOrder: parsed.data.sortOrder,
  };
  const item =
    parsed.data.kind === "variant"
     ? await prisma.productVariant.create({ data: { ...common, groupId: parsed.data.groupId ?? null, priceAdjustment: parsed.data.price } })
       : await prisma.productExtra.create({ data: { ...common, groupId: parsed.data.groupId ?? null, price: Math.max(0, parsed.data.price) } });
  await recordAudit({
    context: auth,
    action: "create",
    entityType: `product-${parsed.data.kind}`,
    entityId: item.id,
    newValues: toAuditValue(serialize(item)),
    request,
  });
  return NextResponse.json({ item: serialize(item) }, { status: 201 });
}
