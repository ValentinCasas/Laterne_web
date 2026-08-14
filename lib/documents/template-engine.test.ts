import { describe, expect, it } from "vitest";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { buildExampleDocumentTemplate } from "@/lib/documents/example-templates";
import {
  renderDocumentTemplate,
  validateDocumentTemplate,
  type InvoiceTemplateData,
} from "@/lib/documents/template-engine";

const pixel = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
const pixelData = pixel.buffer.slice(pixel.byteOffset, pixel.byteOffset + pixel.byteLength) as ArrayBuffer;

const data: InvoiceTemplateData = {
  business: { name: "Laterne", address: "Av. Principal 123", phone: "11223344", taxId: "30-12345678-9" },
  customer: { name: "Ana Pérez", phone: "1199999999", email: "ana@example.com", taxId: "" },
  order: {
    reference: "PED-001",
    date: "14/08/2026",
    deliveryType: "Retiro",
    paymentMethod: "Efectivo",
    deliveryAddress: "",
    notes: "Sin cebolla",
  },
  document: {
    number: "INT-PED-001",
    date: "14/08/2026",
    type: "Comprobante interno",
    fiscalStatus: "Documento interno no fiscal",
  },
  totals: {
    subtotal: "$ 100.000,00",
    discount: "$ 0,00",
    delivery: "$ 0,00",
    tip: "$ 0,00",
    total: "$ 100.000,00",
    currency: "ARS",
  },
  items: Array.from({ length: 30 }, (_, index) => ({
    name: `Producto ${index + 1}`,
    qty: "1",
    unitPrice: "$ 3.333,33",
    total: "$ 3.333,33",
    variant: "",
    extras: "",
    notes: "",
  })),
};

describe("motor seguro de plantillas DOCX", () => {
  it.each(["classic", "modern"] as const)("valida y rellena la plantilla %s con 30 productos e imágenes", async (variant) => {
    const template = await buildExampleDocumentTemplate(variant);
    const commands = await validateDocumentTemplate(template);
    expect(commands.some((command) => command.type === "FOR")).toBe(true);
    expect(commands.filter((command) => command.type === "IMAGE")).toHaveLength(2);

    const rendered = await renderDocumentTemplate({
      template,
      data,
      businessLogo: { width: 1.8, height: 1.8, data: pixelData, extension: ".png", alt: "Logo" },
      documentQr: { width: 2.4, height: 2.4, data: pixelData, extension: ".png", alt: "QR" },
    });
    expect(rendered[0]).toBe(0x50);
    expect(rendered[1]).toBe(0x4b);
    expect(rendered.byteLength).toBeGreaterThan(template.byteLength / 2);
  });

  it("rellena un comprobante de un solo producto", async () => {
    const template = await buildExampleDocumentTemplate("classic");
    const rendered = await renderDocumentTemplate({
      template,
      data: { ...data, items: data.items.slice(0, 1) },
      businessLogo: { width: 1.8, height: 1.8, data: pixelData, extension: ".png", alt: "Logo" },
      documentQr: { width: 2.4, height: 2.4, data: pixelData, extension: ".png", alt: "QR" },
    });
    expect(rendered[0]).toBe(0x50);
    expect(rendered[1]).toBe(0x4b);
  });

  it("rechaza contenido que no tenga estructura DOCX", async () => {
    await expect(validateDocumentTemplate(new TextEncoder().encode("no es un docx"))).rejects.toThrow();
  });

  it("rechaza comandos arbitrarios aunque el archivo sea un DOCX legítimo", async () => {
    const document = new Document({
      sections: [{ children: [new Paragraph({ children: [new TextRun("{{EXEC process.exit()}}") ] })] }],
    });
    const bytes = await Packer.toBuffer(document);
    await expect(validateDocumentTemplate(bytes)).rejects.toThrow(/no admitidos/i);
  });
});
