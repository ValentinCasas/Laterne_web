import { createHash } from "node:crypto";
import path from "node:path";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { getStorage, sanitizeStorageKey } from "@/lib/storage";
import { ensureTenantCapacity } from "@/lib/tenant-limits";

/**
 * @summary Valida la entrada relacionada con los archivos multimedia.
 */
const cropInput = z.object({ preset: z.enum(["square", "landscape", "portrait"]) });
const dimensions = {
  square: { width: 1200, height: 1200 },
  landscape: { width: 1600, height: 900 },
  portrait: { width: 1080, height: 1350 },
} as const;

/** @summary Genera una copia WebP recortada sin sobrescribir la imagen original ni romper sus usos actuales. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("media.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  const parsed = cropInput.safeParse(await request.json().catch(() => null));
  if (!Number.isInteger(id) || !parsed.success) {
    return NextResponse.json({ error: "Recorte inválido" }, { status: 400 });
  }
  const original = await prisma.mediaAsset.findFirst({
    where: { id, tenantId: auth.tenant.id },
  });
  if (!original || !original.mimeType.startsWith("image/") || original.mimeType === "image/gif") {
    return NextResponse.json({ error: "Elegí una imagen estática válida" }, { status: 400 });
  }

  const storage = getStorage();
  const sourceKey = sanitizeStorageKey(original.url);
  const sourceBytes = await storage.read(sourceKey);
  if (!sourceBytes) {
    return NextResponse.json({ error: "La imagen original ya no está disponible" }, { status: 404 });
  }

  try {
    const size = dimensions[parsed.data.preset];
    const bytes = await sharp(sourceBytes)
      .rotate()
      .resize({ ...size, fit: "cover", position: "attention" })
      .webp({ quality: 84 })
      .toBuffer();
    const checksum = createHash("sha256").update(bytes).digest("hex");
    const duplicate = await prisma.mediaAsset.findUnique({
      where: {
        tenantId_checksum_folder: {
          tenantId: auth.tenant.id,
          checksum,
          folder: original.folder,
        },
      },
      include: { user: { select: { name: true } } },
    });
    if (duplicate) return NextResponse.json({ asset: serialize(duplicate), duplicate: true });
    await ensureTenantCapacity(auth.tenant.id, "storageMb", bytes.byteLength);

    const filename = `${path.parse(original.filename).name}-${parsed.data.preset}-${Date.now()}.webp`;
    const key = `${path.posix.dirname(original.url).replace(/^\/+/, "")}/${filename}`;
    await storage.write(key, new Uint8Array(bytes), "image/webp");
    const thumbnail = await sharp(bytes)
      .resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 76 })
      .toBuffer();
    await storage.write(`images/thumbnails/${original.folder}/${filename}`, new Uint8Array(thumbnail), "image/webp");
    const url = `${path.posix.dirname(original.url)}/${filename}`;
    const asset = await prisma.mediaAsset.create({
      data: {
        tenantId: auth.tenant.id,
        userId: auth.session.userId,
        folder: original.folder,
        filename,
        url,
        thumbnailUrl: `/images/thumbnails/${original.folder}/${filename}`,
        mimeType: "image/webp",
        sizeBytes: bytes.byteLength,
        checksum,
        altText: original.altText,
        width: size.width,
        height: size.height,
      },
      include: { user: { select: { name: true } } },
    });
    await recordAudit({
      context: auth,
      action: "media.crop",
      entityType: "media",
      entityId: asset.id,
      newValues: { sourceId: original.id, preset: parsed.data.preset, filename },
      request,
    });
    return NextResponse.json({ asset: serialize(asset) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo generar el recorte" },
      { status: 400 },
    );
  }
}
