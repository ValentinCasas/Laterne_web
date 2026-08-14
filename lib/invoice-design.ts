export type InvoicePreset = "compact" | "classic" | "modern";
export type InvoiceFont = "sans" | "serif" | "mono";

export type InvoiceDesign = {
  preset: InvoicePreset;
  accent: string;
  font: InvoiceFont;
  showLogo: boolean;
  showIssuerAddress: boolean;
  showTaxId: boolean;
  showQr: boolean;
  showColumns: boolean;
  showSubtotal: boolean;
  showDiscounts: boolean;
  showDelivery: boolean;
  showTotal: boolean;
  showNotes: boolean;
  showFooter: boolean;
  footerText: string;
};

export const invoicePresetDefaults: Record<InvoicePreset, Partial<InvoiceDesign>> = {
  compact: {
    accent: "#18181b",
    font: "sans",
    showLogo: false,
    showQr: false,
    showFooter: false,
  },
  classic: {
    accent: "#7f1d1d",
    font: "serif",
    showLogo: true,
    showQr: true,
    showFooter: true,
  },
  modern: {
    accent: "#0d9488",
    font: "sans",
    showLogo: true,
    showQr: true,
    showFooter: true,
  },
};

export const defaultInvoiceDesign: InvoiceDesign = {
  preset: "classic",
  accent: "#7f1d1d",
  font: "serif",
  showLogo: true,
  showIssuerAddress: true,
  showTaxId: true,
  showQr: true,
  showColumns: true,
  showSubtotal: true,
  showDiscounts: true,
  showDelivery: true,
  showTotal: true,
  showNotes: true,
  showFooter: true,
  footerText: "",
};

export const invoicePresetLabels: Record<InvoicePreset, string> = {
  compact: "Compacto",
  classic: "Clásico",
  modern: "Moderno",
};

/** @summary Combina valores guardados con los defaults del preset elegido, priorizando lo explícito. */
export function resolveInvoiceDesign(value: unknown): InvoiceDesign {
  const raw = (value ?? {}) as Partial<InvoiceDesign>;
  const preset: InvoicePreset = ["compact", "classic", "modern"].includes(raw.preset ?? "")
    ? (raw.preset as InvoicePreset)
    : defaultInvoiceDesign.preset;
  return {
    ...defaultInvoiceDesign,
    ...invoicePresetDefaults[preset],
    ...raw,
    preset,
  };
}

export const invoiceFontClass: Record<InvoiceFont, string> = {
  sans: "font-sans",
  serif: "font-serif",
  mono: "font-mono",
};
