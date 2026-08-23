import { createHash } from "node:crypto";
import path from "node:path";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { authorize } from "@/lib/auth";
import { getAdminResource } from "@/lib/admin-resources";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { getStorage } from "@/lib/storage";
import { ensureTenantCapacity } from "@/lib/tenant-limits";

/** @summary Rate limiting en memoria para uploads: 20 archivos por tenant por minuto. */
const uploadCounts = new Map<string, { count: number; resetAt: number }>();
function checkUploadRateLimit(tenantId: number): boolean {
  const now = Date.now();
  const key = String(tenantId);
  const entry = uploadCounts.get(key);
  if (!entry || entry.resetAt <= now) {
    uploadCounts.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  entry.count += 1;
  return entry.count <= 20;
}
// Limpieza periódica para evitar memory leak.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of uploadCounts) {
    if (entry.resetAt <= now) uploadCounts.delete(key);
  }
}, 120_000);

const folders = {
  productos: "images_product",
  categorias: "images_categories",
  eventos: "images_event",
  usuarios: "images_profile",
  promociones: "images_promotions",
  casos: "images_cases",
} as const;

const extensions = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "image/gif": ".gif",
} as const;

const modelLimits = {
  glb: 40 * 1024 * 1024,
  gltf: 15 * 1024 * 1024,
  usdz: 60 * 1024 * 1024,
} as const;

/** @summary Comprueba el cupo de archivos y convierte el rechazo del plan en un mensaje controlado. */
async function storageCapacityError(tenantId: number, bytes: number) {
  try {
    await ensureTenantCapacity(tenantId, "storageMb", bytes);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Se alcanzó el límite de almacenamiento";
  }
}

/** @summary Comprime una imagen, corrige su orientación y genera una miniatura manteniendo transparencias. */
async function optimizeImage(file: File, source: Uint8Array) {
  if (file.type === "image/gif") {
    const metadata = await sharp(source, { animated: true }).metadata();
    return { bytes: source, width: metadata.width ?? null, height: metadata.height ?? null, thumbnail: null };
  }
  let pipeline = sharp(source)
    .rotate()
    .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true });
  if (file.type === "image/jpeg") pipeline = pipeline.jpeg({ quality: 84, progressive: true });
  if (file.type === "image/png") pipeline = pipeline.png({ compressionLevel: 9, palette: true });
  if (file.type === "image/webp") pipeline = pipeline.webp({ quality: 84 });
  if (file.type === "image/avif") pipeline = pipeline.avif({ quality: 55 });
  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
  const thumbnail = await sharp(data)
    .resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 76 })
    .toBuffer();
  return {
    bytes: new Uint8Array(data),
    width: info.width,
    height: info.height,
    thumbnail: new Uint8Array(thumbnail),
  };
}

/** @summary Escribe la miniatura optimizada y devuelve su dirección pública cuando corresponde. */
async function writeThumbnail(folder: string, filename: string, bytes: Uint8Array | null) {
  if (!bytes) return null;
  const thumbnailName = `${path.parse(filename).name}.webp`;
  await getStorage().write(`images/thumbnails/${folder}/${thumbnailName}`, bytes, "image/webp");
  return `/images/thumbnails/${folder}/${thumbnailName}`;
}

