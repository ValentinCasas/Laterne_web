import { describe, expect, it } from "vitest";
import { convertQuantity, isConvertible, normalizeUnit, RECIPE_UNITS, unitLabel } from "@/lib/recipe-units";

describe("convertQuantity", () => {
  it("convierte entre unidades estándar de masa", () => {
    expect(convertQuantity(2, "kg", "g")).toBe(2000);
    expect(convertQuantity(500, "g", "kg")).toBe(0.5);
  });

  it("convierte entre unidades estándar de volumen", () => {
    expect(convertQuantity(1.5, "l", "ml")).toBe(1500);
    expect(convertQuantity(3, "cucharada", "ml")).toBe(45);
    expect(convertQuantity(2, "taza", "ml")).toBe(480);
  });

  it("convierte entre unidades de conteo", () => {
    expect(convertQuantity(2, "docena", "unidad")).toBe(24);
    expect(convertQuantity(6, "unidad", "docena")).toBe(0.5);
  });

  it("devuelve el mismo valor para la misma unidad", () => {
    expect(convertQuantity(7, "kg", "kg")).toBe(7);
  });

  it("aplica conversiones personalizadas del negocio", () => {
    const custom = [{ fromUnit: "bolsa", toUnit: "kg", factor: 25 }];
    expect(convertQuantity(2, "bolsa", "kg", custom)).toBe(50);
    // El camino inverso también funciona.
    expect(convertQuantity(50, "kg", "bolsa", custom)).toBe(2);
  });

  it("encadena conversión personalizada con estándar (bolsa → kg → g)", () => {
    const custom = [{ fromUnit: "bolsa", toUnit: "kg", factor: 25 }];
    expect(convertQuantity(1, "bolsa", "g", custom)).toBe(25000);
  });

  it("lanza error cuando las unidades no son convertibles", () => {
    expect(() => convertQuantity(1, "kg", "ml")).toThrow(/No se pueden convertir/);
    expect(() => convertQuantity(1, "bolsa", "unidad")).toThrow(/No se pueden convertir/);
  });

  it("lanza error con cantidad inválida", () => {
    expect(() => convertQuantity(Number.NaN, "kg", "g")).toThrow(/número válido/);
  });
});

describe("isConvertible", () => {
  it("acepta unidades equivalentes y del mismo rango", () => {
    expect(isConvertible("kg", "g")).toBe(true);
    expect(isConvertible("ml", "l")).toBe(true);
    expect(isConvertible("cucharada", "ml")).toBe(true);
    expect(isConvertible("unidad", "unidad")).toBe(true);
  });

  it("rechaza dimensiones distintas", () => {
    expect(isConvertible("kg", "ml")).toBe(false);
    expect(isConvertible("unidad", "g")).toBe(false);
  });

  it("acepta conversiones personalizadas", () => {
    const custom = [{ fromUnit: "bolsa", toUnit: "kg", factor: 25 }];
    expect(isConvertible("bolsa", "g", custom)).toBe(true);
    expect(isConvertible("bolsa", "unidad", custom)).toBe(false);
  });
});

describe("normalizeUnit y unitLabel", () => {
  it("normaliza mayúsculas y espacios", () => {
    expect(normalizeUnit(" Kilo Gramo ")).toBe("kilo_gramo");
    expect(normalizeUnit("KG")).toBe("kg");
  });

  it("etiqueta unidades estándar y personalizadas", () => {
    expect(unitLabel("kg")).toBe("Kilogramo");
    expect(unitLabel("bolsa")).toBe("bolsa");
  });

  it("expone el listado de unidades estándar del editor", () => {
    expect(RECIPE_UNITS).toContain("unidad");
    expect(RECIPE_UNITS).toContain("g");
    expect(RECIPE_UNITS).toContain("ml");
  });
});
