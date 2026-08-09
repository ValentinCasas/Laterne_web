import { unlink } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const mediaUpdate = z.object({ altText: z.string().trim().max(300).optional() });

/** @summary Cuenta referencias vigentes para impedir que un archivo utilizado se elimine. */
async function usageCount(tenantId: number, url: string, filename: string) {
  const [products, categories, events, users, promotions, brands, cases] = await Promise.all([
    prisma.product.count({
      where: {
        tenantId,
        OR: [{ imageUrl: filename }, { model3dUrl: url }, { usdzUrl: url }, { modelPosterUrl: url }],
      },
    }),
    prisma.category.count({ where: { tenantId, imageUrl: filename } }),
    prisma.event.count({ where: { tenantId, imageUrl: filename } }),
    prisma.tenantMembership.count({ where: { tenantId, user: { imageUrl: filename } } }),
    prisma.promotion.count({ where: { tenantId, imageUrl: filename } }),
    prisma.brandSettings.count({
      where: { tenantId, OR: [{ logoUrl: url }, { isotypeUrl: url }, { faviconUrl: url }] },
    }),
    prisma.successCase.count({
      where: { tenantId, OR: [{ logoUrl: filename }, { coverUrl: filename }] },
    }),
  ]);
  return products + categories + events + users + promotions + brands + cases;
}

/** @summary Actualiza el texto alternativo de un recurso multimedia del negocio. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("media.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  const parsed = mediaUpdate.safeParse(await request.json().catch(() => null));
  if (!Number.isInteger(id) || !parsed.success)
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  const current = await prisma.mediaAsset.findFirst({ where: { id, tenantId: auth.tenant.id } });
  if (!current) return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
  const asset = await prisma.mediaAsset.update({
    where: { id },
    data: { altText: parsed.data.altText || null },
  });
  return NextResponse.json({ asset: serialize(asset) });
}

/** @summary Elimina un archivo sin uso después de validar su ruta física y conservar auditoría. */
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("media.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Identificador inválido" }, { status: 400 });
  const asset = await prisma.mediaAsset.findFirst({ where: { id, tenantId: auth.tenant.id } });
  if (!asset) return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
  const usages = await usageCount(auth.tenant.id, asset.url, asset.filename);
  if (usages > 0)
    return NextResponse.json(
      { error: `El archivo está siendo utilizado en ${usages} registro${usages === 1 ? "" : "s"}.` },
      { status: 409 },
    );
  const publicRoot = path.resolve(process.cwd(), "public");
  const target = path.resolve(publicRoot, `.${asset.url}`);
  if (!target.toLocaleLowerCase("en").startsWith(`${publicRoot.toLocaleLowerCase("en")}${path.sep}`))
    return NextResponse.json({ error: "Ruta de archivo inválida" }, { status: 400 });
  await unlink(target).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
  await prisma.mediaAsset.delete({ where: { id } });
  await recordAudit({
    context: auth,
    action: "delete",
    entityType: "media",
    entityId: id,
    oldValues: toAuditValue(serialize(asset)),
    request,
  });
  return NextResponse.json({ ok: true });
}