/** @summary Genera un nombre de archivo seguro y único conservando una referencia legible. */
function createFilename(originalName: string, extension: string) {
  const base = path
    .parse(originalName)
    .name.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${base || "imagen"}-${Date.now()}${extension}`;
}

/** @summary Comprueba que un GLTF sea autónomo para evitar referencias externas rotas. */
function validateGltfDocument(bytes: Uint8Array) {
  const document = JSON.parse(new TextDecoder().decode(bytes)) as {
    asset?: { version?: string };
    buffers?: Array<{ uri?: string }>;
    images?: Array<{ uri?: string }>;
  };
  if (!document.asset?.version?.startsWith("2")) {
    throw new Error("El archivo debe utilizar glTF 2.0");
  }
  const externalResource = [...(document.buffers ?? []), ...(document.images ?? [])].some(
    (resource) => resource.uri && !resource.uri.startsWith("data:"),
  );
  if (externalResource) {
    throw new Error("El GLTF debe incluir sus recursos o convertirse a un único archivo GLB");
  }
}

/** @summary Valida extensión, tamaño y firma binaria de un modelo antes de almacenarlo. */
function validateModelFile(file: File, bytes: Uint8Array) {
  const extension = path.extname(file.name).toLowerCase().slice(1) as keyof typeof modelLimits;
  const limit = modelLimits[extension];
  if (!limit) throw new Error("Usá un archivo GLB, GLTF o USDZ");
  if (file.size > limit) {
    throw new Error(`El archivo ${extension.toUpperCase()} supera el límite permitido`);
  }

  if (extension === "glb") {
    const signature = new TextDecoder().decode(bytes.slice(0, 4));
    const version = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(4, true);
    if (signature !== "glTF" || version !== 2) throw new Error("El GLB no es un modelo glTF 2.0 válido");
  }

  if (extension === "gltf") validateGltfDocument(bytes);
  if (extension === "usdz" && (bytes[0] !== 0x50 || bytes[1] !== 0x4b)) {
    throw new Error("El USDZ no posee una estructura válida");
  }

  return extension;
}

/** @summary Guarda un modelo 3D validado en el espacio aislado del negocio activo. */
async function uploadProductModel(request: Request, formData: FormData) {
  const auth = await authorize("product.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  if (!checkUploadRateLimit(auth.tenant.id))
    return NextResponse.json({ error: "Demasiados uploads. Esperá un momento." }, { status: 429 });
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No se recibió ningún modelo" }, { status: 400 });
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const extension = validateModelFile(file, bytes);
    const checksum = createHash("sha256").update(bytes).digest("hex");
    const existing = await prisma.mediaAsset.findUnique({
      where: {
        tenantId_checksum_folder: {
          tenantId: auth.tenant.id,
          checksum,
          folder: "models_products",
        },
      },
    });
    if (existing) {
      return NextResponse.json({ filename: existing.filename, url: existing.url, duplicate: true });
    }
    const capacityError = await storageCapacityError(auth.tenant.id, file.size);
    if (capacityError) return NextResponse.json({ error: capacityError }, { status: 409 });
    const filename = createFilename(file.name, `.${extension}`);
    const relativeDirectory = path.posix.join("models", String(auth.tenant.id), "products");
    await getStorage().write(`${relativeDirectory}/${filename}`, bytes, file.type || `model/${extension}`);
    const url = `/${relativeDirectory}/${filename}`;

    await prisma.mediaAsset.create({
      data: {
        tenantId: auth.tenant.id,
        userId: auth.session.userId,
        folder: "models_products",
        filename,
        url,
        mimeType: file.type || `model/${extension}`,
        sizeBytes: file.size,
        checksum,
      },
    });

    await recordAudit({
      context: auth,
      action: "upload",
      entityType: "product-model",
      entityId: filename,
      newValues: { filename, extension, size: file.size },
      request,
    });

    return NextResponse.json({ filename, url }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo validar el modelo" },
      { status: 400 },
    );
  }
}

/** @summary Valida y almacena una imagen dentro de la carpeta pública correspondiente al recurso. */
export async function POST(request: Request) {
  const formData = await request.formData();
  const resourceValue = String(formData.get("resource") ?? "");
  if (resourceValue === "product-model") return uploadProductModel(request, formData);
  if (resourceValue === "brand-image") {
    const auth = await authorize("brand.manage");
    const file = formData.get("file");
    if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    if (!checkUploadRateLimit(auth.tenant.id))
      return NextResponse.json({ error: "Demasiados uploads. Esperá un momento." }, { status: 429 });
    if (!(file instanceof File))
      return NextResponse.json({ error: "No se recibió una imagen" }, { status: 400 });
    const extension = extensions[file.type as keyof typeof extensions];
    if (!extension || file.size > 5 * 1024 * 1024)
      return NextResponse.json({ error: "Usá JPG, PNG, WebP o AVIF de hasta 5 MB" }, { status: 400 });
    const optimized = await optimizeImage(file, new Uint8Array(await file.arrayBuffer())).catch(() => null);
    if (!optimized)
      return NextResponse.json(
        { error: "La imagen está dañada o su contenido no coincide con el formato" },
        { status: 400 },
      );
    const checksum = createHash("sha256").update(optimized.bytes).digest("hex");
    const existing = await prisma.mediaAsset.findUnique({
      where: {
        tenantId_checksum_folder: {
          tenantId: auth.tenant.id,
          checksum,
          folder: "images_brand",
        },
      },
    });
    if (existing) {
      return NextResponse.json({ filename: existing.filename, url: existing.url, duplicate: true });
    }
    const capacityError = await storageCapacityError(auth.tenant.id, optimized.bytes.byteLength);
    if (capacityError) return NextResponse.json({ error: capacityError }, { status: 409 });
    const filename = createFilename(file.name, extension);
    await getStorage().write(`images/images_brand/${filename}`, optimized.bytes, file.type);
    const url = `/images/images_brand/${filename}`;
    const thumbnailUrl = await writeThumbnail("images_brand", filename, optimized.thumbnail);
    await prisma.mediaAsset.create({
      data: {
        tenantId: auth.tenant.id,
        userId: auth.session.userId,
        folder: "images_brand",
        filename,
        url,
        thumbnailUrl,
        mimeType: file.type,
        sizeBytes: optimized.bytes.byteLength,
        checksum,
        altText: String(formData.get("altText") ?? "").slice(0, 300) || null,
        width: optimized.width,
        height: optimized.height,
      },
    });
    return NextResponse.json({ filename, url }, { status: 201 });
  }
  const resource = resourceValue as keyof typeof folders;
  const resourceConfig = getAdminResource(resource);
  const auth = resourceConfig ? await authorize(resourceConfig.permission) : null;
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  if (!checkUploadRateLimit(auth.tenant.id))
    return NextResponse.json({ error: "Demasiados uploads. Esperá un momento." }, { status: 429 });
  const file = formData.get("file");
  const folder = folders[resource];

  if (!folder || !(file instanceof File)) {
    return NextResponse.json({ error: "Archivo o recurso inválido" }, { status: 400 });
  }

  const extension = extensions[file.type as keyof typeof extensions];
  if (!extension) {
    return NextResponse.json({ error: "Usá una imagen JPG, PNG, WebP, AVIF o GIF" }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "La imagen no puede superar los 5 MB" }, { status: 400 });
  }

  const optimized = await optimizeImage(file, new Uint8Array(await file.arrayBuffer())).catch(() => null);
  if (!optimized) {
    return NextResponse.json(
      { error: "La imagen está dañada o su contenido no coincide con el formato" },
      { status: 400 },
    );
  }
  const checksum = createHash("sha256").update(optimized.bytes).digest("hex");
  const existing = await prisma.mediaAsset.findUnique({
    where: {
      tenantId_checksum_folder: { tenantId: auth.tenant.id, checksum, folder },
    },
  });
  if (existing) {
    return NextResponse.json({ filename: existing.filename, url: existing.url, duplicate: true });
  }
  const capacityError = await storageCapacityError(auth.tenant.id, optimized.bytes.byteLength);
  if (capacityError) return NextResponse.json({ error: capacityError }, { status: 409 });
  const filename = createFilename(file.name, extension);
  await getStorage().write(`images/${folder}/${filename}`, optimized.bytes, file.type);
  const thumbnailUrl = await writeThumbnail(folder, filename, optimized.thumbnail);

  await prisma.mediaAsset.create({
    data: {
      tenantId: auth.tenant.id,
      userId: auth.session.userId,
      folder,
      filename,
      url: `/images/${folder}/${filename}`,
      thumbnailUrl,
      mimeType: file.type,
      sizeBytes: optimized.bytes.byteLength,
      checksum,
      altText: String(formData.get("altText") ?? "").slice(0, 300) || null,
      width: optimized.width,
      height: optimized.height,
    },
  });

  await recordAudit({
    context: auth,
    action: "upload",
    entityType: "media",
    entityId: filename,
    newValues: { resource, filename, mimeType: file.type, size: optimized.bytes.byteLength },
    request,
  });

  return NextResponse.json({ filename, url: `/images/${folder}/${filename}` }, { status: 201 });
}
