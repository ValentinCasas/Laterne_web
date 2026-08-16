import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

export type ExampleTemplateVariant = "classic" | "modern";

const command = (value: string, options: { bold?: boolean; size?: number; color?: string } = {}) =>
  new TextRun({ text: `{{${value}}}`, ...options });

const text = (value: string, options: { bold?: boolean; size?: number; color?: string } = {}) =>
  new TextRun({ text: value, ...options });

/**
 * @summary Construye una celda reutilizable para las tablas de una plantilla de ejemplo.
 */
function cell(children: Paragraph[], options: { fill?: string; width?: number } = {}) {
  return new TableCell({
    children,
    ...(options.fill ? { shading: { type: ShadingType.CLEAR, color: "auto", fill: options.fill } } : {}),
    ...(options.width ? { width: { size: options.width, type: WidthType.PERCENTAGE } } : {}),
    margins: { top: 100, bottom: 100, left: 120, right: 120 },
  });
}

/**
 * @summary Construye las filas de productos de una plantilla de comprobante.
 */
function itemRows(headerFill: string, headerColor = "FFFFFF") {
  return [
    new TableRow({
      tableHeader: true,
      children: [
        cell([new Paragraph({ children: [text("Producto", { bold: true, color: headerColor })] })], {
          fill: headerFill,
          width: 52,
        }),
        cell(
          [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [text("Cant.", { bold: true, color: headerColor })],
            }),
          ],
          { fill: headerFill, width: 12 },
        ),
        cell(
          [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [text("Unitario", { bold: true, color: headerColor })],
            }),
          ],
          { fill: headerFill, width: 18 },
        ),
        cell(
          [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [text("Total", { bold: true, color: headerColor })],
            }),
          ],
          { fill: headerFill, width: 18 },
        ),
      ],
    }),
    new TableRow({
      children: [
        cell([new Paragraph({ children: [command("FOR item IN items")] })]),
        cell([new Paragraph("")]),
        cell([new Paragraph("")]),
        cell([new Paragraph("")]),
      ],
    }),
    new TableRow({
      children: [
        cell([
          new Paragraph({ children: [command("$item.name", { bold: true })] }),
          new Paragraph({ children: [command("$item.variant", { color: "666666", size: 18 })] }),
          new Paragraph({ children: [command("$item.extras", { color: "666666", size: 18 })] }),
        ]),
        cell([new Paragraph({ alignment: AlignmentType.CENTER, children: [command("$item.qty")] })]),
        cell([new Paragraph({ alignment: AlignmentType.RIGHT, children: [command("$item.unitPrice")] })]),
        cell([
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [command("$item.total", { bold: true })],
          }),
        ]),
      ],
    }),
    new TableRow({
      children: [
        cell([new Paragraph({ children: [command("END-FOR item")] })]),
        cell([new Paragraph("")]),
        cell([new Paragraph("")]),
        cell([new Paragraph("")]),
      ],
    }),
  ];
}

/**
 * @summary Construye la tabla de subtotales, descuentos y total del comprobante.
 */
function totalsTable(fill?: string) {
  const rows = [
    ["Subtotal", "totals.subtotal"],
    ["Descuento", "totals.discount"],
    ["Envío", "totals.delivery"],
    ["Propina", "totals.tip"],
    ["TOTAL", "totals.total"],
  ];
  return new Table({
    width: { size: 45, type: WidthType.PERCENTAGE },
    alignment: AlignmentType.RIGHT,
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: rows.map(
      ([label, field], index) =>
        new TableRow({
          children: [
            cell(
              [new Paragraph({ children: [text(label, { bold: index === rows.length - 1 })] })],
              index === rows.length - 1 && fill ? { fill } : {},
            ),
            cell(
              [new Paragraph({ alignment: AlignmentType.RIGHT, children: [command(field, { bold: true })] })],
              index === rows.length - 1 && fill ? { fill } : {},
            ),
          ],
        }),
    ),
  });
}

/**
 * @summary Genera el documento de ejemplo con el diseño clásico.
 */
