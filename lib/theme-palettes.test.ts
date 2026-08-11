import { describe, expect, it } from "vitest";
import { contrastRatio, palettePresets, validatePalette } from "@/lib/theme-palettes";

describe("theme palettes", () => {
  it("keeps every predefined palette readable", () => {
    for (const palette of palettePresets) {
      expect(contrastRatio(palette.text, palette.background)).toBeGreaterThanOrEqual(4.5);
      expect(validatePalette(palette)).toEqual([]);
    }
  });

  it("rejects an unreadable custom combination", () => {
    const palette = { ...palettePresets[0], text: "#111111", background: "#09090b", textMuted: "#151515" };
    expect(validatePalette(palette).length).toBeGreaterThan(0);
  });
});
