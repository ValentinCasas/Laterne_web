import { describe, expect, it } from "vitest";
import { slugify } from "@/lib/slug";

describe("slugify", () => {
  it("normaliza acentos, espacios y mayúsculas", () => {
    expect(slugify("  Café Laterne & Cerveza  ")).toBe("cafe-laterne-cerveza");
  });

  it("elimina separadores repetidos y caracteres inseguros", () => {
    expect(slugify("Pizza /// Especial!!!")).toBe("pizza-especial");
  });

  it("mantiene una longitud apta para las URLs de producto", () => {
    expect(slugify("a".repeat(250))).toHaveLength(160);
  });
});
