/**
 * Diseño del comprobante basado en bloques.
 *
 * Un comprobante es una lista ordenada de bloques. Dos bloques consecutivos en
 * modo "half" se agrupan en una fila de dos columnas (grid). El renderizado del
 * editor (preview) y el de impresión usan exactamente el mismo modelo.
 */

export type InvoicePreset = "compact" | "classic" | "modern";
export type InvoiceFont = "sans" | "serif" | "mono";
export type InvoiceAlign = "left" | "center" | "right";
export type InvoiceTableStyle = "compact" | "normal" | "wide";

export type InvoiceBlockType =
  | "logo"
  | "issuerName"
  | "title"
  | "number"
  | "customerData"
  | "orderData"
  | "table"
  | "subtotal"
  | "discount"
  | "delivery"
  | "total"
  | "qr"
  | "notes"
  | "customText"
  | "separator"
  | "footer";

export type InvoiceTableColumns = {
  product: boolean;
  quantity: boolean;
  unitPrice: boolean;
  total: boolean;
  variant: boolean;
  extras: boolean;
};

export type InvoiceBlock = {
  id: string;
  type: InvoiceBlockType;
  visible: boolean;
  columns?: "single" | "half";
  text?: string;
  fontSize?: number;
  bold?: boolean;
  align?: InvoiceAlign;
  color?: string | null;
  background?: string | null;
  tableColumns?: InvoiceTableColumns;
  tableStyle?: InvoiceTableStyle;
};

export type InvoiceDesign = {
  preset: InvoicePreset;
  accent: string;
  font: InvoiceFont;
  footerText: string;
  blocks: InvoiceBlock[];
};

export const invoiceFontClass: Record<InvoiceFont, string> = {
  sans: "font-sans",
  serif: "font-serif",
  mono: "font-mono",
};

export const invoicePresetLabels: Record<InvoicePreset, string> = {
  compact: "Compacto",
  classic: "Clásico",
  modern: "Moderno",
};

export const invoiceBlockLabels: Record<InvoiceBlockType, string> = {
  logo: "Logo",
  issuerName: "Nombre del negocio",
  title: "Título",
  number: "Número",
  customerData: "Datos del cliente",
  orderData: "Datos del pedido",
  table: "Tabla de productos",
  subtotal: "Subtotal",
  discount: "Descuento",
  delivery: "Delivery",
  total: "Total",
  qr: "QR",
  notes: "Observaciones",
  customText: "Texto personalizado",
  separator: "Separador",
  footer: "Pie",
};

export const invoiceTableStyleLabels: Record<InvoiceTableStyle, string> = {
  compact: "Compacta",
  normal: "Normal",
  wide: "Amplia",
};

const hexColor = (value: unknown): string | null =>
  typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value : null;

const defaultFontSize: Partial<Record<InvoiceBlockType, number>> = {
  title: 22,
  number: 14,
  notes: 12,
  customText: 12,
  footer: 11,
};

const defaultAlign: Partial<Record<InvoiceBlockType, InvoiceAlign>> = {
  title: "center",
  number: "center",
};

const defaultTableColumns: InvoiceTableColumns = {
  product: true,
  quantity: true,
  unitPrice: true,
  total: true,
  variant: false,
  extras: false,
};

/** @summary Apariencia por defecto de un bloque según su tipo. */
export function defaultBlockAppearance(type: InvoiceBlockType): Omit<InvoiceBlock, "id" | "type"> {
  const base: Omit<InvoiceBlock, "id" | "type"> = {
    visible: true,
    columns: "single",
    fontSize: defaultFontSize[type] ?? 12,
    bold: type === "total" || type === "issuerName",
    align: defaultAlign[type] ?? "left",
    color: null,
    background: null,
  };
  if (type === "title") base.text = "Comprobante interno no fiscal";
  if (type === "customText") base.text = "Texto personalizado";
  if (type === "footer") base.text = "";
  if (type === "table") {
    base.tableColumns = { ...defaultTableColumns };
    base.tableStyle = "normal";
  }
  return base;
}

/** @summary Crea un bloque con identificador estable para la sesión de edición. */
export function createBlock(type: InvoiceBlockType, id: string): InvoiceBlock {
  return { id, type, ...defaultBlockAppearance(type) };
}

