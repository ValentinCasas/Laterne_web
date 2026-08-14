import createReport, { listCommands } from "docx-templates";
import type { ImagePars } from "docx-templates/lib/types";
import { itemDocumentFields, textDocumentFields } from "@/lib/documents/document-fields";

export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const MAX_DOCX_TEMPLATE_BYTES = 5 * 1024 * 1024;
export const DOCX_COMMAND_DELIMITER: [string, string] = ["{{", "}}"];

export type InvoiceTemplateData = {
  business: { name: string; address: string; phone: string; taxId: string };
  customer: { name: string; phone: string; email: string; taxId: string };
  order: {
    reference: string;
    date: string;
    deliveryType: string;
    paymentMethod: string;
    deliveryAddress: string;
    notes: string;
  };
  document: { number: string; date: string; type: string; fiscalStatus: string };
  totals: { subtotal: string; discount: string; delivery: string; tip: string; total: string; currency: string };
  items: Array<{
    name: string;
    qty: string;
    unitPrice: string;
    total: string;
    variant: string;
    extras: string;
    notes: string;
  }>;
};

const textFields = new Set<string>(textDocumentFields);
const itemFields = new Set<string>(itemDocumentFields);
const imageCommands = new Set(["businessLogo()", "documentQr()"]);

function normalizeCommand(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function arrayBuffer(bytes: Uint8Array) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** @summary Valida estructura DOCX y limita sus comandos al contrato seguro documentado por MenuClick. */
export async function validateDocumentTemplate(bytes: Uint8Array) {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_DOCX_TEMPLATE_BYTES) {
    throw new Error("La plantilla debe pesar entre 1 byte y 5 MB");
  }
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new Error("El archivo no posee una estructura DOCX válida");
  }

  let commands: Awaited<ReturnType<typeof listCommands>>;
  try {
    commands = await listCommands(arrayBuffer(bytes), DOCX_COMMAND_DELIMITER);
  } catch {
    throw new Error("Word no puede leer la estructura de esta plantilla DOCX");
  }
  if (commands.length === 0) {
    throw new Error("La plantilla no contiene ningún campo compatible de MenuClick");
  }

  const errors: string[] = [];
  for (const command of commands) {
    const code = normalizeCommand(command.code);
    const valid =
      (command.type === "INS" && (textFields.has(code) || itemFields.has(code))) ||
      (command.type === "FOR" && code === "item IN items") ||
      (command.type === "END-FOR" && code === "item") ||
      (command.type === "IMAGE" && imageCommands.has(code));
    if (!valid) errors.push(`{{${command.raw.trim()}}}`);
  }
  if (errors.length) {
    throw new Error(`La plantilla contiene campos o comandos no admitidos: ${errors.slice(0, 4).join(", ")}`);
  }
  const starts = commands.filter((command) => command.type === "FOR").length;
  const ends = commands.filter((command) => command.type === "END-FOR").length;
  if (starts !== ends) throw new Error("El loop de productos no está cerrado correctamente");
  return commands;
}

/** @summary Rellena el mismo Word que luego se convierte a PDF, incluyendo loops e imágenes reales. */
export async function renderDocumentTemplate({
  template,
  data,
  businessLogo,
  documentQr,
}: {
  template: Uint8Array;
  data: InvoiceTemplateData;
  businessLogo: ImagePars;
  documentQr: ImagePars;
}) {
  await validateDocumentTemplate(template);
  return createReport({
    template,
    data,
    cmdDelimiter: DOCX_COMMAND_DELIMITER,
    noSandbox: false,
    rejectNullish: false,
    failFast: true,
    fixSmartQuotes: true,
    processLineBreaks: true,
    processLineBreaksAsNewText: true,
    maximumWalkingDepth: 10_000,
    additionalJsContext: {
      businessLogo: () => businessLogo,
      documentQr: () => documentQr,
    },
  });
}
