import type { CSSProperties } from "react";
import type { PaletteColors } from "@/lib/theme-palettes";

export type MenuClickTheme = PaletteColors & { key: string; name: string; description: string };

export const menuClickPresets: MenuClickTheme[] = [
  { key: "original", name: "MenuClick Original", description: "Lima eléctrica, cian y grafito.", baseMode: "dark", primary: "#e8ff6a", secondary: "#67e8f9", accent: "#f0abfc", background: "#0b0d12", surface: "#151a24", surfaceElevated: "#202735", text: "#f8fafc", textMuted: "#94a3b8", border: "#334155", success: "#86efac", warning: "#facc15", danger: "#fb7185" },
  { key: "grafito", name: "Grafito", description: "Azul mineral sobre neutros sobrios.", baseMode: "dark", primary: "#60a5fa", secondary: "#a5b4fc", accent: "#bfdbfe", background: "#111318", surface: "#1d2129", surfaceElevated: "#2b313c", text: "#f8fafc", textMuted: "#aab4c3", border: "#46505e", success: "#4ade80", warning: "#facc15", danger: "#fb7185" },
  { key: "nocturno", name: "Nocturno", description: "Violeta y azul para una marca profunda.", baseMode: "dark", primary: "#a78bfa", secondary: "#38bdf8", accent: "#f0abfc", background: "#0c0b17", surface: "#19172b", surfaceElevated: "#282342", text: "#fafafa", textMuted: "#b8b1d1", border: "#514878", success: "#4ade80", warning: "#fbbf24", danger: "#fb7185" },
  { key: "azul-tecnologico", name: "Azul tecnológico", description: "Cian y azul eléctrico, claro y preciso.", baseMode: "dark", primary: "#22d3ee", secondary: "#3b82f6", accent: "#93c5fd", background: "#07121c", surface: "#0e2232", surfaceElevated: "#17364e", text: "#f0f9ff", textMuted: "#9fb8ca", border: "#31566d", success: "#34d399", warning: "#facc15", danger: "#fb7185" },
  { key: "violeta-premium", name: "Violeta premium", description: "Violeta intenso con coral controlado.", baseMode: "dark", primary: "#c084fc", secondary: "#fb7185", accent: "#f5d0fe", background: "#160d1f", surface: "#281636", surfaceElevated: "#402653", text: "#fff7ff", textMuted: "#d2bad9", border: "#704b83", success: "#4ade80", warning: "#fbbf24", danger: "#fb7185" },
  { key: "claro-profesional", name: "Claro profesional", description: "Azul tinta sobre superficies luminosas.", baseMode: "light", primary: "#1d4ed8", secondary: "#0891b2", accent: "#0e7490", background: "#f6f9fc", surface: "#ffffff", surfaceElevated: "#e7eef7", text: "#0f172a", textMuted: "#526174", border: "#b8c6d6", success: "#047857", warning: "#a16207", danger: "#b91c1c" },
];

export const defaultMenuClickTheme = menuClickPresets[0];

/** @summary Convierte la identidad global en tokens exclusivos de MenuClick. */
export function menuClickCssVariables(theme: PaletteColors): CSSProperties {
  return {
    "--mc-background": theme.background,
    "--mc-background-alt": theme.surface,
    "--mc-surface": theme.surface,
    "--mc-surface-elevated": theme.surfaceElevated,
    "--mc-primary": theme.primary,
    "--mc-primary-hover": theme.accent,
    "--mc-primary-soft": `${theme.primary}22`,
    "--mc-secondary": theme.secondary,
    "--mc-accent": theme.accent,
    "--mc-text": theme.text,
    "--mc-text-muted": theme.textMuted,
    "--mc-border": theme.border,
    "--mc-border-strong": theme.textMuted,
    "--mc-success": theme.success,
    "--mc-warning": theme.warning,
    "--mc-danger": theme.danger,
    "--mc-info": theme.secondary,
    "--mc-radius": ".8rem",
    "--color-primary": theme.primary,
    "--color-secondary": theme.secondary,
    "--color-accent": theme.accent,
    "--color-background": theme.background,
    "--color-surface": theme.surface,
    "--color-surface-elevated": theme.surfaceElevated,
    "--color-text": theme.text,
    "--color-text-muted": theme.textMuted,
    "--color-border": theme.border,
    "--brand-primary": theme.primary,
    "--brand-secondary": theme.secondary,
    "--brand-background": theme.background,
  } as CSSProperties;
}

export function menuClickPresetByKey(key: string | null | undefined) {
  return menuClickPresets.find((preset) => preset.key === key) ?? null;
}

export function menuClickThemeFromRecord(record: { name: string; presetKey: string | null; baseMode: string; primary: string; secondary: string; accent: string; background: string; surface: string; surfaceElevated: string; text: string; textMuted: string; border: string; success: string; warning: string; danger: string }): MenuClickTheme {
  return { key: record.presetKey ?? "custom", name: record.name, description: "Identidad global de MenuClick.", baseMode: record.baseMode === "light" ? "light" : "dark", primary: record.primary, secondary: record.secondary, accent: record.accent, background: record.background, surface: record.surface, surfaceElevated: record.surfaceElevated, text: record.text, textMuted: record.textMuted, border: record.border, success: record.success, warning: record.warning, danger: record.danger };
}