/** @summary Valida y normaliza un bloque leído de base de datos. */
function sanitizeBlock(value: unknown, index: number): InvoiceBlock {
  const raw = (value ?? {}) as Partial<InvoiceBlock>;
  const knownTypes = new Set<InvoiceBlockType>([
    "logo", "issuerName", "title", "number", "customerData", "orderData", "table",
    "subtotal", "discount", "delivery", "total", "qr", "notes", "customText", "separator", "footer",
  ]);
  const type = knownTypes.has(raw.type as InvoiceBlockType)
    ? (raw.type as InvoiceBlockType)
    : "customText";
  const appearance = defaultBlockAppearance(type);
  const color = hexColor(raw.color);
  const background = hexColor(raw.background);
  const fontSize =
    typeof raw.fontSize === "number" && raw.fontSize >= 6 && raw.fontSize <= 48
      ? Math.round(raw.fontSize)
      : appearance.fontSize;
  const columns = raw.columns === "half" ? "half" : "single";
  const align = ["left", "center", "right"].includes(String(raw.align))
    ? (raw.align as InvoiceAlign)
    : appearance.align;
  const rawColumns = raw.tableColumns;
  const tableColumns: InvoiceTableColumns = {
    ...defaultTableColumns,
    ...(rawColumns && typeof rawColumns === "object" ? rawColumns : {}),
  };

  return {
    id: `${type}-${index}`,
    type,
    visible: raw.visible !== false,
    columns,
    text: typeof raw.text === "string" ? raw.text.slice(0, 600) : appearance.text,
    fontSize,
    bold: typeof raw.bold === "boolean" ? raw.bold : appearance.bold,
    align,
    color,
    background,
    ...(type === "table"
      ? {
          tableColumns,
          tableStyle: ["compact", "normal", "wide"].includes(String(raw.tableStyle))
            ? (raw.tableStyle as InvoiceTableStyle)
            : "normal",
        }
      : {}),
  };
}

/** @summary Bloques por defecto de cada preset como punto de partida del diseñador. */
export function presetBlocks(preset: InvoicePreset, accent: string): InvoiceBlock[] {
  const block = (type: InvoiceBlockType, overrides: Partial<InvoiceBlock> = {}): InvoiceBlock => ({
    id: `${type}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    ...defaultBlockAppearance(type),
    ...overrides,
  });

  const totals: InvoiceBlock[] = ["subtotal", "discount", "delivery"].map((type) =>
    block(type as InvoiceBlockType),
  );

  if (preset === "compact") {
    return [
      block("issuerName"),
      block("number"),
      block("customerData"),
      block("orderData"),
      block("table"),
      ...totals,
      block("total", { bold: true, fontSize: 16, color: accent }),
      block("footer"),
    ];
  }

  if (preset === "modern") {
    return [
      block("logo", { columns: "half" }),
      block("issuerName", { columns: "half" }),
      block("title", { text: "Comprobante interno no fiscal", color: accent, bold: true, fontSize: 24 }),
      block("number"),
      block("customerData"),
      block("orderData"),
      block("table"),
      ...totals,
      block("qr", { columns: "half" }),
      block("total", { columns: "half", bold: true, fontSize: 16, color: accent }),
      block("notes"),
      block("separator"),
      block("footer"),
    ];
  }

  return [
    block("logo", { columns: "half" }),
    block("issuerName", { columns: "half" }),
    block("title", { text: "Comprobante interno no fiscal", color: accent, bold: true, fontSize: 22 }),
    block("number"),
    block("customerData"),
    block("orderData"),
    block("table"),
    ...totals,
    block("qr", { columns: "half" }),
    block("total", { columns: "half", bold: true, fontSize: 16, color: accent }),
    block("notes"),
    block("separator"),
    block("footer"),
  ];
}

export const defaultInvoiceDesign: InvoiceDesign = {
  preset: "classic",
  accent: "#7f1d1d",
  font: "serif",
  footerText: "",
  blocks: presetBlocks("classic", "#7f1d1d"),
};

/** @summary Normaliza un diseño guardado: completa defaults y descarta estructuras inválidas. */
export function resolveInvoiceDesign(value: unknown): InvoiceDesign {
  const raw = (value ?? {}) as Partial<InvoiceDesign>;
  const preset: InvoicePreset = ["compact", "classic", "modern"].includes(String(raw.preset))
    ? (raw.preset as InvoicePreset)
    : defaultInvoiceDesign.preset;
  const accent = hexColor(raw.accent) ?? defaultInvoiceDesign.accent;
  const font: InvoiceFont = ["sans", "serif", "mono"].includes(String(raw.font))
    ? (raw.font as InvoiceFont)
    : defaultInvoiceDesign.font;
  const footerText = typeof raw.footerText === "string" ? raw.footerText.slice(0, 600) : "";
  const blocks = Array.isArray(raw.blocks)
    ? raw.blocks
        .map((block, index) => sanitizeBlock(block, index))
        .filter((block) => block.visible)
    : presetBlocks(preset, accent);
  return { preset, accent, font, footerText, blocks: blocks.length ? blocks : presetBlocks(preset, accent) };
}

/** @summary Agrupa bloques consecutivos en modo "half" por pares para armar filas de dos columnas. */
export function groupBlockRows(blocks: InvoiceBlock[]): InvoiceBlock[][] {
  const rows: InvoiceBlock[][] = [];
  for (const block of blocks) {
    if (block.columns === "half" && rows.length > 0 && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0].columns === "half") {
      rows[rows.length - 1].push(block);
    } else {
      rows.push([block]);
    }
  }
  return rows;
}