import type { CSSProperties } from "react";

export type PaletteColors = {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  surfaceElevated: string;
  text: string;
  textMuted: string;
  border: string;
  success: string;
  warning: string;
  danger: string;
  baseMode: "dark" | "light";
};

export type PalettePreset = PaletteColors & { key: string; name: string; description: string };

/** @summary Presets globales disponibles para todos los tenants sin compartir datos personalizados. */
export const palettePresets: PalettePreset[] = [
  { key: "menuclick-dark", name: "MenuClick Dark", description: "Rosa energético sobre grafito profundo.", baseMode: "dark", primary: "#ec4899", secondary: "#f5c542", accent: "#f9a8d4", background: "#09090b", surface: "#18181b", surfaceElevated: "#27272a", text: "#fafafa", textMuted: "#a1a1aa", border: "#3f3f46", success: "#34d399", warning: "#fbbf24", danger: "#f87171" },
  { key: "grafito", name: "Grafito", description: "Neutros sobrios con acento azul mineral.", baseMode: "dark", primary: "#60a5fa", secondary: "#a5b4fc", accent: "#bfdbfe", background: "#111318", surface: "#1d2129", surfaceElevated: "#2b313c", text: "#f8fafc", textMuted: "#aab4c3", border: "#46505e", success: "#4ade80", warning: "#facc15", danger: "#fb7185" },
  { key: "medianoche", name: "Medianoche", description: "Azul profundo y violeta para una identidad nocturna.", baseMode: "dark", primary: "#818cf8", secondary: "#38bdf8", accent: "#c4b5fd", background: "#0b1220", surface: "#14213a", surfaceElevated: "#1d3153", text: "#f8fafc", textMuted: "#a9b8d0", border: "#3b5275", success: "#34d399", warning: "#fbbf24", danger: "#fb7185" },
  { key: "bosque", name: "Bosque", description: "Verdes frescos con crema y grafito.", baseMode: "dark", primary: "#34d399", secondary: "#a3e635", accent: "#d9f99d", background: "#0d1512", surface: "#17231e", surfaceElevated: "#23362d", text: "#f4f7ed", textMuted: "#b1bdad", border: "#466052", success: "#86efac", warning: "#facc15", danger: "#fb7185" },
  { key: "borgona", name: "Borgoña", description: "Bordó elegante, rosa viejo y crema.", baseMode: "dark", primary: "#be123c", secondary: "#fb7185", accent: "#fecdd3", background: "#160c10", surface: "#29151c", surfaceElevated: "#40202b", text: "#fff7ed", textMuted: "#d6b8bf", border: "#68404b", success: "#4ade80", warning: "#fbbf24", danger: "#fb7185" },
  { key: "oceano", name: "Océano", description: "Azules limpios para una experiencia luminosa.", baseMode: "light", primary: "#0369a1", secondary: "#0891b2", accent: "#0e7490", background: "#f0f9ff", surface: "#ffffff", surfaceElevated: "#e0f2fe", text: "#082f49", textMuted: "#426274", border: "#a8c6d8", success: "#047857", warning: "#a16207", danger: "#b91c1c" },
  { key: "crema", name: "Crema", description: "Cálida y luminosa, con terracota controlado.", baseMode: "light", primary: "#b45309", secondary: "#d97706", accent: "#92400e", background: "#fffbeb", surface: "#fffdf5", surfaceElevated: "#fef3c7", text: "#422006", textMuted: "#785b3a", border: "#d8c49b", success: "#166534", warning: "#92400e", danger: "#b91c1c" },
  { key: "carbon", name: "Carbón", description: "Negro suave y naranja ámbar de alto contraste.", baseMode: "dark", primary: "#fb923c", secondary: "#facc15", accent: "#fed7aa", background: "#101010", surface: "#1c1c1c", surfaceElevated: "#2b2b2b", text: "#fafafa", textMuted: "#b6b6b6", border: "#4a4a4a", success: "#4ade80", warning: "#facc15", danger: "#f87171" },
];

export const defaultPalette = palettePresets[0];

/** @summary Calcula luminancia relativa y contraste WCAG para impedir combinaciones ilegibles. */
export function contrastRatio(first: string, second: string) {
  const luminance = (value: string) => {
    const channels = value.replace("#", "").match(/.{2}/g)?.map((channel) => parseInt(channel, 16) / 255) ?? [0, 0, 0];
    const linear = channels.map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };
  const light = Math.max(luminance(first), luminance(second));
  const dark = Math.min(luminance(first), luminance(second));
  return (light + 0.05) / (dark + 0.05);
}

export function validatePalette(colors: PaletteColors) {
  const errors: string[] = [];
  if (contrastRatio(colors.text, colors.background) < 4.5) errors.push("El texto principal no contrasta suficientemente con el fondo.");
  if (contrastRatio(colors.textMuted, colors.background) < 3) errors.push("El texto secundario necesita más contraste.");
  if (contrastRatio(colors.text, colors.surface) < 4.5) errors.push("El texto no contrasta suficientemente con la superficie.");
  if (contrastRatio(colors.primary, colors.background) < 2.5) errors.push("El color principal no se distingue del fondo.");
  return errors;
}

/** @summary Convierte una paleta en variables compartidas por la web pública y el Admin. */
export function paletteCssVariables(colors: PaletteColors): CSSProperties {
  return {
    "--color-primary": colors.primary,
    "--color-secondary": colors.secondary,
    "--color-accent": colors.accent,
    "--color-background": colors.background,
    "--color-surface": colors.surface,
    "--color-surface-elevated": colors.surfaceElevated,
    "--color-text": colors.text,
    "--color-text-muted": colors.textMuted,
    "--color-border": colors.border,
    "--color-success": colors.success,
    "--color-warning": colors.warning,
    "--color-danger": colors.danger,
    "--brand-primary": colors.primary,
    "--brand-secondary": colors.secondary,
    "--brand-background": colors.background,
    "--admin-background": colors.background,
    "--admin-surface": colors.surface,
    "--admin-surface-elevated": colors.surfaceElevated,
    "--admin-text": colors.text,
    "--admin-muted": colors.textMuted,
    "--admin-border": colors.border,
    "--admin-primary": colors.primary,
    "--admin-primary-strong": colors.primary,
    "--admin-glow": `${colors.primary}22`,
  } as CSSProperties;
}

export function paletteFromLegacy(primary: string, secondary: string, background: string): PaletteColors {
  return { ...defaultPalette, primary, secondary, accent: primary, background };
}

export function presetByKey(key: string | null | undefined) {
  return palettePresets.find((palette) => palette.key === key) ?? null;
}
