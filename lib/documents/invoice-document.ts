import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ImagePars } from "docx-templates/lib/types";
import QRCode from "qrcode";
import sharp from "sharp";
import { getDocumentConverter } from "@/lib/documents/converter";
import { documentTypeLabels, isDocumentType, type DocumentType } from "@/lib/documents/document-fields";
import { buildExampleDocumentTemplate } from "@/lib/documents/example-templates";
import { renderDocumentTemplate, type InvoiceTemplateData } from "@/lib/documents/template-engine";
import { prisma } from "@/lib/prisma";

/**
 * @summary Obtiene un ArrayBuffer exacto a partir de bytes almacenados.
 */
function bytesArrayBuffer(bytes: Uint8Array) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/**
 * @summary Formatea un importe con la moneda y configuración regional del comprobante.
 */
function money(value: number, currency: string) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency }).format(value);
}

/**
 * @summary Devuelve la etiqueta legible de una modalidad de pedido.
 */
function orderTypeLabel(value: string) {
  const labels: Record<string, string> = {
    dine_in: "Mesa",
    takeaway: "Retiro",
    delivery: "Delivery",
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

/**
 * @summary Devuelve la etiqueta legible de un medio de pago.
 */
function paymentLabel(value: string) {
  const labels: Record<string, string> = {
    cash: "Efectivo",
    card: "Tarjeta",
    transfer: "Transferencia",
    on_delivery: "Al recibir",
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

/**
 * @summary Resume variantes y agregados de un ítem del pedido.
 */
function extrasText(value: unknown) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value
    .map((entry) => {
      if (typeof entry === "string") return entry;
      if (entry && typeof entry === "object" && typeof (entry as { name?: unknown }).name === "string") {
        return (entry as { name: string }).name;
      }
      return "";
    })
    .filter(Boolean)
    .join(", ");
}

/**
 * @summary Resuelve el logotipo que se insertará en el documento.
 */
async function logoSource(logoUrl: string | null | undefined, businessName: string) {
  if (logoUrl?.startsWith("data:image/")) {
    const match = logoUrl.match(/^data:image\/(?:png|jpeg|jpg|webp);base64,(.+)$/i);
    if (match) return Buffer.from(match[1], "base64");
  }
  if (logoUrl?.startsWith("/")) {
    const publicRoot = path.resolve(process.cwd(), "public");
    const candidate = path.resolve(publicRoot, `.${logoUrl.split("?")[0]}`);
    if (candidate === publicRoot || candidate.startsWith(`${publicRoot}${path.sep}`)) {
      try {
        return await readFile(candidate);
      } catch {
        // El monograma generado debajo mantiene la plantilla funcional.
      }
    }
  }
  const initials =
    businessName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase())
      .join("") || "MC";
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300"><rect width="600" height="300" rx="48" fill="#18181b"/><text x="300" y="185" text-anchor="middle" font-family="Arial,sans-serif" font-size="128" font-weight="700" fill="#ffffff">${initials.replace(/[<>&]/g, "")}</text></svg>`,
  );
}

/**
 * @summary Carga y prepara las imágenes utilizadas por una plantilla documental.
 */
async function documentImages(businessName: string, logoUrl: string | null | undefined, qrText: string) {
  const [logo, qr] = await Promise.all([
    sharp(await logoSource(logoUrl, businessName))
      .resize(700, 300, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toBuffer(),
    QRCode.toBuffer(qrText, { type: "png", width: 420, margin: 1, errorCorrectionLevel: "M" }),
  ]);
  const businessLogo: ImagePars = {
    width: 3.5,
    height: 1.5,
    data: bytesArrayBuffer(logo),
    extension: ".png",
    alt: `Logo de ${businessName}`,
  };
  const documentQr: ImagePars = {
    width: 2.5,
    height: 2.5,
    data: bytesArrayBuffer(qr),
    extension: ".png",
    alt: "QR del comprobante",
  };
  return { businessLogo, documentQr };
}

/** @summary Genera y persiste el DOCX/PDF del comprobante para preservar su versión histórica. */
export async function generateInvoiceDocumentArtifact(
  invoiceId: number,
  tenantId: number,
  options: { force?: boolean } = {},
) {
  const existing = await prisma.invoiceDocumentArtifact.findUnique({ where: { invoiceId } });
  if (existing && !options.force) return existing;

  const invoice = await prisma.invoiceRecord.findFirst({
    where: { id: invoiceId, tenantId },
    include: {
      branch: true,
      order: { include: { items: true } },
      tenant: { include: { brandSettings: true, businessInfo: true, invoiceSettings: true } },
    },
  });
  if (!invoice) throw new Error("Comprobante no encontrado");
  const rawType = invoice.documentType;
  const documentType: DocumentType = isDocumentType(rawType) ? rawType : "internal_receipt";
  const typeTemplate = await prisma.documentTemplate.findFirst({
    where: {
      tenantId,
      deletedAt: null,
      active: true,
      documentType,
    },
    orderBy: { version: "desc" },
  });
  const selectedTemplate =
    typeTemplate ??
    (await prisma.documentTemplate.findFirst({
      where: { tenantId, deletedAt: null, active: true, isDefault: true },
      orderBy: { version: "desc" },
    }));
  const settings = invoice.tenant.invoiceSettings;
  const businessName = settings?.issuerName?.trim() || invoice.tenant.name;
  const address =
    settings?.address?.trim() || invoice.branch?.address || invoice.tenant.businessInfo?.address || "";
  const phone =
    invoice.branch?.phone ||
    (invoice.tenant.businessInfo?.phoneNumber ? String(invoice.tenant.businessInfo.phoneNumber) : "");
  const currency = invoice.currency;
  const dateFormat = new Intl.DateTimeFormat("es-AR", {
    timeZone: invoice.tenant.timeZone,
    dateStyle: "short",
    timeStyle: "short",
  });
  const fiscalStatus =
    documentType === "internal_receipt"
      ? "Documento interno no fiscal. No constituye una factura fiscal emitida."
      : `${documentTypeLabels[documentType]}: plantilla visual sin emisión fiscal ni CAE.`;
  const data: InvoiceTemplateData = {
    business: {
      name: businessName,
      address: [address, settings?.city].filter(Boolean).join(", "),
      phone,
      taxId: settings?.taxId || "",
    },
    customer: {
      name: invoice.customerName,
      phone: invoice.order.phone,
      email: invoice.order.email || "",
      taxId: invoice.customerTaxId || "",
    },
    order: {
      reference: invoice.order.reference,
      date: dateFormat.format(invoice.order.createdAt),
      deliveryType: orderTypeLabel(invoice.order.orderType),
      paymentMethod: paymentLabel(invoice.order.paymentMethod),
      deliveryAddress: invoice.order.deliveryAddress || "",
      notes: invoice.order.notes || invoice.notes || "",
    },
    document: {
      number: invoice.number || `INT-${invoice.order.reference}`,
      date: dateFormat.format(invoice.issuedAt ?? invoice.createdAt),
      type: documentTypeLabels[documentType],
      fiscalStatus,
    },
    totals: {
      subtotal: money(Number(invoice.subtotal), currency),
      discount: money(Number(invoice.order.discount), currency),
      delivery: money(Number(invoice.order.deliveryFee), currency),
      tip: money(Number(invoice.order.tip), currency),
      total: money(Number(invoice.total), currency),
      currency,
    },
    items: invoice.order.items.map((item) => ({
      name: item.productName,
      qty: String(item.quantity),
      unitPrice: money(item.quantity > 0 ? Number(item.lineTotal) / item.quantity : 0, currency),
      total: money(Number(item.lineTotal), currency),
      variant: item.variantName || "",
      extras: extrasText(item.extras),
      notes: item.notes || "",
    })),
  };
  const images = await documentImages(
    businessName,
    invoice.tenant.brandSettings?.logoUrl,
    invoice.number || `INT-${invoice.order.reference}`,
  );

  let template = selectedTemplate
    ? new Uint8Array(selectedTemplate.content)
    : await buildExampleDocumentTemplate("classic");
  let templateId = selectedTemplate?.id ?? null;
  let templateVersion = selectedTemplate?.version ?? null;
  let templateWarning = "";
  let docx: Uint8Array;
  try {
    docx = await renderDocumentTemplate({ template, data, ...images });
  } catch (error) {
    if (!selectedTemplate) throw error;
    template = await buildExampleDocumentTemplate("classic");
    templateId = null;
    templateVersion = null;
    templateWarning = "La plantilla configurada falló y se utilizó el fallback clásico de MenuClick. ";
    docx = await renderDocumentTemplate({ template, data, ...images });
  }

  const conversion = await getDocumentConverter().convert(docx);
  if (existing) {
    await prisma.invoiceDocumentArtifact.delete({ where: { invoiceId } });
  }
  return prisma.invoiceDocumentArtifact.create({
    data: {
      tenantId,
      invoiceId,
      templateId,
      templateVersion,
      docx: Buffer.from(docx),
      pdf: conversion.pdf ? Buffer.from(conversion.pdf) : null,
      pdfStatus: conversion.status,
      converter: conversion.converter || null,
      conversionMessage: `${templateWarning}${conversion.message}`.slice(0, 500),
    },
  });
}
