import {
  DocumentTemplateManager,
  type DocumentTemplateItem,
} from "@/components/admin/document-template-manager";
import { requirePermission } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * @summary Carga la gestión de plantillas documentales del tenant autorizado.
 */
export default async function DocumentTemplatesPage() {
  const context = await requirePermission("order.manage");
  const templates = await prisma.documentTemplate.findMany({
    where: { tenantId: context.tenant.id, deletedAt: null },
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
    orderBy: [{ documentType: "asc" }, { version: "desc" }],
  });
  return (
    <DocumentTemplateManager initialTemplates={serialize(templates) as unknown as DocumentTemplateItem[]} />
  );
}