function classicTemplate() {
  return new Document({
    creator: "MenuClick",
    title: "Plantilla clásica de comprobante interno",
    sections: [
      {
        properties: { page: { margin: { top: 850, right: 850, bottom: 850, left: 850 } } },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [text("Documento interno no fiscal · "), command("document.number")],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [command("IMAGE businessLogo()")],
            spacing: { after: 80 },
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [command("business.name", { bold: true, size: 34 })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [command("business.address"), text(" · "), command("business.phone")],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [text("CUIT/ID: "), command("business.taxId")],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 280, after: 260 },
            children: [
              text("COMPROBANTE ", { bold: true, size: 28 }),
              command("document.number", { bold: true, size: 28 }),
            ],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  cell(
                    [
                      new Paragraph({ children: [text("CLIENTE", { bold: true, color: "7F1D1D" })] }),
                      new Paragraph({ children: [command("customer.name", { bold: true })] }),
                      new Paragraph({
                        children: [command("customer.phone"), text(" · "), command("customer.email")],
                      }),
                    ],
                    { width: 50 },
                  ),
                  cell(
                    [
                      new Paragraph({ children: [text("PEDIDO", { bold: true, color: "7F1D1D" })] }),
                      new Paragraph({ children: [command("order.reference", { bold: true })] }),
                      new Paragraph({
                        children: [command("order.date"), text(" · "), command("order.deliveryType")],
                      }),
                    ],
                    { width: 50 },
                  ),
                ],
              }),
            ],
          }),
          new Paragraph({ spacing: { before: 260 } }),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: itemRows("7F1D1D") }),
          new Paragraph({ spacing: { before: 220 } }),
          totalsTable(),
          new Paragraph({
            spacing: { before: 220 },
            children: [text("Observaciones", { bold: true, color: "7F1D1D" })],
          }),
          new Paragraph({ children: [command("order.notes")] }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 220 },
            children: [command("IMAGE documentQr()")],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [text("Gracias por tu compra.", { bold: true })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [command("document.fiscalStatus", { color: "7F1D1D" })],
          }),
        ],
      },
    ],
  });
}

/**
 * @summary Genera el documento de ejemplo con el diseño moderno.
 */
function modernTemplate() {
  return new Document({
    creator: "MenuClick",
    title: "Plantilla moderna de comprobante interno",
    sections: [
      {
        properties: { page: { margin: { top: 650, right: 650, bottom: 650, left: 650 } } },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [command("business.name"), text(" · "), command("document.fiscalStatus")],
              }),
            ],
          }),
        },
        children: [
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  cell(
                    [
                      new Paragraph({ children: [command("IMAGE businessLogo()")] }),
                      new Paragraph({
                        children: [command("business.name", { bold: true, size: 34, color: "FFFFFF" })],
                      }),
                      new Paragraph({ children: [command("business.address", { color: "D1FAE5" })] }),
                    ],
                    { fill: "0F766E", width: 62 },
                  ),
                  cell(
                    [
                      new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        children: [text("COMPROBANTE", { bold: true, color: "0F766E" })],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        children: [command("document.number", { bold: true, size: 28, color: "0F766E" })],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        children: [command("document.date", { color: "475569" })],
                      }),
                    ],
                    { fill: "ECFDF5", width: 38 },
                  ),
                ],
              }),
            ],
          }),
          new Paragraph({ spacing: { before: 240 } }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
              insideHorizontal: { style: BorderStyle.NONE },
              insideVertical: { style: BorderStyle.NONE },
            },
            rows: [
              new TableRow({
                children: [
                  cell(
                    [
                      new Paragraph({ children: [text("Cliente", { bold: true, color: "0F766E" })] }),
                      new Paragraph({ children: [command("customer.name", { bold: true })] }),
                      new Paragraph({ children: [command("customer.email")] }),
                    ],
                    { width: 45 },
                  ),
                  cell(
                    [
                      new Paragraph({ children: [text("Pedido", { bold: true, color: "0F766E" })] }),
                      new Paragraph({ children: [command("order.reference", { bold: true })] }),
                      new Paragraph({
                        children: [
                          command("order.deliveryType"),
                          text(" · "),
                          command("order.paymentMethod"),
                        ],
                      }),
                    ],
                    { width: 35 },
                  ),
                  cell(
                    [
                      new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        children: [command("IMAGE documentQr()")],
                      }),
                    ],
                    { width: 20 },
                  ),
                ],
              }),
            ],
          }),
          new Paragraph({ spacing: { before: 220 } }),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: itemRows("0F766E") }),
          new Paragraph({ spacing: { before: 220 } }),
          totalsTable("CCFBF1"),
          new Paragraph({
            spacing: { before: 220 },
            children: [text("Notas del pedido", { bold: true, color: "0F766E" })],
          }),
          new Paragraph({ children: [command("order.notes")] }),
          new Paragraph({
            spacing: { before: 180 },
            children: [command("document.fiscalStatus", { bold: true, color: "B45309" })],
          }),
        ],
      },
    ],
  });
}

/** @summary Construye una plantilla DOCX real para descarga, respaldo y pruebas. */
export async function buildExampleDocumentTemplate(variant: ExampleTemplateVariant) {
  return Packer.toBuffer(variant === "modern" ? modernTemplate() : classicTemplate());
}
