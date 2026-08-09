import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth";
import { getAdminResource } from "@/lib/admin-resources";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

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
    const filename = createFilename(file.name, `.${extension}`);
    const relativeDirectory = path.join("models", String(auth.tenant.id), "products");
    const destination = path.join(process.cwd(), "public", relativeDirectory);
    await mkdir(destination, { recursive: true });
    await writeFile(path.join(destination, filename), bytes);
    const url = `/${relativeDirectory.replaceAll("\\", "/")}/${filename}`;

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
    if (!(file instanceof File))
      return NextResponse.json({ error: "No se recibió una imagen" }, { status: 400 });
    const extension = extensions[file.type as keyof typeof extensions];
    if (!extension || file.size > 5 * 1024 * 1024)
      return NextResponse.json({ error: "Usá JPG, PNG, WebP o AVIF de hasta 5 MB" }, { status: 400 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const checksum = createHash("sha256").update(bytes).digest("hex");
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
    const filename = createFilename(file.name, extension);
    const destination = path.join(process.cwd(), "public", "images", "images_brand");
    await mkdir(destination, { recursive: true });
    await writeFile(path.join(destination, filename), bytes);
    const url = `/images/images_brand/${filename}`;
    await prisma.mediaAsset.create({
      data: {
        tenantId: auth.tenant.id,
        userId: auth.session.userId,
        folder: "images_brand",
        filename,
        url,
        mimeType: file.type,
        sizeBytes: file.size,
        checksum,
        altText: String(formData.get("altText") ?? "").slice(0, 300) || null,
      },
    });
    return NextResponse.json({ filename, url }, { status: 201 });
  }
  const resource = resourceValue as keyof typeof folders;
  const resourceConfig = getAdminResource(resource);
  const auth = resourceConfig ? await authorize(resourceConfig.permission) : null;
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
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

  const bytes = new Uint8Array(await file.arrayBuffer());
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const existing = await prisma.mediaAsset.findUnique({
    where: {
      tenantId_checksum_folder: { tenantId: auth.tenant.id, checksum, folder },
    },
  });
  if (existing) {
    return NextResponse.json({ filename: existing.filename, url: existing.url, duplicate: true });
  }
  const filename = createFilename(file.name, extension);
  const destination = path.join(process.cwd(), "public", "images", folder);
  await mkdir(destination, { recursive: true });
  await writeFile(path.join(destination, filename), bytes);

  await prisma.mediaAsset.create({
    data: {
      tenantId: auth.tenant.id,
      userId: auth.session.userId,
      folder,
      filename,
      url: `/images/${folder}/${filename}`,
      mimeType: file.type,
      sizeBytes: file.size,
      checksum,
      altText: String(formData.get("altText") ?? "").slice(0, 300) || null,
    },
  });

  await recordAudit({
    context: auth,
    action: "upload",
    entityType: "media",
    entityId: filename,
    newValues: { resource, filename, mimeType: file.type, size: file.size },
    request,
  });

  return NextResponse.json({ filename, url: `/images/${folder}/${filename}` }, { status: 201 });
}
