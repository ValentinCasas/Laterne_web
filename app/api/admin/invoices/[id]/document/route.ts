import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth";
import { generateInvoiceDocumentArtifact } from "@/lib/documents/invoice-document";
import { DOCX_MIME } from "@/lib/documents/template-engine";
import { prisma } from "@/lib/prisma";

/**
 * @summary Normaliza un nombre de archivo antes de enviarlo como descarga.
 */
function safeFilename(value: string) {
  return (
    value
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 100) || "comprobante"
  );
}

/**
 * @summary Construye el cuerpo binario y las cabeceras de una descarga documental.
 */
function body(bytes: Uint8Array) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/**
 * @summary Resuelve el comprobante visible dentro del tenant y la sucursal autorizados.
 */
function invoiceScope(tenantId: number, activeBranchId?: number) {
  return { tenantId, ...(activeBranchId && activeBranchId > 0 ? { branchId: activeBranchId } : {}) };
}

/** @summary Genera o regenera el DOCX/PDF de un comprobante, incluidos los heredados sin archivo. */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("order.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Comprobante inválido" }, { status: 400 });
  const invoice = await prisma.invoiceRecord.findFirst({
    where: { ...invoiceScope(auth.tenant.id, auth.activeBranchId), id },
  });
  if (!invoice) return NextResponse.json({ error: "Comprobante no encontrado" }, { status: 404 });
  try {
    const document = await generateInvoiceDocumentArtifact(id, auth.tenant.id);
    return NextResponse.json({
      document: {
        pdfStatus: document.pdfStatus,
        conversionMessage: document.conversionMessage,
        templateVersion: document.templateVersion,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo generar el documento Word" },
      { status: 500 },
    );
  }
}

/**
 * @summary Devuelve datos de los comprobantes visibles para el contexto autorizado.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("order.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Comprobante inválido" }, { status: 400 });
  const invoice = await prisma.invoiceRecord.findFirst({
    where: { ...invoiceScope(auth.tenant.id, auth.activeBranchId), id },
    include: { document: true },
  });
  if (!invoice) return NextResponse.json({ error: "Comprobante no encontrado" }, { status: 404 });
  if (!invoice.document) {
    return NextResponse.json(
      { error: "Este comprobante legacy no posee un archivo Word generado" },
      { status: 409 },
    );
  }
  const format = new URL(request.url).searchParams.get("format") === "pdf" ? "pdf" : "docx";
  const download = new URL(request.url).searchParams.get("download") === "1";
  const bytes = format === "pdf" ? invoice.document.pdf : invoice.document.docx;
  if (!bytes) {
    return NextResponse.json(
      { error: invoice.document.conversionMessage || "El PDF no está disponible; descargá el DOCX" },
      { status: 409 },
    );
  }
  const filename = `${safeFilename(invoice.number || `comprobante-${invoice.id}`)}.${format}`;
  return new Response(body(bytes), {
    headers: {
      "content-type": format === "pdf" ? "application/pdf" : DOCX_MIME,
      "content-length": String(bytes.byteLength),
      "content-disposition": `${format === "pdf" && !download ? "inline" : "attachment"}; filename="${filename}"`,
      "cache-control": "private, no-store",
    },
  });
}
