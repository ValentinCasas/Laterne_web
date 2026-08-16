import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { DOCX_MIME } from "@/lib/documents/template-engine";
import { prisma } from "@/lib/prisma";

/**
 * @summary Valida la entrada relacionada con las plantillas documentales.
 */
const updateInput = z.object({
  active: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

/**
 * @summary Normaliza un nombre de archivo antes de enviarlo como descarga.
 */
function safeFilename(value: string) {
  return value.replace(/[\r\n"\\/]/g, "-").slice(0, 180) || "plantilla.docx";
}

/**
 * @summary Devuelve datos de las plantillas documentales visibles para el contexto autorizado.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("order.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Plantilla inválida" }, { status: 400 });
  const template = await prisma.documentTemplate.findFirst({
    where: { id, tenantId: auth.tenant.id, deletedAt: null },
  });
  if (!template) return NextResponse.json({ error: "Plantilla no encontrada" }, { status: 404 });
  return new Response(template.content, {
    headers: {
      "content-type": DOCX_MIME,
      "content-length": String(template.sizeBytes),
      "content-disposition": `attachment; filename="${safeFilename(template.originalFilename)}"`,
      "cache-control": "private, no-store",
    },
  });
}

/** @summary Activa una versión existente o la define como respaldo del tenant. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("order.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  const parsed = updateInput.safeParse(await request.json().catch(() => null));
  if (!Number.isInteger(id) || !parsed.success) {
    return NextResponse.json({ error: "Cambio de plantilla inválido" }, { status: 400 });
  }
  const current = await prisma.documentTemplate.findFirst({
    where: { id, tenantId: auth.tenant.id, deletedAt: null },
  });
  if (!current) return NextResponse.json({ error: "Plantilla no encontrada" }, { status: 404 });

  const activate = parsed.data.active === true || parsed.data.isDefault === true;
  const updated = await prisma.$transaction(async (transaction) => {
    if (activate) {
      await transaction.documentTemplate.updateMany({
        where: { tenantId: auth.tenant.id, documentType: current.documentType, active: true },
        data: { active: false },
      });
    }
    if (parsed.data.isDefault === true) {
      await transaction.documentTemplate.updateMany({
        where: { tenantId: auth.tenant.id, isDefault: true },
        data: { isDefault: false },
      });
    }
    return transaction.documentTemplate.update({
      where: { id },
      data: {
        ...(parsed.data.active !== undefined ? { active: parsed.data.active } : {}),
        ...(parsed.data.isDefault !== undefined ? { isDefault: parsed.data.isDefault } : {}),
        ...(activate ? { active: true } : {}),
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
      },
    });
  });
  await recordAudit({
    context: auth,
    action: "document-template.activate",
    entityType: "document-template",
    entityId: id,
    newValues: { active: updated.active, isDefault: updated.isDefault },
    request,
  });
  return NextResponse.json({ template: { ...updated, createdAt: updated.createdAt.toISOString() } });
}

/** @summary Oculta una plantilla sin borrar versiones utilizadas por comprobantes históricos. */
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("order.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Plantilla inválida" }, { status: 400 });
  const current = await prisma.documentTemplate.findFirst({
    where: { id, tenantId: auth.tenant.id, deletedAt: null },
  });
  if (!current) return NextResponse.json({ error: "Plantilla no encontrada" }, { status: 404 });
  const deletedAt = new Date();
  await prisma.$transaction(async (transaction) => {
    await transaction.documentTemplate.update({
      where: { id },
      data: { active: false, isDefault: false, deletedAt },
    });
    if (current.active) {
      const replacement = await transaction.documentTemplate.findFirst({
        where: {
          tenantId: auth.tenant.id,
          documentType: current.documentType,
          id: { not: id },
          deletedAt: null,
        },
        orderBy: { version: "desc" },
      });
      if (replacement) {
        await transaction.documentTemplate.update({
          where: { id: replacement.id },
          data: { active: true, isDefault: current.isDefault },
        });
      }
    }
  });
  await recordAudit({
    context: auth,
    action: "document-template.delete",
    entityType: "document-template",
    entityId: id,
    oldValues: { name: current.name, version: current.version },
    newValues: { deletedAt: deletedAt.toISOString() },
    request,
  });
  return NextResponse.json({ ok: true });
}
