import { createHash } from "node:crypto";
import path from "node:path";
import { NextResponse } from "next/server";
import { recordAudit } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { documentTypeLabels, isDocumentType } from "@/lib/documents/document-fields";
import {
  DOCX_MIME,
  MAX_DOCX_TEMPLATE_BYTES,
  validateDocumentTemplate,
} from "@/lib/documents/template-engine";
import { prisma } from "@/lib/prisma";

/**
 * @summary Construye los metadatos públicos de una plantilla documental.
 */
function templateMetadata(template: {
  id: number;
  documentType: string;
  name: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  version: number;
  active: boolean;
  isDefault: boolean;
  createdAt: Date;
  deletedAt: Date | null;
}) {
  return {
    ...template,
    createdAt: template.createdAt.toISOString(),
    deletedAt: template.deletedAt?.toISOString() ?? null,
  };
}

/**
 * @summary Devuelve datos de las plantillas documentales visibles para el contexto autorizado.
 */
export async function GET() {
  const auth = await authorize("order.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const templates = await prisma.documentTemplate.findMany({
    where: { tenantId: auth.tenant.id, deletedAt: null },
    select: {
      id: true,
      documentType: true,
      name: true,
      originalFilename: true,
      mimeType: true,
      sizeBytes: true,
      version: true,
      active: true,
      isDefault: true,
      createdAt: true,
      deletedAt: true,
    },
    orderBy: [{ documentType: "asc" }, { version: "desc" }],
  });
  return NextResponse.json({ templates: templates.map(templateMetadata) });
}

/** @summary Carga o reemplaza una plantilla Word como una nueva versión inmutable. */
export async function POST(request: Request) {
  const auth = await authorize("order.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const form = await request.formData();
  const file = form.get("file");
  const requestedType = String(form.get("documentType") ?? "internal_receipt");
  const replaceId = Number(form.get("replaceId") ?? 0);
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Seleccioná un archivo Word .docx" }, { status: 400 });
  }
  if (path.extname(file.name).toLocaleLowerCase("en") !== ".docx") {
    return NextResponse.json({ error: "La extensión permitida es .docx" }, { status: 400 });
  }
  if (file.type !== DOCX_MIME) {
    return NextResponse.json(
      { error: "El tipo MIME no corresponde a un documento Word .docx" },
      { status: 400 },
    );
  }
  if (file.size <= 0 || file.size > MAX_DOCX_TEMPLATE_BYTES) {
    return NextResponse.json({ error: "La plantilla DOCX no puede superar 5 MB" }, { status: 400 });
  }

  const replaced = replaceId
    ? await prisma.documentTemplate.findFirst({
        where: { id: replaceId, tenantId: auth.tenant.id, deletedAt: null },
      })
    : null;
  if (replaceId && !replaced) {
    return NextResponse.json({ error: "La plantilla a reemplazar no existe" }, { status: 404 });
  }
  const documentType = replaced?.documentType ?? requestedType;
  if (!isDocumentType(documentType)) {
    return NextResponse.json({ error: "Seleccioná un tipo de documento válido" }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    await validateDocumentTemplate(bytes);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "La plantilla DOCX no es válida" },
      { status: 400 },
    );
  }
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const duplicate = await prisma.documentTemplate.findUnique({
    where: {
      tenantId_documentType_checksum: { tenantId: auth.tenant.id, documentType, checksum },
    },
    select: { id: true },
  });
  if (duplicate) {
    return NextResponse.json(
      { error: "Esta misma versión ya fue cargada para ese tipo de documento" },
      { status: 409 },
    );
  }

  const name =
    String(form.get("name") ?? "")
      .trim()
      .slice(0, 160) ||
    replaced?.name ||
    documentTypeLabels[documentType];
  const makeDefault = replaced?.isDefault || form.get("isDefault") === "true";
  const template = await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT id FROM tenant WHERE id = ${auth.tenant.id} FOR UPDATE`;
    const latest = await transaction.documentTemplate.findFirst({
      where: { tenantId: auth.tenant.id, documentType },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    await transaction.documentTemplate.updateMany({
      where: { tenantId: auth.tenant.id, documentType, active: true },
      data: { active: false },
    });
    if (makeDefault) {
      await transaction.documentTemplate.updateMany({
        where: { tenantId: auth.tenant.id, isDefault: true },
        data: { isDefault: false },
      });
    }
    return transaction.documentTemplate.create({
      data: {
        tenantId: auth.tenant.id,
        documentType,
        name,
        originalFilename: file.name.slice(0, 255),
        mimeType: DOCX_MIME,
        sizeBytes: bytes.byteLength,
        checksum,
        content: Buffer.from(bytes),
        version: (latest?.version ?? 0) + 1,
        active: true,
        isDefault: Boolean(makeDefault),
      },
      select: {
        id: true,
        documentType: true,
        name: true,
        originalFilename: true,
        mimeType: true,
        sizeBytes: true,
        version: true,
        active: true,
        isDefault: true,
        createdAt: true,
        deletedAt: true,
      },
    });
  });
  await recordAudit({
    context: auth,
    action: replaced ? "document-template.replace" : "document-template.create",
    entityType: "document-template",
    entityId: template.id,
    newValues: {
      documentType,
      filename: file.name,
      version: template.version,
      replacedId: replaced?.id ?? null,
    },
    request,
  });
  return NextResponse.json({ template: templateMetadata(template) }, { status: 201 });
}
