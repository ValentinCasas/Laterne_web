import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

if (process.env.NODE_ENV === "production") {
  throw new Error("Este seed es exclusivo para desarrollo.");
}

const prisma = new PrismaClient();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

try {
  const tenant = await prisma.tenant.findUnique({ where: { slug: "laterne" }, select: { id: true } });
  if (!tenant) throw new Error("No existe el tenant DEV laterne.");
  const hadActive = await prisma.documentTemplate.findFirst({
    where: { tenantId: tenant.id, documentType: "internal_receipt", active: true, deletedAt: null },
    select: { id: true },
  });
  const hadDefault = await prisma.documentTemplate.findFirst({
    where: { tenantId: tenant.id, isDefault: true, deletedAt: null },
    select: { id: true },
  });

  let classicTemplateId;
  for (const entry of [
    { filename: "comprobante-clasico.docx", name: "Clásico MenuClick", preferred: true },
    { filename: "comprobante-moderno.docx", name: "Moderno MenuClick", preferred: false },
  ]) {
    const content = await readFile(path.join(root, "examples", "templates", entry.filename));
    const checksum = createHash("sha256").update(content).digest("hex");
    const existing = await prisma.documentTemplate.findUnique({
      where: {
        tenantId_documentType_checksum: {
          tenantId: tenant.id,
          documentType: "internal_receipt",
          checksum,
        },
      },
    });
    if (existing) {
      if (existing.deletedAt) {
        await prisma.documentTemplate.update({ where: { id: existing.id }, data: { deletedAt: null } });
      }
      if (entry.preferred) classicTemplateId = existing.id;
      continue;
    }
    const latest = await prisma.documentTemplate.findFirst({
      where: { tenantId: tenant.id, documentType: "internal_receipt" },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const created = await prisma.documentTemplate.create({
      data: {
        tenantId: tenant.id,
        documentType: "internal_receipt",
        name: entry.name,
        originalFilename: entry.filename,
        mimeType,
        sizeBytes: content.byteLength,
        checksum,
        content,
        version: (latest?.version ?? 0) + 1,
        active: entry.preferred && !hadActive,
        isDefault: entry.preferred && !hadDefault,
      },
    });
    if (entry.preferred) classicTemplateId = created.id;
  }

  if (classicTemplateId && !hadActive) {
    await prisma.documentTemplate.update({
      where: { id: classicTemplateId },
      data: { active: true },
    });
  }
  if (classicTemplateId && !hadDefault) {
    await prisma.documentTemplate.update({
      where: { id: classicTemplateId },
      data: { active: true, isDefault: true },
    });
  }
  console.log("Plantillas DEV de Laterne listas (seed idempotente).");
} finally {
  await prisma.$disconnect();
}
