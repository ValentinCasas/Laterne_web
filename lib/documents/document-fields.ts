export const documentTypes = ["internal_receipt", "invoice_a_visual", "invoice_b_visual"] as const;
export type DocumentType = (typeof documentTypes)[number];

export const documentTypeLabels: Record<DocumentType, string> = {
  internal_receipt: "Comprobante interno",
  invoice_a_visual: "Factura A · diseño no fiscal",
  invoice_b_visual: "Factura B · diseño no fiscal",
};

export const textDocumentFields = [
  "business.name",
  "business.address",
  "business.phone",
  "business.taxId",
  "customer.name",
  "customer.phone",
  "customer.email",
  "customer.taxId",
  "order.reference",
  "order.date",
  "order.deliveryType",
  "order.paymentMethod",
  "order.deliveryAddress",
  "order.notes",
  "document.number",
  "document.date",
  "document.type",
  "document.fiscalStatus",
  "totals.subtotal",
  "totals.discount",
  "totals.delivery",
  "totals.tip",
  "totals.total",
  "totals.currency",
] as const;

export const itemDocumentFields = [
  "$item.name",
  "$item.qty",
  "$item.unitPrice",
  "$item.total",
  "$item.variant",
  "$item.extras",
  "$item.notes",
] as const;

export const documentFieldGroups = [
  {
    label: "Negocio",
    fields: ["business.name", "business.address", "business.phone", "business.taxId"],
  },
  {
    label: "Cliente",
    fields: ["customer.name", "customer.phone", "customer.email", "customer.taxId"],
  },
  {
    label: "Pedido",
    fields: [
      "order.reference",
      "order.date",
      "order.deliveryType",
      "order.paymentMethod",
      "order.deliveryAddress",
      "order.notes",
    ],
  },
  {
    label: "Documento",
    fields: ["document.number", "document.date", "document.type", "document.fiscalStatus"],
  },
  {
    label: "Totales",
    fields: [
      "totals.subtotal",
      "totals.discount",
      "totals.delivery",
      "totals.tip",
      "totals.total",
      "totals.currency",
    ],
  },
] as const;

export const itemsLoopHelp = {
  start: "{{FOR item IN items}}",
  end: "{{END-FOR item}}",
  fields: itemDocumentFields.map((field) => `{{${field}}}`),
};

export const imageDocumentFields = [
  { label: "Logo del negocio", placeholder: "{{IMAGE businessLogo()}}" },
  { label: "QR del comprobante", placeholder: "{{IMAGE documentQr()}}" },
] as const;

export function isDocumentType(value: string): value is DocumentType {
  return documentTypes.includes(value as DocumentType);
}
