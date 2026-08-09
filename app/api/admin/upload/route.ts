import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth";
import { getAdminResource } from "@/lib/admin-resources";
import { recordAudit } from "@/lib/audit";

const folders = {
  productos: "images_product",
  categorias: "images_categories",
  eventos: "images_event",
  usuarios: "images_profile",
} as const;

const extensions = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "image/gif": ".gif",
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

/** @summary Valida y almacena una imagen dentro de la carpeta pública correspondiente al recurso. */
export async function POST(request: Request) {
  const formData = await request.formData();
  const resource = String(formData.get("resource") ?? "") as keyof typeof folders;
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

  const filename = createFilename(file.name, extension);
  const destination = path.join(process.cwd(), "public", "images", folder);
  await mkdir(destination, { recursive: true });
  await writeFile(path.join(destination, filename), new Uint8Array(await file.arrayBuffer()));

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
